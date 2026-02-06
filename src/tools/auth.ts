/**
 * auth tool for grounded-search-mcp
 *
 * Provides flag-based authentication management for Google OAuth:
 * - auth --status: Show authentication status
 * - auth --login <provider>: Start OAuth flow
 * - auth --login <provider> --code <code>: Complete OAuth flow
 * - auth --logout <provider|both>: Clear tokens
 * - auth --default-provider <provider>: Set default
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
	type AuthFlowState,
	type ProviderName,
	completeLogin,
	getProviderDisplayName,
	getStatus,
	isAuthenticated,
	login,
	logout,
	maskEmail,
	setDefaultProvider,
} from '../auth/index.js';
import { loadTokens } from '../auth/token-storage.js';

/**
 * Active auth flows tracked in memory
 * Key: provider name
 * Value: flow state and creation timestamp
 */
const activeAuthFlows = new Map<
	ProviderName,
	{
		flowState: AuthFlowState;
		createdAt: number;
	}
>();

/**
 * Auth flow timeout in milliseconds (5 minutes)
 */
const AUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Clean up expired auth flows
 */
function cleanupExpiredFlows(): void {
	const now = Date.now();
	for (const [provider, flow] of activeAuthFlows.entries()) {
		if (now - flow.createdAt > AUTH_FLOW_TIMEOUT_MS) {
			activeAuthFlows.delete(provider);
		}
	}
}

/**
 * Format authentication status as markdown
 */
async function formatStatus(): Promise<string> {
	const status = await getStatus();

	const lines: string[] = ['## Authentication Status', ''];
	lines.push(`**Default provider:** ${getProviderDisplayName(status.defaultProvider)}`);
	lines.push('');

	// Gemini CLI status
	lines.push('### Gemini CLI');
	if (status.gemini?.authenticated) {
		lines.push('Status: Authenticated');
		if (status.gemini.email) {
			lines.push(`Account: ${status.gemini.email}`);
		}
	} else {
		lines.push('Status: Not authenticated');
	}
	lines.push('');

	// Antigravity status
	lines.push('### Antigravity');
	if (status.antigravity?.authenticated) {
		lines.push('Status: Authenticated');
		if (status.antigravity.email) {
			lines.push(`Account: ${status.antigravity.email}`);
		}
	} else {
		lines.push('Status: Not authenticated');
	}

	return lines.join('\n');
}

/**
 * Extract authorization code from a URL or return the code as-is
 */
function extractCode(codeOrUrl: string): string {
	// Check if it looks like a URL
	if (codeOrUrl.includes('code=')) {
		try {
			const url = new URL(codeOrUrl);
			const code = url.searchParams.get('code');
			if (code) return code;
		} catch {
			// Try to extract code= from malformed URL
			const match = codeOrUrl.match(/[?&]code=([^&]+)/);
			if (match) return decodeURIComponent(match[1]);
		}
	}
	return codeOrUrl;
}

/**
 * Format login instructions as markdown
 */
function formatLoginInstructions(provider: ProviderName, authUrl: string): string {
	const displayName = getProviderDisplayName(provider);
	const isAntigravity = provider === 'antigravity';

	const step3 = isAntigravity
		? `3. After authorizing, your browser will show "connection refused" - this is expected.
   Copy the **entire URL** from your browser's address bar.`
		: '3. Copy the authorization code shown on the page (or the entire URL).';

	return `## Authentication Required

To authenticate with ${displayName}:

1. Open this URL in your browser:
   ${authUrl}

2. Sign in with your Google account and authorize the application

${step3}

4. Reply with: auth --login ${provider} --code PASTE_HERE

**Note:** This process will time out in 5 minutes.`;
}

/**
 * Format login success message
 */
function formatLoginSuccess(provider: ProviderName, maskedEmail: string): string {
	const displayName = getProviderDisplayName(provider);

	return `## Authentication Successful

You are now authenticated with ${displayName} as ${maskedEmail}.

Your session will remain active until you log out or tokens are revoked.`;
}

/**
 * Format already authenticated message
 */
async function formatAlreadyAuthenticated(provider: ProviderName): Promise<string> {
	const tokens = await loadTokens();
	const providerTokens = tokens?.[provider];
	const email = providerTokens?.email ? maskEmail(providerTokens.email) : 'your account';

	return `## Already Authenticated

You are already authenticated with ${getProviderDisplayName(provider)} as ${email}.

To re-authenticate, logout first with: auth --logout ${provider}`;
}

/**
 * Format logout success message
 */
function formatLogoutSuccess(provider: ProviderName | 'both'): string {
	if (provider === 'both') {
		return `## Logged Out

Successfully logged out of all providers (Gemini CLI and Antigravity).`;
	}

	return `## Logged Out

Successfully logged out of ${getProviderDisplayName(provider)}.`;
}

/**
 * Format default provider set message
 */
function formatDefaultProviderSet(provider: ProviderName): string {
	return `## Default Provider Set

Default provider set to ${getProviderDisplayName(provider)}.

This provider will be used for searches when not explicitly specified.`;
}

/**
 * Format help text
 */
function formatHelp(): string {
	return `## Auth Tool

Manage authentication for Google Search grounding.

**Usage:**
- auth --status: Show authentication status
- auth --login: Start authentication (shows provider menu)
- auth --login antigravity: Authenticate with Antigravity (recommended)
- auth --login gemini: Authenticate with Gemini CLI
- auth --login <provider> --code CODE: Complete authentication with code
- auth --logout <provider|both>: Log out from provider(s)
- auth --default-provider <provider>: Set default provider

**Providers:**
- **antigravity** (default): gemini-2.5-flash via sandbox endpoint
- **gemini** (fallback): gemini-2.5-flash via production endpoint

**Note:** Both providers use gemini-2.5-flash (only model with grounded search).
Antigravity is recommended as the default. Gemini CLI serves as fallback.`;
}

