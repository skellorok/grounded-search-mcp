/**
 * Response formatting validation tests for gemini-search-mcp
 *
 * Tests:
 * - formatErrorResponse for 401/403/429 and other status codes
 * - formatSearchResult with sources
 * - formatSearchResult with empty result
 * - parseSearchResponse source deduplication
 */

import { describe, expect, it } from 'vitest';
import {
	type ApiResponse,
	formatErrorResponse,
	formatSearchResult,
	parseSearchResponse,
} from './response.js';

describe('formatErrorResponse', () => {
	describe('401 status', () => {
		it('contains ## Authentication Error heading', () => {
			const result = formatErrorResponse(401, 'Unauthorized', 'gemini');
			expect(result).toContain('## Authentication Error');
		});

		it('contains provider-specific re-auth instructions for Gemini CLI', () => {
			const result = formatErrorResponse(401, 'Token expired', 'gemini');
			expect(result).toContain('Gemini CLI');
			expect(result).toContain('auth --login gemini');
		});

		it('contains provider-specific re-auth instructions for Antigravity', () => {
			const result = formatErrorResponse(401, 'Token expired', 'antigravity');
			expect(result).toContain('Antigravity');
			expect(result).toContain('auth --login antigravity');
		});

		it('contains **To fix:** section', () => {
			const result = formatErrorResponse(401, 'Unauthorized', 'gemini');
			expect(result).toContain('**To fix:**');
		});
	});

	describe('403 status', () => {
		it('contains ## Authentication Error heading (same as 401)', () => {
			const result = formatErrorResponse(403, 'Forbidden', 'gemini');
			expect(result).toContain('## Authentication Error');
		});

		it('contains re-auth instructions', () => {
			const result = formatErrorResponse(403, 'Access denied', 'antigravity');
			expect(result).toContain('auth --login antigravity');
		});
	});

	describe('429 status', () => {
		it('contains ## Rate Limited heading', () => {
			const result = formatErrorResponse(429, 'Too many requests', 'gemini');
			expect(result).toContain('## Rate Limited');
		});

		it('contains wait suggestion', () => {
			const result = formatErrorResponse(429, 'Quota exceeded', 'gemini');
			expect(result).toContain('Wait a few minutes');
		});

		it('suggests provider fallback with auth --default-provider', () => {
			const result = formatErrorResponse(429, 'Rate limited', 'antigravity');
			expect(result).toContain('auth --default-provider');
		});
	});

	describe('other status codes', () => {
		it('contains ## Search Error heading', () => {
			const result = formatErrorResponse(500, 'Internal server error', 'gemini');
			expect(result).toContain('## Search Error');
		});

		it('includes status code in error', () => {
			const result = formatErrorResponse(503, 'Service unavailable', 'gemini');
			expect(result).toContain('503');
		});

		it('contains troubleshooting steps', () => {
			const result = formatErrorResponse(500, 'Unknown error', 'antigravity');
			expect(result).toContain('Troubleshooting');
			expect(result).toContain('auth --status');
		});
	});

	describe('error message inclusion', () => {
		it('includes error text in output', () => {
			const result = formatErrorResponse(500, 'Specific error message', 'gemini');
			expect(result).toContain('Specific error message');
		});

		it('handles empty error text gracefully', () => {
			const result = formatErrorResponse(401, '', 'gemini');
			expect(result).toContain('Authentication failed');
		});
	});
});

