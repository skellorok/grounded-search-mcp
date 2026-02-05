/**
 * URL resolution tests for grounded-search-mcp
 *
 * Tests:
 * - resolveRedirectUrl redirect resolution
 * - resolveRedirectUrl timeout handling (returns original URL)
 * - resolveRedirectUrl error handling (returns original URL)
 * - resolveRedirectUrls parallel resolution
 * - URL caching behavior
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	clearUrlCache,
	getUrlCacheSize,
	resolveRedirectUrl,
	resolveRedirectUrls,
} from './url-resolver.js';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('resolveRedirectUrl', () => {
	beforeEach(() => {
		clearUrlCache();
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('redirect resolution', () => {
		it('resolves redirect URL to final destination', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc123';
			const finalUrl = 'https://en.wikipedia.org/wiki/Example';

			mockFetch.mockResolvedValueOnce({
				url: finalUrl,
				ok: true,
			});

			const result = await resolveRedirectUrl(redirectUrl);

			expect(result).toBe(finalUrl);
			expect(mockFetch).toHaveBeenCalledWith(redirectUrl, {
				method: 'HEAD',
				redirect: 'follow',
				signal: expect.any(AbortSignal),
			});
		});

		it('skips non-redirect URLs without making request', async () => {
			const directUrl = 'https://example.com/page';

			const result = await resolveRedirectUrl(directUrl);

			expect(result).toBe(directUrl);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('uses HEAD method for efficiency', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/xyz789';

			mockFetch.mockResolvedValueOnce({
				url: 'https://cnn.com/article',
				ok: true,
			});

			await resolveRedirectUrl(redirectUrl);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'HEAD' }),
			);
		});

		it('follows redirects via redirect: follow option', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test';

			mockFetch.mockResolvedValueOnce({
				url: 'https://final.destination.com',
				ok: true,
			});

			await resolveRedirectUrl(redirectUrl);

			expect(mockFetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ redirect: 'follow' }),
			);
		});
	});

	describe('timeout handling', () => {
		it('returns original URL on timeout', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/slow';

			// Simulate timeout error
			mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'TimeoutError'));

			const result = await resolveRedirectUrl(redirectUrl);

			expect(result).toBe(redirectUrl);
		});
	});

	describe('error handling', () => {
		it('returns original URL on network error', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/broken';

			mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

			const result = await resolveRedirectUrl(redirectUrl);

			expect(result).toBe(redirectUrl);
		});

		it('returns original URL on any fetch error', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/error';

			mockFetch.mockRejectedValueOnce(new Error('Unknown error'));

			const result = await resolveRedirectUrl(redirectUrl);

			expect(result).toBe(redirectUrl);
		});
	});

	describe('caching behavior', () => {
		it('caches resolved URLs', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/cached';
			const finalUrl = 'https://cached.example.com';

			mockFetch.mockResolvedValueOnce({
				url: finalUrl,
				ok: true,
			});

			// First call - should fetch
			await resolveRedirectUrl(redirectUrl);
			expect(mockFetch).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const result = await resolveRedirectUrl(redirectUrl);
			expect(result).toBe(finalUrl);
			expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
		});

		it('returns cached URL immediately', async () => {
			const redirectUrl = 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/quick';
			const finalUrl = 'https://quick.example.com';

			mockFetch.mockResolvedValueOnce({
				url: finalUrl,
				ok: true,
			});

			await resolveRedirectUrl(redirectUrl);
			const result = await resolveRedirectUrl(redirectUrl);

			expect(result).toBe(finalUrl);
		});

		it('increases cache size for each unique URL', async () => {
			expect(getUrlCacheSize()).toBe(0);

			mockFetch
				.mockResolvedValueOnce({ url: 'https://a.com', ok: true })
				.mockResolvedValueOnce({ url: 'https://b.com', ok: true });

			await resolveRedirectUrl('https://vertexaisearch.cloud.google.com/grounding-api-redirect/a');
			expect(getUrlCacheSize()).toBe(1);

			await resolveRedirectUrl('https://vertexaisearch.cloud.google.com/grounding-api-redirect/b');
			expect(getUrlCacheSize()).toBe(2);
		});

		it('clearUrlCache clears the cache', async () => {
			mockFetch.mockResolvedValueOnce({
				url: 'https://cleared.com',
				ok: true,
			});

			await resolveRedirectUrl(
				'https://vertexaisearch.cloud.google.com/grounding-api-redirect/clear',
			);
			expect(getUrlCacheSize()).toBe(1);

			clearUrlCache();
			expect(getUrlCacheSize()).toBe(0);
		});
	});
});

describe('resolveRedirectUrls', () => {
	beforeEach(() => {
		clearUrlCache();
		mockFetch.mockReset();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('parallel resolution', () => {
		it('resolves all URLs in parallel', async () => {
			const sources = [
				{
					title: 'Source 1',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/1',
				},
				{
					title: 'Source 2',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/2',
				},
			];

			mockFetch
				.mockResolvedValueOnce({ url: 'https://resolved1.com', ok: true })
				.mockResolvedValueOnce({ url: 'https://resolved2.com', ok: true });

			const result = await resolveRedirectUrls(sources);

			expect(result).toHaveLength(2);
			expect(result[0].url).toBe('https://resolved1.com');
			expect(result[1].url).toBe('https://resolved2.com');
		});

		it('preserves source titles', async () => {
			const sources = [
				{
					title: 'Wikipedia Article',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/wiki',
				},
			];

			mockFetch.mockResolvedValueOnce({
				url: 'https://en.wikipedia.org/wiki/Article',
				ok: true,
			});

			const result = await resolveRedirectUrls(sources);

			expect(result[0].title).toBe('Wikipedia Article');
		});

		it('returns empty array for empty input', async () => {
			const result = await resolveRedirectUrls([]);

			expect(result).toEqual([]);
			expect(mockFetch).not.toHaveBeenCalled();
		});

		it('handles mixed success and failure', async () => {
			const sources = [
				{
					title: 'Success',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/success',
				},
				{
					title: 'Failure',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/fail',
				},
			];

			mockFetch
				.mockResolvedValueOnce({ url: 'https://success.com', ok: true })
				.mockRejectedValueOnce(new Error('Network error'));

			const result = await resolveRedirectUrls(sources);

			expect(result[0].url).toBe('https://success.com');
			// Failure returns original URL (graceful degradation)
			expect(result[1].url).toBe(
				'https://vertexaisearch.cloud.google.com/grounding-api-redirect/fail',
			);
		});
	});

	describe('source preservation', () => {
		it('returns new array without mutating original', async () => {
			const sources = [
				{
					title: 'Original',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/orig',
				},
			];

			mockFetch.mockResolvedValueOnce({
				url: 'https://new.url.com',
				ok: true,
			});

			const result = await resolveRedirectUrls(sources);

			// Result should have new URL
			expect(result[0].url).toBe('https://new.url.com');
			// Original should be unchanged
			expect(sources[0].url).toBe(
				'https://vertexaisearch.cloud.google.com/grounding-api-redirect/orig',
			);
		});

		it('handles sources with non-redirect URLs', async () => {
			const sources = [
				{ title: 'Direct URL', url: 'https://direct.example.com/page' },
				{
					title: 'Redirect URL',
					url: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/redir',
				},
			];

			mockFetch.mockResolvedValueOnce({
				url: 'https://resolved.com',
				ok: true,
			});

			const result = await resolveRedirectUrls(sources);

			// Direct URL should be unchanged
			expect(result[0].url).toBe('https://direct.example.com/page');
			// Redirect URL should be resolved
			expect(result[1].url).toBe('https://resolved.com');
			// Only one fetch call (for the redirect URL)
			expect(mockFetch).toHaveBeenCalledTimes(1);
		});
	});
});
