/**
 * grounded_search tool for grounded-search-mcp
 *
 * Performs Google-grounded web searches via Gemini API.
 * Returns markdown-formatted results with sources and search queries.
 *
 * Provider differences:
 * - Antigravity (default): gemini-2.5-flash via sandbox endpoint
 * - Gemini CLI (fallback): gemini-2.5-flash via production endpoint
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
				thinking: z
					.enum(['high', 'low', 'none'])
					.optional()
					.describe(
						'Thinking level (currently inactive — gemini-2.5-flash does not support thinkingConfig). Retained for future model support.',
					),
			},
		},
		async (args) => {
			// Execute search with fallback (handles token refresh and auth errors internally)
			const result = await searchWithFallback({
				query: args.query,
				thinking: args.thinking,
			});

			// Determine if result is an error based on heading
			const isError =
				result.startsWith('## Authentication') ||
				result.startsWith('## Search Error') ||
				result.startsWith('## Rate Limited') ||
				result.startsWith('## No Providers') ||
				result.startsWith('## Network Error') ||
				result.startsWith('## Search Timeout') ||
				result.startsWith('## Not Authenticated') ||
				result.startsWith('## Antigravity Unavailable');

			return {
				content: [{ type: 'text', text: result }],
				isError,
			};
		},
	);
}
