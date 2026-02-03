/**
 * Tool registration for gemini-search-mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAuthTool } from './auth.js';
import { registerSearchTool } from './search.js';

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer): void {
	registerSearchTool(server);
	registerAuthTool(server);
}
