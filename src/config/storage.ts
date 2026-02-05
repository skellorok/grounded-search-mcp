/**
 * Config storage for grounded-search-mcp
 *
 * Stores user configuration in XDG-compliant config directory
 * with atomic writes and graceful fallback on invalid config.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import envPaths from 'env-paths';
import { DEFAULT_CONFIG } from './defaults.js';
import { type ConfigFile, ConfigFileSchema } from './types.js';

/**
 * XDG-compliant paths for grounded-search-mcp
 * On Linux: ~/.config/grounded-search-mcp/
 * On macOS: ~/Library/Application Support/grounded-search-mcp/
 * On Windows: %APPDATA%/grounded-search-mcp/
 */
const paths = envPaths('grounded-search-mcp', { suffix: '' });

/**
 * Get the path to the config.json file
 * @returns Absolute path to config.json
 */
export function getConfigFilePath(): string {
	return join(paths.config, 'config.json');
}

/**
 * Load config from disk with Zod validation
 *
 * Uses safeParse for graceful handling of invalid configs.
 * Creates config file with defaults on first run.
 * NEVER throws - returns defaults on any error.
 *
 * @returns ConfigFile (creates with defaults if file missing, returns defaults if invalid)
 */
export async function loadConfig(): Promise<ConfigFile> {
	const configPath = getConfigFilePath();

	try {
		const content = await readFile(configPath, 'utf-8');
		const parsed = JSON.parse(content);
		const result = ConfigFileSchema.safeParse(parsed);

		if (result.success) {
			return result.data;
		}

		// Invalid config: warn and fallback to defaults
		console.error('Config file invalid, using defaults:', result.error.message);
		return DEFAULT_CONFIG;
	} catch (error) {
		// File doesn't exist - create with defaults on first run
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			await saveConfig(DEFAULT_CONFIG);
			return DEFAULT_CONFIG;
		}

		// Parse error - warn and fallback
		console.error('Config file parse error, using defaults:', error);
		return DEFAULT_CONFIG;
	}
}

/**
 * Save config to disk with atomic write
 *
 * - Creates config directory with mode 0o700 (owner only)
 * - Writes to temp file first, then atomic rename
 * - Pretty JSON format (2-space indent) for human editability
 *
 * @param config ConfigFile to save
 */
export async function saveConfig(config: ConfigFile): Promise<void> {
	const configPath = getConfigFilePath();
	const configDir = dirname(configPath);
	const tempPath = `${configPath}.tmp`;

	// Ensure config directory exists with secure permissions
	await mkdir(configDir, { recursive: true, mode: 0o700 });

	// Pretty print for human editability (per CONTEXT.md)
	const content = JSON.stringify(config, null, 2);
	await writeFile(tempPath, content, { mode: 0o600 });

	// Atomic rename
	await rename(tempPath, configPath);
}

/**
 * Update specific config values
 *
 * Loads existing config, merges with updates, validates, and saves.
 *
 * @param updates Partial config to merge
 * @returns Updated config
 * @throws If validation fails (caller should handle)
 */
export async function updateConfig(updates: Partial<ConfigFile>): Promise<ConfigFile> {
	const current = await loadConfig();
	const merged = { ...current, ...updates };

	// Validate merged config (will throw on invalid)
	const validated = ConfigFileSchema.parse(merged);

	await saveConfig(validated);
	return validated;
}

/**
 * Reset config to defaults
 *
 * @param key Optional specific key to reset (resets all if omitted)
 * @returns Reset config
 */
export async function resetConfig(key?: keyof ConfigFile): Promise<ConfigFile> {
	if (key) {
		// Reset single key to default
		const current = await loadConfig();
		const reset = { ...current, [key]: DEFAULT_CONFIG[key] };
		await saveConfig(reset);
		return reset;
	}

	// Reset all to defaults
	await saveConfig(DEFAULT_CONFIG);
	return DEFAULT_CONFIG;
}
