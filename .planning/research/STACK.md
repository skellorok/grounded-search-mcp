# Stack Research

**Domain:** MCP Server with Google Search Grounding (TypeScript)
**Researched:** 2026-02-03
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| TypeScript | ^5.5 | Language | Required for MCP SDK type system; strict mode enables proper schema inference. Zod 4.x requires TS 5.5+. |
| Node.js | ^20 LTS | Runtime | LTS stability for production MCP servers. Native fetch, stable ESM support. |
| @modelcontextprotocol/sdk | ^1.25.3 | MCP Protocol | Official SDK with HIGH source reputation. Provides McpServer, StdioServerTransport, tool registration with Zod schemas. V2 expected Q1 2026 but v1.x recommended for production. |
| zod | ^4.3.5 | Schema Validation | Required peer dependency for MCP SDK. V4 is 6.5x faster than v3 and the SDK imports from `zod/v4`. Backwards compatible with v3.25+. |

### Authentication Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| google-auth-library | ^10.5.0 | OAuth 2.0 | Google's official Node.js OAuth client. Supports PKCE via `generateCodeVerifierAsync()`. Handles token refresh automatically. |

### HTTP Client

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| Native fetch | Built-in | API Requests | Node.js 20+ has native fetch. No external dependency needed. Simpler than axios for this use case. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| tsx | Dev runner | Runs TypeScript directly without compilation. Use `tsx watch src/index.ts` for development. Eliminates ESM/CJS headaches. |
| tsc | Production build | Compile to JS for production. Output to `build/` or `dist/`. |
| @modelcontextprotocol/inspector | Testing | Official MCP Inspector for testing tools without LLM. Run via `npx @modelcontextprotocol/inspector`. Web UI at localhost:6274. |
| vitest | Unit testing | MCP SDK uses Vitest internally. Fast, TypeScript-native, good ESM support. |

## Installation

```bash
# Core dependencies
npm install @modelcontextprotocol/sdk zod google-auth-library

# Dev dependencies
npm install -D typescript @types/node tsx vitest
```

## Project Configuration

### package.json
```json
{
  "name": "gemini-search-mcp",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "gemini-search-mcp": "./build/index.js"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc && chmod 755 build/index.js",
    "start": "node build/index.js",
    "test": "vitest",
    "inspector": "npx @modelcontextprotocol/inspector node build/index.js"
  },
  "files": ["build"]
}
```

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Project Structure
```
gemini-search-mcp/
├── src/
│   ├── index.ts           # Entry point, server setup
│   ├── tools/
│   │   └── search.ts      # Google search tool implementation
│   ├── auth/
│   │   └── oauth.ts       # OAuth/PKCE flow with google-auth-library
│   └── types/
│       └── api.ts         # API response types
├── build/                  # Compiled output (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## MCP Server Pattern

```typescript
// src/index.ts - Standard MCP server setup
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'gemini-search-mcp',
  version: '1.0.0'
});

// Register tools with Zod schemas
server.registerTool(
  'google_grounded_search',
  {
    title: 'Google Grounded Search',
    description: 'Search the web using Google Search grounding via Antigravity API',
    inputSchema: {
      query: z.string().describe('Search query'),
      thinking: z.boolean().optional().default(true).describe('Enable thinking mode')
    }
  },
  async ({ query, thinking }) => {
    // Implementation calls Antigravity API
    const result = await executeSearch(query, thinking);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }]
    };
  }
);

// Connect via stdio for Claude Code
const transport = new StdioServerTransport();
await server.connect(transport);

// CRITICAL: Use console.error, NOT console.log (stdout corrupts JSON-RPC)
console.error('Gemini Search MCP Server running on stdio');
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @modelcontextprotocol/sdk | Platformatic MCP | If team is Fastify-familiar and wants more modular approach. However, stick with official SDK for better support. |
| zod | yup, joi | Never for MCP servers. Zod is required peer dependency of MCP SDK. |
| Native fetch | axios, got | If you need interceptors, retry logic, or advanced features. Native fetch is sufficient for this project. |
| tsx | ts-node | If you need more configuration options. tsx is simpler and handles ESM better. |
| tsc | tsup, esbuild | If you need bundling or multiple output formats (CJS+ESM). Not needed for stdio MCP server. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| console.log() | Corrupts JSON-RPC protocol on stdio transport | console.error() for all logging |
| SSE transport | Deprecated in MCP. Only for backwards compatibility. | StdioServerTransport for local servers |
| Zod v3 (< 3.25) | Not compatible with MCP SDK's zod/v4 imports | zod ^4.3.5 or ^3.25 minimum |
| axios | Unnecessary dependency; adds complexity | Native fetch (Node.js 20+) |
| Express/Hono | Overkill for stdio transport MCP server | Direct StdioServerTransport |
| Jest | Slower, worse ESM support | Vitest (MCP SDK uses this internally) |
| CommonJS | MCP SDK is ESM-only | ES Modules ("type": "module") |

## Stack Patterns for This Project

**For stdio transport (Claude Code):**
- Use StdioServerTransport (default)
- No HTTP server needed
- No Express/Hono middleware
- Direct tool registration on McpServer

**For OAuth authentication:**
- Use google-auth-library with PKCE
- Implement loopback server flow (like Antigravity)
- Support paste-back fallback for SSH/remote environments
- Store tokens in `~/.config/gemini-search-mcp/credentials.json`

**For API requests to Antigravity:**
- Use native fetch
- Include required headers (User-Agent: antigravity/1.15.8)
- Target sandbox endpoint: `daily-cloudcode-pa.sandbox.googleapis.com`

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @modelcontextprotocol/sdk@1.25.x | zod@^3.25 or zod@^4.x | SDK imports from zod/v4 but maintains v3 compatibility |
| zod@4.x | TypeScript 5.5+ | Strict mode required in tsconfig.json |
| google-auth-library@10.x | Node.js 18+ | Uses native fetch internally |

## Critical Implementation Notes

### 1. Logging on STDIO Transport
```typescript
// WRONG - corrupts JSON-RPC messages
console.log('Processing...');

// CORRECT - safe for stdio
console.error('Processing...');
```

### 2. ESM Import Extensions
When using `module: "Node16"`, include `.js` extensions in imports:
```typescript
// Correct
import { helper } from './utils/helper.js';

// Incorrect - will fail
import { helper } from './utils/helper';
```

### 3. Tool Schema Best Practices
```typescript
// Define schemas with constraints for better LLM understanding
inputSchema: {
  query: z.string()
    .min(1)
    .max(1000)
    .describe('Search query - be specific for better results'),
  thinking: z.boolean()
    .optional()
    .default(true)
    .describe('Enable reasoning mode for complex queries')
}
```

## Sources

- [Context7: /modelcontextprotocol/typescript-sdk](https://context7.com/modelcontextprotocol/typescript-sdk) - Official SDK documentation (HIGH confidence)
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) - v1.25.3 release (HIGH confidence)
- [Model Context Protocol: Build Server Guide](https://modelcontextprotocol.io/docs/develop/build-server) - Official tutorial (HIGH confidence)
- [Zod Official Documentation](https://zod.dev/v4) - v4.3.5 release notes (HIGH confidence)
- [google-auth-library npm](https://www.npmjs.com/package/google-auth-library) - v10.5.0 (HIGH confidence)
- [NearForm MCP Implementation Guide](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) - Best practices (MEDIUM confidence)
- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector) - Testing tool (HIGH confidence)

---
*Stack research for: MCP Server with Google Search Grounding*
*Researched: 2026-02-03*
