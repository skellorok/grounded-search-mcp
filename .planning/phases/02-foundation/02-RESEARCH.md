# Phase 2: Foundation - Research

**Researched:** 2026-02-03
**Domain:** MCP Server Foundation (TypeScript, stdio transport, tool registration)
**Confidence:** HIGH

## Summary

This research covers establishing a working MCP server skeleton with placeholder tools. The MCP TypeScript SDK (`@modelcontextprotocol/sdk`) provides a high-level `McpServer` class with Zod-based tool registration that handles JSON-RPC protocol details automatically. The stdio transport (`StdioServerTransport`) is the standard for Claude Code integration.

Key findings:
- The MCP SDK uses `server.registerTool()` with Zod schemas for input validation
- **CRITICAL**: All logging must use `console.error()` — stdout is reserved for JSON-RPC
- Tool responses use `{ content: [{ type: 'text', text: '...' }] }` format
- Claude Code reads MCP configuration from `~/.claude.json` (user scope) or `.mcp.json` (project scope)
- Biome provides all-in-one linting/formatting; Husky + lint-staged for pre-commit hooks

**Primary recommendation:** Use the high-level `McpServer` API with `registerTool()` for cleaner code and automatic schema validation. Start with minimal configuration and add complexity only as needed.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @modelcontextprotocol/sdk | ^1.25.3 | MCP Protocol | Official SDK with HIGH source reputation. Provides McpServer, StdioServerTransport, tool registration with Zod schemas. |
| zod | ^4.3.5 | Schema Validation | Required peer dependency for MCP SDK. SDK imports from `zod/v4`. 6.5x faster than v3. |
| typescript | ^5.5 | Language | Required for MCP SDK type system; strict mode enables proper schema inference. |

### Development

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | Dev runner | Development — runs TypeScript directly without compilation |
| vitest | latest | Testing | Unit tests — MCP SDK uses this internally, fast ESM support |
| @biomejs/biome | latest | Lint + Format | All-in-one replacement for ESLint + Prettier |
| husky | ^9.x | Git hooks | Pre-commit hook management |
| lint-staged | ^15.x | Staged file processing | Run lint/format only on staged files |
| @modelcontextprotocol/inspector | latest | MCP Testing | Test tools without LLM — Web UI at localhost:6274 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Biome | ESLint + Prettier | More configuration, slower, but more rules available |
| tsx | ts-node | tsx is simpler, better ESM handling |
| vitest | jest | jest is slower, worse ESM support |
| npm | pnpm/yarn | pnpm is faster but less universal |

**Installation:**
```bash
# Core dependencies
npm install @modelcontextprotocol/sdk zod

# Dev dependencies
npm install -D typescript @types/node tsx vitest @biomejs/biome husky lint-staged
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── index.ts           # Entry point, server setup and transport connection
├── tools/
│   ├── index.ts       # Tool registration (exports registerTools function)
│   ├── search.ts      # grounded_search tool definition
│   └── auth.ts        # auth tool definition (stubbed)
├── auth/              # (placeholder for Phase 3)
│   └── index.ts       # Token management exports
├── api/               # (placeholder for Phase 4)
│   └── index.ts       # API client exports
└── types/
    └── index.ts       # Shared types (mock response shapes)
```

### Pattern 1: High-Level McpServer with registerTool

**What:** Use `McpServer` class with `registerTool()` method for automatic schema validation and response formatting.

**When to use:** Always — this is the recommended approach from the SDK documentation.

**Example:**
```typescript
// Source: Context7 /modelcontextprotocol/typescript-sdk
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
    name: 'gemini-search-mcp',
    version: '1.0.0'
});

server.registerTool(
    'grounded_search',
    {
        title: 'Grounded Search',
        description: 'Search the web using Google Search grounding via Gemini API',
        inputSchema: {
            query: z.string().min(1).describe('Search query'),
            model: z.string().optional().default('gemini-3-flash').describe('Model to use'),
            thinking_level: z.enum(['none', 'low', 'medium', 'high']).optional().default('medium').describe('Thinking depth')
        }
    },
    async ({ query, model, thinking_level }) => {
        // Implementation here
        return {
            content: [{ type: 'text', text: JSON.stringify(result) }]
        };
    }
);

const transport = new StdioServerTransport();
await server.connect(transport);

// CRITICAL: Use console.error for all logging
console.error('Server running on stdio');
```

### Pattern 2: Tool Response Format

**What:** MCP tools return `{ content: ContentBlock[], isError?: boolean }`. Content blocks have `type: 'text'` with string `text`.

**When to use:** All tool responses.

