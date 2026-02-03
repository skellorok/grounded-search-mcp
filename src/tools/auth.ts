/**
 * auth tool for gemini-search-mcp
 * Phase 2: Mock implementation
 * Phase 3: Will implement OAuth device code and loopback flows
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * Register the auth tool with the MCP server
 */
export function registerAuthTool(server: McpServer): void {
	server.registerTool(
		'auth',
		{
			title: 'Authenticate',
			description: 'Authenticate with Google to enable grounded search',
			inputSchema: {
				provider: z
					.enum(['gemini-cli', 'antigravity'])
					.optional()
					.default('gemini-cli')
					.describe('Authentication provider to use'),
			},
		},
		async ({ provider }) => {
			// Phase 2: Return mock not-implemented response
			// Phase 3: Will implement actual OAuth flows
			return {
				content: [{ type: 'text', text: `[MOCK] Auth with ${provider} not yet implemented` }],
				isError: true,
			};
		},
	);
}
