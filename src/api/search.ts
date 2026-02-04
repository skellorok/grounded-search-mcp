/**
 * Search execution module for gemini-search-mcp
 *
 * Implements grounded search with provider fallback.
 * Uses two-stage orchestration pattern from request.ts.
 */

import { getDefaultProvider, getValidAccessToken } from '../auth/index.js';
import type { ProviderName } from '../auth/types.js';
import { GEMINI_CLI_ENDPOINT, SEARCH_TIMEOUT_MS } from './constants.js';
import { buildSearchRequest, getProviderConfig } from './request.js';
import {
	type ApiResponse,
	formatErrorResponse,
	formatSearchResult,
	parseSearchResponse,
} from './response.js';

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

// No additional options needed - gemini-2.5-flash uses fixed config

// ============================================================================
// SEARCH EXECUTION
// ============================================================================

/**
 * Execute a grounded search request to the Gemini API.
 *
 * @param query - Search query string
 * @param provider - Target provider ('gemini' | 'antigravity')
 * @param accessToken - Valid OAuth access token
 * @returns Formatted markdown response (success or error)
 */
export async function executeGroundedSearch(
	query: string,
	provider: ProviderName,
	accessToken: string,
): Promise<string> {
	const config = getProviderConfig(provider);

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
	const requestBody = buildSearchRequest({ query }, provider, projectId);

	// Build URL
	const url = `${config.endpoint}/v1internal:generateContent`;

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
 * Execute a grounded search with provider fallback.
 *
 * Tries the default provider first. If it fails and another provider
 * is configured, tries that one. Returns informative error if both fail
 * or no providers are available.
 *
 * Uses getValidAccessToken() from auth module (handles refresh).
 *
 * @param query - Search query string
 * @returns Formatted markdown response
 */
export async function searchWithFallback(query: string): Promise<string> {
	const providers: ProviderName[] = ['gemini', 'antigravity'];
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

			// Should not happen after isAuthenticated check, but handle gracefully
			if (!accessToken) {
				continue;
			}

			// Execute search
			const result = await executeGroundedSearch(query, provider, accessToken);

			// Check if result is an auth error that should trigger fallback
			// (Token may have been invalidated server-side after our check)
			if (result.startsWith('## Authentication Error')) {
				lastError = result;
				continue; // Try next provider
			}

			return result;
		} catch (error) {
			// Token refresh or other auth error - try next provider
			const message = error instanceof Error ? error.message : 'Unknown error';
			lastError = `## Authentication Error

${message}

**To fix:**
Use \`auth --login ${provider}\` to re-authenticate.`;
			// Continue to try next provider
		}
	}

	// No providers available or all failed
	if (lastError) {
		return lastError;
	}

	return `## No Providers Available

No authenticated providers are available for search.

**To fix:**
1. Run \`auth --login gemini\` or \`auth --login antigravity\`
2. Complete the authentication flow
3. Try your search again

**Note:** You need at least one authenticated provider to use grounded search.`;
}
