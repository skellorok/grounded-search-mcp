/**
 * Response parsing module for gemini-search-mcp
 *
 * Parses Gemini API responses and formats results as markdown.
 * Extracts grounding metadata (sources, search queries) from responses.
 */

import type { ProviderName } from '../auth/types.js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Source citation from grounding metadata
 */
export interface Source {
	title: string;
	url: string;
}

/**
 * Parsed search result
 */
export interface SearchResult {
	text: string;
	sources: Source[];
	searchQueries: string[];
}

/**
 * Inner response structure (inside the 'response' wrapper)
 */
interface InnerResponse {
	candidates?: Array<{
		content?: {
			parts?: Array<{ text?: string }>;
		};
		groundingMetadata?: {
			groundingChunks?: Array<{
				web?: {
					title?: string;
					uri?: string;
				};
			}>;
			webSearchQueries?: string[];
		};
	}>;
}

/**
 * Raw API response structure from Gemini (wrapped format)
 */
export interface ApiResponse {
	response?: InnerResponse;
	traceId?: string;
	error?: {
		code?: number;
		message?: string;
		status?: string;
	};
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse a Gemini API response into a SearchResult.
 *
 * Extracts:
 * - Text from candidates[0].content.parts[].text
 * - Sources from candidates[0].groundingMetadata.groundingChunks[].web
 * - Search queries from candidates[0].groundingMetadata.webSearchQueries
 *
 * Handles missing/undefined gracefully and deduplicates sources by URL.
 */
export function parseSearchResponse(data: ApiResponse): SearchResult {
	// Unwrap the response (Gemini CLI format has response wrapper)
	const candidate = data.response?.candidates?.[0];

	// Extract text from all parts
	const parts = candidate?.content?.parts ?? [];
	const text = parts
		.map((part) => part.text ?? '')
		.filter((t) => t.length > 0)
		.join('\n\n');

	// Extract sources from grounding chunks, deduplicate by URL
	const groundingChunks = candidate?.groundingMetadata?.groundingChunks ?? [];
	const seenUrls = new Set<string>();
	const sources: Source[] = [];

	for (const chunk of groundingChunks) {
		const web = chunk.web;
		if (web?.uri && !seenUrls.has(web.uri)) {
			seenUrls.add(web.uri);
			sources.push({
				title: web.title ?? 'Untitled',
				url: web.uri,
			});
		}
	}

	// Extract search queries
	const searchQueries = candidate?.groundingMetadata?.webSearchQueries ?? [];

	return {
		text,
		sources,
		searchQueries,
	};
}

// ============================================================================
// MARKDOWN FORMATTING
// ============================================================================

/**
 * Extract domain from a URL for display.
 */
function extractDomain(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

/**
 * Format a SearchResult as markdown.
 *
 * Format:
 * ```
 * ## Search Results
 *
 * {result.text}
 *
 * ### Sources
 * - [Title](url) (domain.com)
 * ...
 *
 * ### Search Queries Used
 * - "query 1"
 * - "query 2"
 * ```
 *
 * Sections are omitted if empty.
 */
export function formatSearchResult(result: SearchResult): string {
	const sections: string[] = [];

	// Search Results section (always included, even if empty)
	sections.push('## Search Results\n');
	sections.push(result.text || '_No results found._');

	// Sources section (only if sources exist)
	if (result.sources.length > 0) {
		sections.push('\n### Sources\n');
		for (const source of result.sources) {
			const domain = extractDomain(source.url);
			sections.push(`- [${source.title}](${source.url}) (${domain})`);
		}
	}

	// Search Queries Used section (only if queries exist)
	if (result.searchQueries.length > 0) {
		sections.push('\n### Search Queries Used\n');
		for (const query of result.searchQueries) {
			sections.push(`- "${query}"`);
		}
	}

	return sections.join('\n');
}

// ============================================================================
// ERROR FORMATTING
// ============================================================================

/**
 * Format an error response as markdown.
 *
 * Provides informative error messages based on status code:
 * - 401/403: Authentication error with re-auth instructions
 * - 429: Rate limited with guidance
 * - Other: Generic error with troubleshooting tips
 *
 * NO auto-triggered auth flow (per CONTEXT.md) - inform only.
 */
export function formatErrorResponse(
	status: number,
	errorText: string,
	provider: ProviderName,
): string {
	if (status === 401 || status === 403) {
		return `## Authentication Error

Your ${provider === 'gemini' ? 'Gemini CLI' : 'Antigravity'} credentials are invalid or expired.

**Error:** ${errorText || 'Authentication failed'}

**To fix:**
1. Use \`auth --login ${provider}\` to re-authenticate
2. Follow the instructions to complete authentication
3. Try your search again`;
	}

	if (status === 429) {
		return `## Rate Limited

The ${provider === 'gemini' ? 'Gemini CLI' : 'Antigravity'} API has rate limited your requests.

**Error:** ${errorText || 'Too many requests'}

**What to do:**
- Wait a few minutes before trying again
- If you have another provider configured, try switching with \`auth --default-provider <provider>\`
- Consider reducing the frequency of searches`;
	}

	// Generic error
	return `## Search Error

An error occurred while searching.

**Status:** ${status}
**Error:** ${errorText || 'Unknown error'}

**Troubleshooting:**
- Check your internet connection
- Verify your authentication is still valid with \`auth --status\`
- If the problem persists, try re-authenticating with \`auth --login ${provider}\``;
}
