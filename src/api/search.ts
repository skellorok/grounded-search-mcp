/**
 * Search execution module for gemini-search-mcp
 *
 * Implements grounded search with provider fallback.
 * Uses two-stage orchestration pattern from request.ts.
 */

import { getDefaultProvider, getValidAccessToken } from '../auth/index.js';
import type { ProviderName } from '../auth/types.js';
import { loadConfig } from '../config/index.js';
import {
	ANTIGRAVITY_ENDPOINT,
	ANTIGRAVITY_HEADERS,
	GEMINI_CLI_ENDPOINT,
	PROVIDER_MODELS,
	SEARCH_TIMEOUT_MS,
	type ThinkingLevel,
} from './constants.js';
import { type SearchRequestOptions, buildSearchRequest, getProviderConfig } from './request.js';
import {
	type ApiResponse,
	type RequestMetadata,
	formatErrorResponse,
	formatSearchResult,
	parseSearchResponse,
} from './response.js';

// Re-export ThinkingLevel for use in search tool
export type { ThinkingLevel } from './constants.js';

// ============================================================================
// PROJECT ID RESOLUTION
// ============================================================================

/**
 * Cached project ID for Gemini CLI provider.
 * Retrieved via loadCodeAssist API call.
 */
let geminiCliProjectId: string | null = null;

/**
 * Cached project ID for Antigravity provider.
 * Retrieved via loadCodeAssist API call.
 */
let antigravityProjectId: string | null = null;

/**
 * Endpoints to try for loadCodeAssist (prod first, then fallbacks).
 * Matches OpenCode's ANTIGRAVITY_LOAD_ENDPOINTS order.
 */
const LOAD_CODE_ASSIST_ENDPOINTS = [
	'https://cloudcode-pa.googleapis.com', // prod - best for project resolution
	'https://daily-cloudcode-pa.sandbox.googleapis.com', // daily sandbox
	'https://autopush-cloudcode-pa.sandbox.googleapis.com', // autopush
];

/**
 * Get the project ID for Gemini CLI provider.
 * Calls loadCodeAssist API to retrieve the managed project ID.
 * Result is cached for the session.
 *
 * @param accessToken - Valid OAuth access token
 * @returns Project ID string, or null if not available
 */
async function getGeminiCliProjectId(accessToken: string): Promise<string | null> {
	// Return cached value if available
	if (geminiCliProjectId) {
		return geminiCliProjectId;
	}

	const url = `${GEMINI_CLI_ENDPOINT}/v1internal:loadCodeAssist`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				metadata: {
					ideType: 'IDE_UNSPECIFIED',
					platform: 'PLATFORM_UNSPECIFIED',
					pluginType: 'GEMINI',
				},
			}),
			signal: AbortSignal.timeout(10000),
		});

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		// Extract project ID from response
		if (data.cloudaicompanionProject) {
			geminiCliProjectId = data.cloudaicompanionProject;
			return geminiCliProjectId;
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Get the project ID for Antigravity provider.
 * Calls loadCodeAssist API across multiple endpoints to retrieve the managed project ID.
 * Tries prod first (best for project resolution), then falls back to sandbox endpoints.
 * Result is cached for the session.
 *
 * @param accessToken - Valid OAuth access token
 * @returns Project ID string, or null if not available
 */
async function getAntigravityProjectId(accessToken: string): Promise<string | null> {
	// Return cached value if available
	if (antigravityProjectId) {
		return antigravityProjectId;
	}

	const requestBody = {
		metadata: {
			ideType: 'IDE_UNSPECIFIED',
			platform: 'PLATFORM_UNSPECIFIED',
			pluginType: 'GEMINI',
		},
	};

	// Try each endpoint until one succeeds
	for (const baseEndpoint of LOAD_CODE_ASSIST_ENDPOINTS) {
		try {
			const url = `${baseEndpoint}/v1internal:loadCodeAssist`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
					// Use Gemini CLI style headers for loadCodeAssist (matches OpenCode project.js)
					'User-Agent': 'google-api-nodejs-client/9.15.1',
					'X-Goog-Api-Client': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
					'Client-Metadata': ANTIGRAVITY_HEADERS['Client-Metadata'],
				},
				body: JSON.stringify(requestBody),
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				continue;
			}

			const data = await response.json();

			// Extract project ID - can be string or object with id property
			let projectId: string | null = null;
			if (typeof data.cloudaicompanionProject === 'string' && data.cloudaicompanionProject) {
				projectId = data.cloudaicompanionProject;
			} else if (
				data.cloudaicompanionProject &&
				typeof data.cloudaicompanionProject.id === 'string'
			) {
				projectId = data.cloudaicompanionProject.id;
			}

			if (projectId) {
				antigravityProjectId = projectId;
				return antigravityProjectId;
			}
		} catch {
			// Try next endpoint
		}
	}

	return null;
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Options for search execution
 */
