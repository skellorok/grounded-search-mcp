/**
 * grounded_search tool for gemini-search-mcp
 * Phase 2-3: Mock implementation with auth checks
 * Phase 4: Will call Gemini API with two-stage orchestration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
	type ProviderName,
	getDefaultProvider,
	getValidAccessToken,
	isAuthenticated,
} from '../auth/index.js';

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
		async (args) => {
			// Determine provider (from model param or default)
			const provider: ProviderName = args.model?.startsWith('antigravity')
				? 'antigravity'
				: await getDefaultProvider();

			// Check authentication
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

			// Try to get valid token (handles refresh)
			let accessToken: string;
			try {
				const token = await getValidAccessToken(provider);
				// Validate token is non-empty string
				if (!token || typeof token !== 'string' || token.trim() === '') {
					throw new Error('Invalid access token received');
				}
				accessToken = token;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Unknown error';
				return {
					content: [
						{
							type: 'text',
							text: `## Authentication Error

${message}

**To fix:**
Use \`auth --login ${provider}\` to re-authenticate.`,
						},
					],
					isError: true,
				};
			}

			// TODO: Phase 4 will use accessToken to call Gemini API
			// For now, return mock response indicating auth is working
			// We include the accessToken length (not the token itself) to verify it was retrieved
			const mockResponse = {
				answer: `[MOCK - Auth OK] Search results for: "${args.query}"`,
				model: args.model ?? 'gemini-2.0-flash',
				thinking_level: args.thinking_level ?? 'low',
				sources: [],
				searchQueries: [],
				_authenticated: true,
				_provider: provider,
				_tokenValid: accessToken.length > 0,
			};

			return {
				content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }],
			};
		},
	);
}
