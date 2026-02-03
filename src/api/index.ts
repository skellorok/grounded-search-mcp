/**
 * API client module for gemini-search-mcp
 *
 * Re-exports constants and request building functions.
 * Actual search execution will be added in Plan 04-02.
 */

// Constants and utilities
export {
	ANTIGRAVITY_CONFIG,
	ANTIGRAVITY_DEFAULT_PROJECT_ID,
	ANTIGRAVITY_ENDPOINT,
	ANTIGRAVITY_HEADERS,
	ANTIGRAVITY_VERSION,
	DEFAULT_INCLUDE_THOUGHTS,
	DEFAULT_MODEL,
	DEFAULT_THINKING_LEVEL,
	GEMINI_CLI_CONFIG,
	GEMINI_CLI_ENDPOINT,
	GEMINI_CLI_HEADERS,
	type ProviderApiConfig,
	SEARCH_SYSTEM_INSTRUCTION,
	SEARCH_TIMEOUT_MS,
	generateRequestId,
	generateSessionId,
	getRandomizedHeaders,
} from './constants.js';

// Request building
export {
	buildSearchRequest,
	getProviderConfig,
	type ProviderRequestConfig,
	type SearchRequestOptions,
	wrapProviderRequest,
} from './request.js';