describe('formatSearchResult', () => {
	describe('with sources', () => {
		it('formats sources as markdown links', () => {
			const result = formatSearchResult({
				text: 'Search result text',
				sources: [{ title: 'Example Site', url: 'https://example.com/page' }],
				searchQueries: [],
			});

			expect(result).toContain('[Example Site](https://example.com/page)');
		});

		it('extracts domain correctly', () => {
			const result = formatSearchResult({
				text: 'Text',
				sources: [{ title: 'Test', url: 'https://www.example.com/path/to/page?query=1' }],
				searchQueries: [],
			});

			expect(result).toContain('(www.example.com)');
		});

		it('includes Sources section heading', () => {
			const result = formatSearchResult({
				text: 'Text',
				sources: [{ title: 'Test', url: 'https://example.com' }],
				searchQueries: [],
			});

			expect(result).toContain('### Sources');
		});

		it('includes all sources', () => {
			const result = formatSearchResult({
				text: 'Text',
				sources: [
					{ title: 'Source 1', url: 'https://source1.com' },
					{ title: 'Source 2', url: 'https://source2.com' },
					{ title: 'Source 3', url: 'https://source3.com' },
				],
				searchQueries: [],
			});

			expect(result).toContain('[Source 1]');
			expect(result).toContain('[Source 2]');
			expect(result).toContain('[Source 3]');
		});
	});

	describe('with empty result', () => {
		it('returns "_No results found._" message', () => {
			const result = formatSearchResult({
				text: '',
				sources: [],
				searchQueries: [],
			});

			expect(result).toContain('_No results found._');
		});

		it('still includes ## Search Results heading', () => {
			const result = formatSearchResult({
				text: '',
				sources: [],
				searchQueries: [],
			});

			expect(result).toContain('## Search Results');
		});

		it('omits Sources section when no sources', () => {
			const result = formatSearchResult({
				text: '',
				sources: [],
				searchQueries: [],
			});

			expect(result).not.toContain('### Sources');
		});
	});

	describe('with search queries', () => {
		it('includes Search Queries Used section', () => {
			const result = formatSearchResult({
				text: 'Text',
				sources: [],
				searchQueries: ['query 1', 'query 2'],
			});

			expect(result).toContain('### Search Queries Used');
			expect(result).toContain('"query 1"');
			expect(result).toContain('"query 2"');
		});
	});

	describe('with metadata', () => {
		it('includes Request Details section', () => {
			const result = formatSearchResult(
				{
					text: 'Text',
					sources: [],
					searchQueries: [],
				},
				{
					provider: 'gemini',
					model: 'gemini-2.5-flash',
				},
			);

			expect(result).toContain('### Request Details');
			expect(result).toContain('Gemini CLI');
			expect(result).toContain('gemini-2.5-flash');
		});

		it('shows fallback used note when applicable', () => {
			const result = formatSearchResult(
				{
					text: 'Text',
					sources: [],
					searchQueries: [],
				},
				{
					provider: 'antigravity',
					model: 'gemini-3-flash',
					fallbackUsed: true,
				},
			);

			expect(result).toContain('Fallback provider used');
		});
	});
});

describe('parseSearchResponse', () => {
	it('extracts text from parts', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: {
							parts: [{ text: 'First part' }, { text: 'Second part' }],
						},
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.text).toBe('First part\n\nSecond part');
	});

	it('deduplicates sources by URL', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: {
							parts: [{ text: 'Text' }],
						},
						groundingMetadata: {
							groundingChunks: [
								{ web: { title: 'Title 1', uri: 'https://example.com/page' } },
								{ web: { title: 'Title 2', uri: 'https://example.com/page' } }, // Duplicate URL
								{ web: { title: 'Title 3', uri: 'https://other.com/page' } },
							],
						},
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		// Should have only 2 sources (deduplicated by URL)
		expect(result.sources).toHaveLength(2);
		expect(result.sources[0].url).toBe('https://example.com/page');
		expect(result.sources[1].url).toBe('https://other.com/page');
	});

	it('keeps first title when deduplicating', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: { parts: [{ text: 'Text' }] },
						groundingMetadata: {
							groundingChunks: [
								{ web: { title: 'First Title', uri: 'https://example.com' } },
								{ web: { title: 'Second Title', uri: 'https://example.com' } },
							],
						},
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.sources).toHaveLength(1);
		expect(result.sources[0].title).toBe('First Title');
	});

	it('extracts search queries', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: { parts: [{ text: 'Text' }] },
						groundingMetadata: {
							webSearchQueries: ['query 1', 'query 2'],
						},
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.searchQueries).toEqual(['query 1', 'query 2']);
	});

	it('handles missing grounding metadata gracefully', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: { parts: [{ text: 'Text' }] },
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.text).toBe('Text');
		expect(result.sources).toEqual([]);
		expect(result.searchQueries).toEqual([]);
	});

	it('handles missing candidates gracefully', () => {
		const apiResponse: ApiResponse = {
			response: {},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.text).toBe('');
		expect(result.sources).toEqual([]);
		expect(result.searchQueries).toEqual([]);
	});

	it('uses "Untitled" for sources without title', () => {
		const apiResponse: ApiResponse = {
			response: {
				candidates: [
					{
						content: { parts: [{ text: 'Text' }] },
						groundingMetadata: {
							groundingChunks: [{ web: { uri: 'https://example.com' } }],
						},
					},
				],
			},
		};

		const result = parseSearchResponse(apiResponse);

		expect(result.sources[0].title).toBe('Untitled');
	});
});