**Example:**
```typescript
// Success response
return {
    content: [{ type: 'text', text: JSON.stringify({
        answer: 'Search result text...',
        sources: [{ title: 'Source', url: 'https://...' }],
        searchQueries: ['query used']
    }) }]
};

// Error response
return {
    content: [{ type: 'text', text: 'Authentication required. Run: gemini-search-mcp auth' }],
    isError: true
};
```

### Pattern 3: ESM Module Structure

**What:** Use ES Modules with `.js` extensions in imports (required for Node16 module resolution).

**When to use:** All TypeScript files in this project.

**Example:**
```typescript
// tsconfig.json uses module: "Node16"
// All imports must use .js extension (even for .ts files)

// CORRECT
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from './tools/index.js';

// INCORRECT - will fail at runtime
import { registerTools } from './tools/index';
```

### Anti-Patterns to Avoid

- **console.log() anywhere:** Corrupts JSON-RPC stream. Use `console.error()` exclusively.
- **Blocking auth at startup:** Server must start immediately. Check auth lazily on first tool call.
- **Complex JSON Schema features:** Avoid `anyOf`, `oneOf`, `$ref` — not all MCP clients support them.
- **CommonJS:** MCP SDK is ESM-only. Use `"type": "module"` in package.json.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON-RPC parsing | Custom parser | StdioServerTransport | SDK handles framing, parsing, error formatting |
| Schema validation | Manual type checking | Zod via registerTool | Automatic validation, type inference, error messages |
| Tool listing | Custom list endpoint | registerTool auto-registration | SDK handles tools/list requests |
| Message framing | Custom stdin/stdout handling | StdioServerTransport | Handles buffering, newlines, encoding |

**Key insight:** The MCP SDK handles all protocol complexity. Focus on tool logic, not transport details.

## Common Pitfalls

### Pitfall 1: stdout Corruption

**What goes wrong:** Any `console.log()` corrupts the JSON-RPC stream, causing parse errors and session crashes.

**Why it happens:** stdout IS the communication channel for stdio transport.

**How to avoid:**
- Replace ALL `console.log()` with `console.error()`
- Configure any logging libraries for stderr only
- Test by running server standalone and checking stdout is empty except JSON-RPC

**Warning signs:** "Invalid JSON" errors, "Unexpected token" errors, server connects then immediately fails.

### Pitfall 2: Missing .js Extensions

**What goes wrong:** TypeScript compiles fine but runtime import fails with "Cannot find module".

**Why it happens:** Node16 module resolution requires explicit `.js` extensions in imports.

**How to avoid:**
- Always use `.js` extension in imports: `import { x } from './file.js'`
- Configure IDE to auto-add extensions
- Test with `npm run build && npm start` before committing

**Warning signs:** Works with tsx but fails after tsc build.

### Pitfall 3: Zod Version Mismatch

**What goes wrong:** Type errors or runtime failures with Zod schemas.

**Why it happens:** MCP SDK imports from `zod/v4`. Using Zod v3 < 3.25 causes compatibility issues.

**How to avoid:**
- Use `zod@^4.3.5` (recommended) or `zod@^3.25`
- Check peer dependency warnings during npm install

**Warning signs:** Type errors mentioning Zod, runtime schema validation failures.

### Pitfall 4: Tool Schema Complexity

**What goes wrong:** Tools work in Claude Code but fail in other MCP clients (GitHub Copilot, etc.).

**Why it happens:** Different clients support different JSON Schema subsets.

**How to avoid:**
- Use only basic types: `string`, `number`, `boolean`, `object`, `array`
- Use `enum` for constrained string values
- Avoid `anyOf`, `oneOf`, `$ref`, nullable unions
- Test with MCP Inspector before deployment

**Warning signs:** "Invalid tool schema" errors, tools "omitted due to invalid schemas".

## Code Examples

### Complete Minimal MCP Server

```typescript
// src/index.ts
// Source: Adapted from Context7 /modelcontextprotocol/typescript-sdk

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
    name: 'gemini-search-mcp',
    version: '1.0.0'
});

// Register grounded_search tool with stable schema
server.registerTool(
    'grounded_search',
    {
        title: 'Grounded Search',
        description: 'Search the web using Google Search grounding via Gemini API',
        inputSchema: {
            query: z.string().min(1).max(1000).describe('Search query'),
            model: z.string().optional().default('gemini-3-flash').describe('Gemini model'),
            thinking_level: z.enum(['none', 'low', 'medium', 'high']).optional().default('medium').describe('Thinking depth')
        }
    },
    async ({ query, model, thinking_level }) => {
        // Phase 2: Return mock response
        const mockResponse = {
            answer: `[MOCK] Search results for: "${query}"`,
            model: model,
            thinking_level: thinking_level,
            sources: [
                { title: 'Example Source', url: 'https://example.com' }
            ],
            searchQueries: [query]
        };

        return {
            content: [{ type: 'text', text: JSON.stringify(mockResponse, null, 2) }]
        };
    }
);

// Register auth tool (stubbed for Phase 2)
server.registerTool(
    'auth',
    {
        title: 'Authenticate',
        description: 'Authenticate with Google to enable grounded search',
        inputSchema: {
            provider: z.enum(['gemini-cli', 'antigravity']).optional().default('gemini-cli').describe('Auth provider')
        }
    },
    async ({ provider }) => {
        return {
            content: [{ type: 'text', text: `[MOCK] Auth with ${provider} not yet implemented` }],
            isError: true
        };
    }
);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('gemini-search-mcp server running on stdio');
```