/**
 * Format error message
 */
function formatError(message: string): string {
	return `## Error

${message}`;
}

/**
 * Register the auth tool with the MCP server
 */
export function registerAuthTool(server: McpServer): void {
	server.tool(
		'auth',
		'Manage authentication for Google Search grounding',
		{
			login: z.enum(['gemini', 'antigravity']).optional().describe('Provider to authenticate with'),
			status: z.boolean().optional().describe('Show authentication status for all providers'),
			logout: z
				.enum(['gemini', 'antigravity', 'both'])
				.optional()
				.describe('Provider to log out from'),
			default_provider: z
				.enum(['gemini', 'antigravity'])
				.optional()
				.describe('Set the default provider for searches'),
			code: z
				.string()
				.optional()
				.describe('Authorization code from Google OAuth (after visiting auth URL)'),
		},
		async (params) => {
			// Clean up expired flows on each invocation
			cleanupExpiredFlows();

			const {
				login: loginProvider,
				status: showStatus,
				logout: logoutProvider,
				default_provider: defaultProvider,
				code,
			} = params;

			try {
				// Handle --status
				if (showStatus) {
					const statusText = await formatStatus();
					return {
						content: [{ type: 'text', text: statusText }],
					};
				}

				// Handle --logout
				if (logoutProvider) {
					await logout(logoutProvider);
					return {
						content: [{ type: 'text', text: formatLogoutSuccess(logoutProvider) }],
					};
				}

				// Handle --default-provider
				if (defaultProvider) {
					await setDefaultProvider(defaultProvider);
					return {
						content: [{ type: 'text', text: formatDefaultProviderSet(defaultProvider) }],
					};
				}

				// Handle --login with --code (complete flow)
				if (loginProvider && code) {
					const activeFlow = activeAuthFlows.get(loginProvider);

					if (!activeFlow) {
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										`No active authentication flow for ${getProviderDisplayName(loginProvider)}. Start with: auth --login ${loginProvider}`,
									),
								},
							],
							isError: true,
						};
					}

					// Check if flow expired
					if (Date.now() - activeFlow.createdAt > AUTH_FLOW_TIMEOUT_MS) {
						activeAuthFlows.delete(loginProvider);
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										`Authentication flow expired. Please start again with: auth --login ${loginProvider}`,
									),
								},
							],
							isError: true,
						};
					}

					// Extract code from URL if needed
					const authCode = extractCode(code);

					// Complete the login
					const result = await completeLogin(authCode, activeFlow.flowState);

					// Clear the flow regardless of success/failure
					activeAuthFlows.delete(loginProvider);

					if (!result.success) {
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										`Authentication failed: ${result.error}\n\nPlease try again with: auth --login ${loginProvider}`,
									),
								},
							],
							isError: true,
						};
					}

					return {
						content: [{ type: 'text', text: formatLoginSuccess(loginProvider, result.email) }],
					};
				}

				// Handle --login without --code (start flow)
				if (loginProvider) {
					// Check if already authenticated
					const alreadyAuth = await isAuthenticated(loginProvider);
					if (alreadyAuth) {
						return {
							content: [{ type: 'text', text: await formatAlreadyAuthenticated(loginProvider) }],
						};
					}

					// Start new login flow
					const loginResult = await login(loginProvider);

					// Store flow state
					activeAuthFlows.set(loginProvider, {
						flowState: loginResult.flowState,
						createdAt: Date.now(),
					});

					return {
						content: [
							{ type: 'text', text: formatLoginInstructions(loginProvider, loginResult.authUrl) },
						],
					};
				}

				// Handle --code without --login (try to find active flow)
				if (code) {
					// Try gemini first, then antigravity
					let activeFlow = activeAuthFlows.get('gemini');
					let provider: ProviderName = 'gemini';

					if (!activeFlow) {
						activeFlow = activeAuthFlows.get('antigravity');
						provider = 'antigravity';
					}

					if (!activeFlow) {
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										'No active authentication flow. Start with: auth --login <provider>',
									),
								},
							],
							isError: true,
						};
					}

					// Check if flow expired
					if (Date.now() - activeFlow.createdAt > AUTH_FLOW_TIMEOUT_MS) {
						activeAuthFlows.delete(provider);
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										`Authentication flow expired. Please start again with: auth --login ${provider}`,
									),
								},
							],
							isError: true,
						};
					}

					// Extract code from URL if needed
					const authCode = extractCode(code);

					// Complete the login
					const result = await completeLogin(authCode, activeFlow.flowState);

					// Clear the flow
					activeAuthFlows.delete(provider);

					if (!result.success) {
						return {
							content: [
								{
									type: 'text',
									text: formatError(
										`Authentication failed: ${result.error}\n\nPlease try again with: auth --login ${provider}`,
									),
								},
							],
							isError: true,
						};
					}

					return {
						content: [{ type: 'text', text: formatLoginSuccess(provider, result.email) }],
					};
				}

				// No flags - show help
				return {
					content: [{ type: 'text', text: formatHelp() }],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					content: [{ type: 'text', text: formatError(message) }],
					isError: true,
				};
			}
		},
	);
}
