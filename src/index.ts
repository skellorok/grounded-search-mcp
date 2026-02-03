#!/usr/bin/env node
/**
 * gemini-search-mcp - MCP server for Google Search grounding via Gemini API
 *
 * CRITICAL: All logging must use console.error() - stdout is reserved for JSON-RPC
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';

// Create the MCP server
const server = new McpServer({
	name: 'gemini-search-mcp',
	version: '1.0.0',
});

// Register all tools
registerTools(server);

// Create stdio transport for Claude Code communication
const transport = new StdioServerTransport();

// Connect server to transport
await server.connect(transport);

// Log startup (CRITICAL: use stderr, not stdout)
console.error('gemini-search-mcp server running on stdio');
