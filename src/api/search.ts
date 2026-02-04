/**
 * Search execution module for gemini-search-mcp
 *
 * Implements grounded search with provider fallback.
 * Uses two-stage orchestration pattern from request.ts.
 */

import { getDefaultProvider, getValidAccessToken } from '../auth/index.js';
import type { ProviderName } from '../auth/types.js';
import {
	ANTIGRAVITY_ENDPOINT_FALLBACKS,
	GEMINI_CLI_ENDPOINT,
	SEARCH_TIMEOUT_MS,
	type ThinkingLevel,
} from './constants.js';
import { type SearchRequestOptions, buildSearchRequest, getProviderConfig } from './request.js';
import {
	type ApiResponse,
	formatErrorResponse,
	formatSearchResult,
	parseSearchResponse,
} from './response.js';

// Re-export ThinkingLevel for use in search tool
export type { ThinkingLevel } from './constants.js';

// ============================================================================
// PROJECT ID RESOLUTION (Gemini CLI)
// ============================================================================

/**
 * Cached project ID for Gemini CLI provider.
 * Retrieved via loadCodeAssist API call.
 */
let geminiCliProjectId: string | null = null;

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
 * @returns Formatted markdown response (success or error)
 */
export async function executeGroundedSearch(
	options: SearchOptions,
	provider: ProviderName,
	accessToken: string,
	endpointOverride?: string,
): Promise<string> {
	const config = getProviderConfig(provider);
	const endpoint = endpointOverride ?? config.endpoint;

	// Get project ID for Gemini CLI (required for API calls)
	let projectId: string | undefined;
	if (provider === 'gemini') {
		const resolvedProjectId = await getGeminiCliProjectId(accessToken);
		if (!resolvedProjectId) {
			return `## Project Setup Required

Could not retrieve your Gemini project ID.

**To fix:**
1. Ensure you have a valid Google account with Gemini access
2. Try re-authenticating with \`auth --login gemini\`
3. If you're using a Workspace account, set GOOGLE_CLOUD_PROJECT env var`;
		}
		projectId = resolvedProjectId;
	}

	// Build request body using two-stage orchestration
	const requestOptions: SearchRequestOptions = {
		query: options.query,
		thinking: options.thinking,
	};
	const requestBody = buildSearchRequest(requestOptions, provider, projectId);

	// Build URL
	const url = `${endpoint}/v1internal:generateContent`;

	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
				...config.headers,
			},
			body: JSON.stringify(requestBody),
			signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
		});

		// Handle HTTP errors
		if (!response.ok) {
			const errorText = await response.text().catch(() => '');
			return formatErrorResponse(response.status, errorText, provider);
		}

		// Parse successful response
		const data: ApiResponse = await response.json();

		// Check for API-level errors in response body
		if (data.error) {
			return formatErrorResponse(
				data.error.code ?? 500,
				data.error.message ?? 'Unknown API error',
				provider,
			);
		}

		// Parse and format result
		const result = parseSearchResponse(data);
		return formatSearchResult(result);
	} catch (error) {
		// Handle timeout
		if (error instanceof Error && error.name === 'TimeoutError') {
			return `## Search Timeout

The search request timed out after ${SEARCH_TIMEOUT_MS / 1000} seconds.

**What to do:**
- Try a simpler or more specific query
- Check your internet connection
- Try again in a few moments`;
		}

		// Handle network errors
		if (error instanceof TypeError && error.message.includes('fetch')) {
			return `## Network Error

Could not connect to the ${provider === 'gemini' ? 'Gemini CLI' : 'Antigravity'} API.

**What to do:**
- Check your internet connection
- Verify you can reach Google services
- Try again in a few moments`;
		}

		// Generic error
		const message = error instanceof Error ? error.message : 'Unknown error';
		return `## Search Error

An unexpected error occurred.

**Error:** ${message}

**Troubleshooting:**
- Check your internet connection
- Verify your authentication with \`auth --status\`
- Try again or re-authenticate with \`auth --login ${provider}\``;
	}
}

// ============================================================================
// SEARCH WITH FALLBACK
// ============================================================================

/**
 * Try Antigravity search with endpoint fallback.
 * Tries each endpoint in ANTIGRAVITY_ENDPOINT_FALLBACKS until one works.
 */
async function tryAntigravityWithFallback(
	options: SearchOptions,
	accessToken: string,
): Promise<{ success: boolean; result: string }> {
	for (const endpoint of ANTIGRAVITY_ENDPOINT_FALLBACKS) {
		const result = await executeGroundedSearch(options, 'antigravity', accessToken, endpoint);

		// Check if this was a capacity/quota error that should trigger endpoint fallback
		if (
			result.includes('No capacity available') ||
			result.includes('Resource has been exhausted') ||
			result.includes('503') ||
			result.includes('429')
		) {
			// Try next endpoint
			continue;
		}

		return { success: true, result };
	}

	// All endpoints exhausted
	return {
		success: false,
		result: `## Antigravity Unavailable

All Antigravity endpoints are currently at capacity.

**What to do:**
- Try again in a few moments
- Use Gemini CLI as fallback: \`auth --default-provider gemini\``,
	};
}

/**
 * Execute a grounded search with provider fallback.
 *
 * Tries the default provider first (Antigravity by default).
 * For Antigravity, tries multiple endpoints before falling back to Gemini CLI.
 *
 * Uses getValidAccessToken() from auth module (handles refresh).
 *
 * @param options - Search options (query + optional thinking level)
 * @returns Formatted markdown response
 */
export async function searchWithFallback(options: SearchOptions): Promise<string> {
	const providers: ProviderName[] = ['antigravity', 'gemini'];
	const defaultProvider = await getDefaultProvider();

	// Order providers: default first, then other
	const orderedProviders: ProviderName[] = [
		defaultProvider,
		...providers.filter((p) => p !== defaultProvider),
	];

	let lastError: string | null = null;

	for (const provider of orderedProviders) {
		try {
			// Get valid access token (handles refresh, returns null if not authenticated)
			const accessToken = await getValidAccessToken(provider);

			if (!accessToken) {
				continue;
			}

			// For Antigravity, try endpoint fallback
			if (provider === 'antigravity') {
				const { success, result } = await tryAntigravityWithFallback(options, accessToken);
				if (success) {
					return result;
				}
				lastError = result;
				continue; // Try next provider (Gemini CLI)
			}

			// For Gemini CLI, single endpoint
			const result = await executeGroundedSearch(options, provider, accessToken);

			// Check if result is an auth error that should trigger fallback
			if (result.startsWith('## Authentication Error')) {
				lastError = result;
				continue;
			}

			return result;
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
