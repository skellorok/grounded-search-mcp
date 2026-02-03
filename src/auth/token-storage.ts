/**
 * Secure token storage for gemini-search-mcp
 *
 * Stores OAuth tokens in XDG-compliant config directory
 * with secure file permissions and atomic writes.
 */

import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';
import {
	type ProviderName,
	type ProviderTokens,
	type TokenFile,
	TokenFileSchema,
} from './types.js';

/**
 * XDG-compliant paths for google-search-mcp
 * On Linux: ~/.config/google-search-mcp/
 * On macOS: ~/Library/Preferences/google-search-mcp/
 * On Windows: %APPDATA%/google-search-mcp/Config/
 */
const paths = envPaths('google-search-mcp', { suffix: '' });

/**
 * Get the path to the tokens.json file
 * @returns Absolute path to tokens.json
 */
export function getTokenFilePath(): string {
	return join(paths.config, 'tokens.json');
}

/**
 * Load tokens from disk with Zod validation
 *
 * @returns TokenFile if valid file exists, null if missing or invalid
 *
 * On parse/validation error:
 * - Backs up corrupt file to tokens.json.bak
 * - Returns null (treat as unauthenticated)
 */
export async function loadTokens(): Promise<TokenFile | null> {
	const tokenPath = getTokenFilePath();

	try {
		const content = await readFile(tokenPath, 'utf-8');
		const parsed = JSON.parse(content);
		const validated = TokenFileSchema.parse(parsed);
		return validated;
	} catch (error) {
		// File doesn't exist - normal case for first run
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}

		// Parse or validation error - backup corrupt file
		console.error('Token file corrupt or invalid, backing up:', error);
		try {
			const backupPath = `${tokenPath}.bak`;
			await rename(tokenPath, backupPath);
			console.error(`Backed up corrupt token file to ${backupPath}`);
		} catch {
			// Backup failed - continue anyway
		}
		return null;
	}
}

/**
 * Save tokens to disk with secure permissions
 *
 * - Creates config directory with mode 0o700 (owner only)
 * - Writes to temp file first, then atomic rename
 * - Sets file mode to 0o600 (owner read/write only)
 *
 * @param tokens TokenFile to save
 */
export async function saveTokens(tokens: TokenFile): Promise<void> {
	const tokenPath = getTokenFilePath();
	const configDir = dirname(tokenPath);
	const tempPath = `${tokenPath}.tmp`;

	// Ensure config directory exists with secure permissions
	await mkdir(configDir, { recursive: true, mode: 0o700 });

	// Write to temp file first
	const content = JSON.stringify(tokens, null, '\t');
	await writeFile(tempPath, content, { mode: 0o600 });

	// Atomic rename
	await rename(tempPath, tokenPath);

	// Ensure correct permissions (in case file existed with different perms)
	await chmod(tokenPath, 0o600);
}

/**
 * Get tokens for a specific provider
 *
 * @param provider Provider name
 * @returns Provider's tokens if authenticated, null otherwise
 */
export async function getProviderTokens(provider: ProviderName): Promise<ProviderTokens | null> {
	const tokens = await loadTokens();
	if (!tokens) return null;
	return tokens[provider] ?? null;
}

/**
 * Update tokens for a specific provider
 *
 * Loads existing tokens, updates the specified provider, and saves.
 *
 * @param provider Provider to update
 * @param providerTokens New tokens for the provider
 */
export async function updateProviderTokens(
	provider: ProviderName,
	providerTokens: ProviderTokens,
): Promise<void> {
	const tokens = (await loadTokens()) ?? {};
	tokens[provider] = providerTokens;
	await saveTokens(tokens);
}

/**
 * Delete tokens for a specific provider
 *
 * @param provider Provider to delete tokens for
 */
export async function deleteProviderTokens(provider: ProviderName): Promise<void> {
	const tokens = await loadTokens();
	if (!tokens) return;

	// Use undefined assignment instead of delete for performance
	tokens[provider] = undefined;

	// If this was the default provider, clear the default
	if (tokens.default_provider === provider) {
		tokens.default_provider = undefined;
	}

	await saveTokens(tokens);
}
