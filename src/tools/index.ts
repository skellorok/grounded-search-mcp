/**
 * Tool registration for grounded-search-mcp
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAuthTool } from './auth.js';
import { registerConfigTool } from './config.js';
import { registerSearchTool } from './search.js';

/**
 * Register all tools with the MCP server
 */
export function registerTools(server: McpServer): void {
	registerSearchTool(server);
	registerAuthTool(server);
	registerConfigTool(server);
}
