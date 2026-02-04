/**
 * grounded_search tool for gemini-search-mcp
 *
 * Performs Google-grounded web searches via Gemini API.
 * Returns markdown-formatted results with sources and search queries.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchWithFallback } from '../api/index.js';

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
			},
		},
		async (args) => {
			// Execute search with fallback (handles token refresh and auth errors internally)
			const result = await searchWithFallback(args.query);

			// Determine if result is an error based on heading
			const isError =
				result.startsWith('## Authentication') ||
				result.startsWith('## Search Error') ||
				result.startsWith('## Rate Limited') ||
				result.startsWith('## No Providers') ||
				result.startsWith('## Network Error') ||
				result.startsWith('## Search Timeout') ||
				result.startsWith('## Not Authenticated');

			return {
				content: [{ type: 'text', text: result }],
				isError,
			};
		},
	);
}
