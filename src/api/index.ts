/**
 * API client for gemini-search-mcp
 * Phase 2: Placeholder implementation returning mock responses
 * Phase 4: Will implement actual Gemini API calls
 */

import type { SearchResponse } from '../types/index.js';

export interface SearchOptions {
	query: string;
	model?: string;
	thinking_level?: string;
}

/**
 * Perform a grounded search via the Gemini API
 * @param options - Search parameters
 * @returns Search response with answer, sources, and queries
 */
export async function search(options: SearchOptions): Promise<SearchResponse> {
	const { query, model = 'gemini-3-flash', thinking_level = 'medium' } = options;

	// Phase 2: Return mock response
	// Phase 4: Will call actual Gemini API with two-stage orchestration
	return {
		answer: `[MOCK] Search results for: "${query}"`,
		model,
		thinking_level,
		sources: [{ title: 'Example Source', url: 'https://example.com' }],
		searchQueries: [query],
	};
}
