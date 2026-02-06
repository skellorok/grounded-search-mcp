/**
 * API constants for grounded-search-mcp
 *
 * Provider-specific configurations, endpoints, headers, and utility functions
 * for making requests to Gemini CLI and Antigravity providers.
 */

import type { ProviderName } from '../auth/types.js';

// ============================================================================
// ENDPOINTS
// ============================================================================

/**
 * Production endpoint used by Gemini CLI
 */
export const GEMINI_CLI_ENDPOINT = 'https://cloudcode-pa.googleapis.com';

/**
 * Sandbox endpoint used by Antigravity (daily build)
 */
export const ANTIGRAVITY_ENDPOINT = 'https://daily-cloudcode-pa.sandbox.googleapis.com';

// ============================================================================
// ANTIGRAVITY VERSION
// ============================================================================

/**
 * Antigravity version string - CRITICAL for User-Agent.
 * Outdated versions cause "This version of Antigravity is no longer supported" errors.
 *
 * @see OpenCode constants.js for updates
 */
export const ANTIGRAVITY_VERSION = '1.15.8';

// ============================================================================
// DEFAULT HEADERS
// ============================================================================

/**
 * Static headers for Gemini CLI provider
 */
export const GEMINI_CLI_HEADERS = {
	'User-Agent': 'google-api-nodejs-client/10.3.0',
	'X-Goog-Api-Client': 'gl-node/22.18.0',
	'Client-Metadata': 'ideType=IDE_UNSPECIFIED,platform=PLATFORM_UNSPECIFIED,pluginType=GEMINI',
};

/**
 * Static headers for Antigravity provider
 */
export const ANTIGRAVITY_HEADERS = {
	'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${ANTIGRAVITY_VERSION} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
	'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
	'Client-Metadata':
		'{"ideType":"IDE_UNSPECIFIED","platform":"PLATFORM_UNSPECIFIED","pluginType":"GEMINI"}',
};

// ============================================================================
// HEADER RANDOMIZATION (Antigravity rate limit avoidance)
// ============================================================================

/**
 * Antigravity User-Agents must use the full browser-like format.
 * Short format (antigravity/1.15.8 linux/amd64) causes 404 errors.
 */
const ANTIGRAVITY_USER_AGENTS = [
	`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${ANTIGRAVITY_VERSION} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
	`Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${ANTIGRAVITY_VERSION} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
	`Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Antigravity/${ANTIGRAVITY_VERSION} Chrome/138.0.7204.235 Electron/37.3.1 Safari/537.36`,
];

const ANTIGRAVITY_API_CLIENTS = [
	'google-cloud-sdk vscode_cloudshelleditor/0.1',
	'google-cloud-sdk vscode/1.96.0',
	'google-cloud-sdk jetbrains/2024.3',
	'google-cloud-sdk vscode/1.95.0',
];

const GEMINI_CLI_USER_AGENTS = [
	'google-api-nodejs-client/10.3.0',
	'google-api-nodejs-client/9.15.1',
	'google-api-nodejs-client/9.14.0',
];

const GEMINI_CLI_API_CLIENTS = [
	'gl-node/22.18.0',
	'gl-node/22.17.0',
	'gl-node/22.12.0',
	'gl-node/20.18.0',
];

function randomFrom<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get randomized headers for rate limit avoidance.
 * Rotates User-Agent and X-Goog-Api-Client per request.
 */
export function getRandomizedHeaders(provider: ProviderName): Record<string, string> {
	if (provider === 'gemini') {
		return {
			'User-Agent': randomFrom(GEMINI_CLI_USER_AGENTS),
			'X-Goog-Api-Client': randomFrom(GEMINI_CLI_API_CLIENTS),
			'Client-Metadata': GEMINI_CLI_HEADERS['Client-Metadata'],
		};
	}
	return {
		'User-Agent': randomFrom(ANTIGRAVITY_USER_AGENTS),
		'X-Goog-Api-Client': randomFrom(ANTIGRAVITY_API_CLIENTS),
		'Client-Metadata': ANTIGRAVITY_HEADERS['Client-Metadata'],
	};
}

