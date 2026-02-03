/**
 * grounded_search tool for gemini-search-mcp
 *
 * Performs Google-grounded web searches via Gemini API.
 * Returns markdown-formatted results with sources and search queries.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchWithFallback } from '../api/index.js';
import { type ProviderName, getDefaultProvider, isAuthenticated } from '../auth/index.js';

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
					.enum(['none', 'low', 'high'])
					.optional()
					.default('low')
					.describe('Thinking depth for the model'),
			},
		},
		async (args) => {
			// Determine provider (from model param or default)
			const provider: ProviderName = args.model?.startsWith('antigravity')
				? 'antigravity'
				: await getDefaultProvider();

			// Early auth check with clear message
			if (!(await isAuthenticated(provider))) {
				return {
					content: [
						{
							type: 'text',
							text: `## Not Authenticated

You need to authenticate before using grounded search.

**To authenticate:**
1. Use the auth tool: \`auth --login ${provider}\`
2. Follow the instructions to complete authentication

**Why authentication is required:**
Google Search grounding requires a valid Google account with Gemini API access.`,
						},
					],
					isError: true,
				};
			}

			// Execute search with fallback (handles token refresh internally)
			const result = await searchWithFallback(args.query, {
				thinkingLevel: args.thinking_level === 'none' ? undefined : args.thinking_level,
				includeThoughts: false,
			});

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