export interface SearchOptions {
	/** Search query string */
	query: string;
	/** Thinking level for Antigravity (ignored for Gemini CLI) */
	thinking?: ThinkingLevel;
}

/**
 * Internal result type with metadata for response formatting
 */
interface SearchResultWithMetadata {
	/** Formatted markdown response */
	result: string;
	/** Whether this was a successful search (not an error) */
	success: boolean;
	/** Provider used */
	provider: ProviderName;
	/** Model used */
	model: string;
	/** Thinking level used */
	thinkingLevel?: ThinkingLevel;
	/** Response time in ms */
	responseTime?: number;
}

// ============================================================================
// SEARCH EXECUTION
// ============================================================================

/**
 * Execute a grounded search request to the Gemini API.
 *
 * @param options - Search options (query + optional thinking level)
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param accessToken - Valid OAuth access token
 * @param endpointOverride - Optional endpoint override (for fallback)
 * @param trackTiming - Whether to track response time
 * @returns Search result with metadata
 */
async function executeGroundedSearchInternal(
	options: SearchOptions,
	provider: ProviderName,
	accessToken: string,
	endpointOverride?: string,
	trackTiming = false,
): Promise<SearchResultWithMetadata> {
	const providerConfig = getProviderConfig(provider);
	const endpoint = endpointOverride ?? providerConfig.endpoint;
	const model = PROVIDER_MODELS[provider];

	// Antigravity: Use static ANTIGRAVITY_HEADERS (matches OpenCode's search.js)
	// Gemini CLI: Use existing randomized headers (different API, was working fine)
	const headers = provider === 'antigravity' ? ANTIGRAVITY_HEADERS : providerConfig.headers;

	// Common metadata
	const baseResult = {
		provider,
		model,
		thinkingLevel: options.thinking,
	};

	// Get project ID (required for API calls)
	let projectId: string | undefined;
	if (provider === 'gemini') {
		const resolvedProjectId = await getGeminiCliProjectId(accessToken);
		if (!resolvedProjectId) {
			return {
				...baseResult,
				success: false,
				result: `## Project Setup Required

Could not retrieve your Gemini project ID.

**To fix:**
1. Ensure you have a valid Google account with Gemini access
2. Try re-authenticating with \`auth --login gemini\`
3. If you're using a Workspace account, set GOOGLE_CLOUD_PROJECT env var`,
			};
		}
		projectId = resolvedProjectId;
	} else if (provider === 'antigravity') {
		// Resolve Antigravity project ID via loadCodeAssist
		// Falls back to ANTIGRAVITY_DEFAULT_PROJECT_ID in wrapProviderRequest if null
		const resolvedProjectId = await getAntigravityProjectId(accessToken);
		if (resolvedProjectId) {
			projectId = resolvedProjectId;
		}
		// Note: Unlike Gemini CLI, we don't fail if project ID is not resolved
		// because Antigravity has a hardcoded fallback that might work
	}

	// Build request body using two-stage orchestration
	const requestOptions: SearchRequestOptions = {
		query: options.query,
		thinking: options.thinking,
	};
	const requestBody = buildSearchRequest(requestOptions, provider, projectId);

	// Build URL
	const url = `${endpoint}/v1internal:generateContent`;

	const startTime = trackTiming ? Date.now() : 0;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				...headers,
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
		});

		const responseTime = trackTiming ? Date.now() - startTime : undefined;

		// Handle HTTP errors
		if (!response.ok) {
			const errorText = await response.text().catch(() => '');
			return {
				...baseResult,
				success: false,
				result: formatErrorResponse(response.status, errorText, provider),
				responseTime,
			};
		}

		// Parse successful response
		const data: ApiResponse = await response.json();

		// Check for API-level errors in response body
		if (data.error) {
			return {
				...baseResult,
				success: false,
				result: formatErrorResponse(
					data.error.code ?? 500,
					data.error.message ?? 'Unknown API error',
					provider,
				),
				responseTime,
			};
		}

		// Parse and format result (metadata will be added by caller)
		const searchResult = parseSearchResponse(data);
		return {
			...baseResult,
			success: true,
			result: formatSearchResult(searchResult),
			responseTime,
		};
	} catch (error) {
		const responseTime = trackTiming ? Date.now() - startTime : undefined;

		// Handle timeout
		if (error instanceof Error && error.name === 'TimeoutError') {
			return {
				...baseResult,
				success: false,
				result: `## Search Timeout

The search request timed out after ${SEARCH_TIMEOUT_MS / 1000} seconds.

**What to do:**
- Try a simpler or more specific query
- Check your internet connection
- Try again in a few moments`,
				responseTime,
			};
		}

		// Handle network errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return {
				...baseResult,
				success: false,
				result: `## Network Error

Could not connect to the ${provider === 'gemini' ? 'Gemini CLI' : 'Antigravity'} API.

**What to do:**
- Check your internet connection
- Verify you can reach Google services
- Try again in a few moments`,
				responseTime,
			};
		}

		// Generic error
		const message = error instanceof Error ? error.message : 'Unknown error';
		return {
			...baseResult,
			success: false,
			result: `## Search Error

An unexpected error occurred.

**Error:** ${message}

**Troubleshooting:**
- Check your internet connection
- Verify your authentication with \`auth --status\`
- Try again or re-authenticate with \`auth --login ${provider}\``,
			responseTime,
		};
	}
}

