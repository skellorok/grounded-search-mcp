/**
 * grounded_search tool for gemini-search-mcp
 * Phase 2: Mock implementation
 * Phase 4: Will call Gemini API with two-stage orchestration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Register the grounded_search tool with the MCP server
 */
export function registerSearchTool(server: McpServer): void {
	server.registerTool(
		'grounded_search',
		{
			title: 'Grounded Search',
			description: 'Search the web using Google Search grounding via Gemini API',
			inputSchema: {
				query: z.string().min(1).max(1000).describe('Search query'),
				model: z.string().optional().default('gemini-3-flash').describe('Gemini model to use'),
				thinking_level: z
					.enum(['none', 'low', 'medium', 'high'])
					.optional()
					.default('medium')
					.describe('Thinking depth for the model'),
			},
		},
		async ({ query, model, thinking_level }) => {
			// Phase 2: Return mock response
			// Phase 4: Will call Gemini API with two-stage orchestration
			const mockResponse = {
				answer: `[MOCK] Search results for: "${query}"`,
				model: model,
				thinking_level: thinking_level,
				sources: [{ title: 'Example Source', url: 'https://example.com' }],
				searchQueries: [query],
			};

			return {
				content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }],
			};
		},
	);
}