### package.json Configuration

```json
{
  "name": "gemini-search-mcp",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "gemini-search-mcp": "./build/index.js"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc && chmod +x build/index.js",
    "start": "node build/index.js",
    "test": "vitest",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "prepare": "husky",
    "inspector": "npx @modelcontextprotocol/inspector node build/index.js"
  },
  "files": ["build"],
  "engines": {
    "node": ">=18"
  }
}
```

### tsconfig.json Configuration

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
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

### biome.json Configuration

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  },
  "files": {
    "ignore": ["build/**", "node_modules/**"]
  }
}
```

### Husky + lint-staged Configuration

```json
// In package.json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["biome check --write"],
    "*.{json,md}": ["biome format --write"]
  }
}
```

```bash
# .husky/pre-commit
npm run typecheck
npx lint-staged
```

### Claude Code MCP Registration

**User scope (~/.claude.json):**
```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "node",
      "args": ["/absolute/path/to/gemini-search-mcp/build/index.js"]
    }
  }
}
```

**Project scope (.mcp.json in project root):**
```json
{
  "mcpServers": {
    "gemini-search": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/build/index.js"]
    }
  }
}
```

**Via CLI:**
```bash
# Add to user scope
claude mcp add --transport stdio --scope user gemini-search -- node /path/to/build/index.js

# Verify
claude mcp list
```

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server class (low-level) | McpServer class (high-level) | SDK 1.x | Cleaner API, automatic validation |
| JSON Schema objects | Zod schemas | SDK 1.x | Type inference, better DX |
| SSE transport | Streamable HTTP | MCP 2024-11 | SSE deprecated, HTTP preferred for remote |
| Zod v3 | Zod v4 | 2025 | 6.5x faster, SDK imports from zod/v4 |

**Deprecated/outdated:**
- **SSE transport:** Use HTTP for remote, stdio for local
- **Manual JSON-RPC handling:** Use SDK transport classes
- **ESLint + Prettier separate:** Biome is faster, all-in-one

## Open Questions

1. **Thinking levels for Gemini 3**
   - What we know: Gemini API supports `thinkingConfig` with `thinkingLevel`
   - What's unclear: Exact valid values for Gemini 3 models (training data suggests 'none', 'low', 'medium', 'high')
   - Recommendation: Use enum with these values, verify during Phase 4 API integration

2. **MCP Inspector version compatibility**
   - What we know: Inspector available via npx
   - What's unclear: Whether latest version works with SDK 1.25.x
   - Recommendation: Test during Phase 2 implementation, document working version

## Sources

### Primary (HIGH confidence)
- [Context7: /modelcontextprotocol/typescript-sdk](https://context7.com/modelcontextprotocol/typescript-sdk) - Tool registration, server setup, transport patterns
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp) - Registration format, scopes, CLI commands
- [Context7: /biomejs/biome](https://context7.com/biomejs/biome) - Configuration format, linter rules
- [Context7: /websites/main_vitest_dev](https://context7.com/websites/main_vitest_dev) - Test configuration

### Secondary (MEDIUM confidence)
- [lint-staged GitHub](https://github.com/lint-staged/lint-staged) - Configuration patterns
- [Husky documentation](https://typicode.github.io/husky/) - Git hooks setup

### Project Research (HIGH confidence)
- `.planning/research/STACK.md` - Stack decisions from Phase 1
- `.planning/research/ARCHITECTURE.md` - Architecture patterns from Phase 1
- `.planning/research/PITFALLS.md` - Known pitfalls from Phase 1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified with Context7 SDK documentation
- Architecture patterns: HIGH - Verified with official MCP docs and SDK examples
- Pitfalls: HIGH - Documented in Phase 1 research, verified with SDK docs
- Claude Code registration: HIGH - Verified with official Claude Code documentation

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain)

---
*Phase: 02-foundation*
*Research completed: 2026-02-03*