/**
 * Execute a grounded search request to the Gemini API.
 *
 * @param options - Search options (query + optional thinking level)
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param accessToken - Valid OAuth access token
 * @param endpointOverride - Optional endpoint override (for fallback)
 * @returns Formatted markdown response (success or error)
 * @deprecated Use searchWithFallback for new code
 */
export async function executeGroundedSearch(
	options: SearchOptions,
	provider: ProviderName,
	accessToken: string,
	endpointOverride?: string,
): Promise<string> {
	const result = await executeGroundedSearchInternal(
		options,
		provider,
		accessToken,
		endpointOverride,
	);
	return result.result;
}

// ============================================================================
// SEARCH WITH FALLBACK
// ============================================================================

/**
 * Try Antigravity search.
 * Uses the daily sandbox endpoint (only endpoint with quota for Antigravity OAuth).
 */
async function tryAntigravitySearch(
	options: SearchOptions,
	accessToken: string,
	trackTiming: boolean,
): Promise<SearchResultWithMetadata> {
	const result = await executeGroundedSearchInternal(
		options,
		'antigravity',
		accessToken,
		ANTIGRAVITY_ENDPOINT,
		trackTiming,
	);

	// Check if this was a capacity error that should trigger provider fallback
	if (
		result.result.includes('No capacity available') ||
		result.result.includes('Resource has been exhausted') ||
		result.result.includes('503') ||
		result.result.includes('429')
	) {
		return {
			...result,
			success: false,
			result: `## Antigravity Unavailable

The Antigravity endpoint is currently at capacity.

**What to do:**
- Try again in a few moments
- Use Gemini CLI as fallback: \`auth --default-provider gemini\``,
		};
	}

	return result;
}

/**
 * Add request metadata to a search result.
 */
function addMetadataToResult(
	searchResult: SearchResultWithMetadata,
	fallbackUsed: boolean,
): string {
	if (!searchResult.success) {
		// For error responses, return as-is (no metadata to add)
		return searchResult.result;
	}

	// Build metadata for successful responses
	const metadata: RequestMetadata = {
		provider: searchResult.provider,
		model: searchResult.model,
		thinkingLevel: searchResult.thinkingLevel,
		fallbackUsed,
		responseTime: searchResult.responseTime,
	};

	// Re-parse the result to add metadata
	// Since formatSearchResult already formatted without metadata,
	// we need to insert the Request Details section
	const result = searchResult.result;
	const sourcesIndex = result.indexOf('\n### Sources');
	const queriesIndex = result.indexOf('\n### Search Queries Used');

	// Find insertion point: after Sources section, before Search Queries Used
	// Or at end if neither exists
	const requestDetails = formatRequestDetails(metadata);

	if (queriesIndex !== -1) {
		// Insert before Search Queries Used
		return `${result.slice(0, queriesIndex)}\n\n${requestDetails}${result.slice(queriesIndex)}`;
	}
	if (sourcesIndex !== -1) {
		// Find end of Sources section (look for next section or end)
		const afterSources = result.indexOf('\n\n', sourcesIndex + 1);
		if (afterSources !== -1) {
			return `${result.slice(0, afterSources)}\n\n${requestDetails}${result.slice(afterSources)}`;
		}
	}

	// Append at end
	return `${result}\n\n${requestDetails}`;
}

