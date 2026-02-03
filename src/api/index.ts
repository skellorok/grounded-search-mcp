/**
 * API client module for gemini-search-mcp
 *
 * Re-exports constants, request building, response parsing, and search execution.
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

// Response parsing and formatting
export {
	type ApiResponse,
	formatErrorResponse,
	formatSearchResult,
	parseSearchResponse,
	type SearchResult,
	type Source,
} from './response.js';

// Search execution
export {
	executeGroundedSearch,
	searchWithFallback,
	type SearchOptions,
} from './search.js';