// ============================================================================
// PROVIDER CONFIGS
// ============================================================================

export interface ProviderApiConfig {
	endpoint: string;
	headers: Record<string, string>;
}

/**
 * Complete API configuration for Gemini CLI provider
 */
export const GEMINI_CLI_CONFIG: ProviderApiConfig = {
	endpoint: GEMINI_CLI_ENDPOINT,
	headers: GEMINI_CLI_HEADERS,
};

/**
 * Complete API configuration for Antigravity provider
 */
export const ANTIGRAVITY_CONFIG: ProviderApiConfig = {
	endpoint: ANTIGRAVITY_ENDPOINT,
	headers: ANTIGRAVITY_HEADERS,
};

// ============================================================================
// PROVIDER-SPECIFIC MODEL CONFIGURATIONS
// ============================================================================

/**
 * Model configuration per provider.
 *
 * Both providers use gemini-2.5-flash — the only model that returns
 * groundingMetadata (source citations) with the googleSearch tool.
 * gemini-3-flash does not return groundingMetadata on either endpoint.
 *
 * @see https://github.com/NoeFabris/opencode-antigravity-auth/issues/384
 */
export const PROVIDER_MODELS: Record<ProviderName, string> = {
	antigravity: 'gemini-2.5-flash',
	gemini: 'gemini-2.5-flash',
};

/**
 * Thinking levels — retained for API compatibility but currently a no-op.
 * gemini-2.5-flash does not support thinkingConfig (returns 400).
 */
export type ThinkingLevel = 'high' | 'low' | 'none';

/**
 * Valid thinking levels for the API (excludes 'none')
 */
export type ApiThinkingLevel = 'high' | 'low';

/**
 * Default thinking level (no-op — neither provider supports thinking)
 */
export const DEFAULT_THINKING_LEVEL: ApiThinkingLevel = 'high';

/**
 * Whether thinking is supported per provider.
 * gemini-2.5-flash does not support thinkingConfig on either endpoint.
 */
export const PROVIDER_SUPPORTS_THINKING: Record<ProviderName, boolean> = {
	antigravity: false,
	gemini: false,
};

/**
 * Timeout for search requests (60 seconds)
 */
export const SEARCH_TIMEOUT_MS = 60000;

// Note: Only the daily sandbox endpoint works with Antigravity OAuth credentials.
// Autopush and production endpoints return 429 quota errors.
// See: https://github.com/anthropics/claude-code/issues/... (testing confirmed 2026-02-04)

// ============================================================================
// SYSTEM INSTRUCTION
// ============================================================================

/**
 * System instruction for grounded search requests.
 * Instructs the model to use web search for current information.
 */
export const SEARCH_SYSTEM_INSTRUCTION = `You are an expert web search assistant with access to Google Search.

Your capabilities:
- Use google_search to find real-time information from the web

Guidelines:
- Always provide accurate, well-sourced information
- Cite your sources when presenting facts
- Be concise but comprehensive in your responses
- If information is uncertain or conflicting, acknowledge it
- Focus on answering the user's question directly`;

// ============================================================================
// REQUEST ID AND SESSION ID GENERATION
// ============================================================================

/**
 * Generate a unique request ID for API calls.
 * Pattern: prefix-timestamp(base36)-random(6chars)
 */
export function generateRequestId(prefix = 'search'): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

let sessionCounter = 0;
const sessionPrefix = `gsearch-${Date.now().toString(36)}`;

/**
 * Generate a session ID for request tracking.
 * Pattern: prefix-counter (increments per request)
 */
export function generateSessionId(): string {
	sessionCounter++;
	return `${sessionPrefix}-${sessionCounter}`;
}

// ============================================================================
// ANTIGRAVITY PROJECT ID
// ============================================================================

/**
 * Default project ID for Antigravity requests.
 * Used when loadCodeAssist doesn't return a project (business/workspace accounts).
 */
export const ANTIGRAVITY_DEFAULT_PROJECT_ID = 'rising-fact-p41fc';