/**
 * Format request metadata as markdown section.
 * (Local copy to avoid circular import)
 */
function formatRequestDetails(metadata: RequestMetadata): string {
	const lines: string[] = ['### Request Details', ''];

	const providerName = metadata.provider === 'antigravity' ? 'Antigravity' : 'Gemini CLI';
	lines.push(`- **Provider:** ${providerName}`);
	lines.push(`- **Model:** ${metadata.model}`);

	if (metadata.thinkingLevel && metadata.thinkingLevel !== 'none') {
		lines.push(`- **Thinking:** ${metadata.thinkingLevel}`);
	}

	if (metadata.fallbackUsed) {
		lines.push('- **Note:** Fallback provider used');
	}

	if (metadata.responseTime !== undefined) {
		lines.push(`- **Response time:** ${metadata.responseTime}ms`);
	}

	return lines.join('\n');
}

/**
 * Execute a grounded search with provider fallback.
 *
 * Tries the default provider first (from config or token storage).
 * For Antigravity, tries daily sandbox endpoint before falling back to Gemini CLI.
 *
 * Uses getValidAccessToken() from auth module (handles refresh).
 * Loads config for defaults (thinking level, provider preference).
 *
 * @param options - Search options (query + optional thinking level)
 * @returns Formatted markdown response with request metadata
 */
export async function searchWithFallback(options: SearchOptions): Promise<string> {
	// Load config for defaults
	const config = await loadConfig();

	// Apply config defaults if not specified in options
	const effectiveOptions: SearchOptions = {
		query: options.query,
		thinking: options.thinking ?? config.defaultThinking,
	};

	const providers: ProviderName[] = ['antigravity', 'gemini'];

	// Use config default provider, falling back to auth token storage default
	const defaultProvider = config.defaultProvider ?? (await getDefaultProvider());

	// Order providers: default first, then other
	const orderedProviders: ProviderName[] = [
		defaultProvider,
		...providers.filter((p) => p !== defaultProvider),
	];

	let lastError: string | null = null;
	let fallbackUsed = false;
	const attemptedProviders: ProviderName[] = [];

	for (const provider of orderedProviders) {
		try {
			// Get valid access token (handles refresh, returns null if not authenticated)
			const accessToken = await getValidAccessToken(provider);

			if (!accessToken) {
				continue;
			}

			attemptedProviders.push(provider);

			// Check if this is a fallback
			if (attemptedProviders.length > 1) {
				fallbackUsed = true;
			}

			// For Antigravity, use daily sandbox endpoint
			if (provider === 'antigravity') {
				const searchResult = await tryAntigravitySearch(
					effectiveOptions,
					accessToken,
					config.verbose,
				);
				if (searchResult.success) {
					return addMetadataToResult(searchResult, fallbackUsed);
				}
				lastError = searchResult.result;
				continue; // Try next provider (Gemini CLI)
			}

			// For Gemini CLI, single endpoint
			const searchResult = await executeGroundedSearchInternal(
				effectiveOptions,
				provider,
				accessToken,
				undefined,
				config.verbose,
			);

			// Check if result is an auth error that should trigger fallback
			if (searchResult.result.startsWith('## Authentication Error')) {
				lastError = searchResult.result;
				continue;
			}

			return addMetadataToResult(searchResult, fallbackUsed);
		} catch (error) {
			// Token refresh or other auth error - try next provider
			const message = error instanceof Error ? error.message : 'Unknown error';
			lastError = `## Authentication Error

${message}

**To fix:**
Use \`auth --login ${provider}\` to re-authenticate.`;
		}
	}

	// No providers available or all failed
	if (lastError) {
		return lastError;
	}

	return `## No Providers Available

No authenticated providers are available for search.

**To fix:**
1. Run \`auth --login antigravity\` (recommended) or \`auth --login gemini\`
2. Complete the authentication flow
3. Try your search again

**Provider differences:**
- **Antigravity**: gemini-3-flash with thinking (better quality)
- **Gemini CLI**: gemini-2.5-flash without thinking (fallback)`;
}
