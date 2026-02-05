/**
 * URL resolution module for grounded-search-mcp
 *
 * Resolves Google redirect URLs to actual destination URLs.
 * The Gemini API returns redirect URLs (vertexaisearch.cloud.google.com/grounding-api-redirect/...)
 * instead of actual URLs. This module resolves them via HTTP HEAD requests.
 */

import type { Source } from './response.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Timeout for URL resolution (5 seconds per URL) */
const URL_RESOLUTION_TIMEOUT_MS = 5000;

// ============================================================================
// CACHE
// ============================================================================

/**
 * In-memory cache for resolved URLs.
 * No TTL needed (URLs don't change during session).
 * Cleared on process restart (no persistence needed).
 */
const urlCache = new Map<string, string>();

/**
 * Clear the URL cache (for testing purposes).
 */
export function clearUrlCache(): void {
	urlCache.clear();
}

/**
 * Get the current cache size (for testing purposes).
 */
export function getUrlCacheSize(): number {
	return urlCache.size;
}

// ============================================================================
// URL RESOLUTION
// ============================================================================

/**
 * Resolve a single redirect URL to its final destination.
 *
 * Makes HTTP HEAD request to the redirect URL and follows redirects.
 * Returns the final URL from response.url.
 *
 * On error/timeout: returns original URL (graceful degradation).
 *
 * @param redirectUrl - The redirect URL to resolve
 * @returns Final destination URL, or original URL on error
 */
export async function resolveRedirectUrl(redirectUrl: string): Promise<string> {
	// Return from cache if available
	const cached = urlCache.get(redirectUrl);
	if (cached) {
		return cached;
	}

	// Skip non-redirect URLs (optimization)
	if (!redirectUrl.includes('grounding-api-redirect')) {
		return redirectUrl;
	}

	try {
		const response = await fetch(redirectUrl, {
			method: 'HEAD',
			redirect: 'follow',
			signal: AbortSignal.timeout(URL_RESOLUTION_TIMEOUT_MS),
		});

		// Get the final URL after redirects
		const resolvedUrl = response.url;

		// Cache the result
		urlCache.set(redirectUrl, resolvedUrl);

		return resolvedUrl;
	} catch {
		// On any error (timeout, network, etc.), return original URL
		// This ensures graceful degradation - we don't break the response
		return redirectUrl;
	}
}

/**
 * Resolve redirect URLs for an array of sources.
 *
 * Resolves all URLs in parallel using Promise.all.
 * Returns new Source array with resolved URLs.
 * Preserves title and other properties.
 *
 * @param sources - Array of Source objects with potentially redirect URLs
 * @returns New Source array with resolved URLs
 */
export async function resolveRedirectUrls(sources: Source[]): Promise<Source[]> {
	if (sources.length === 0) {
		return sources;
	}

	// Resolve all URLs in parallel
	const resolvedUrls = await Promise.all(sources.map((source) => resolveRedirectUrl(source.url)));

	// Return new Source array with resolved URLs
	return sources.map((source, index) => ({
		...source,
		url: resolvedUrls[index],
	}));
}
