# Architecture Research

**Domain:** MCP Server (stdio transport with OAuth + API integration)
**Researched:** 2026-02-03
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+----------------------------------------------------------------------+
|                        Claude Code (MCP Host)                         |
+----------------------------------------------------------------------+
                                    |
                            stdio transport
                            (JSON-RPC 2.0)
                                    |
                                    v
+----------------------------------------------------------------------+
|                        MCP Server Process                             |
|                                                                       |
|  +----------------+  +------------------+  +----------------------+   |
|  | Transport      |  | Protocol Handler |  | Tool Registry        |   |
|  | Layer          |  | (JSON-RPC)       |  | - grounded_search    |   |
|  | (stdio)        |--| - initialize     |--| - [future tools]     |   |
|  +----------------+  | - tools/list     |  +----------------------+   |
|                      | - tools/call     |            |               |
|                      +------------------+            |               |
|                                                      v               |
|                      +----------------------------------------------+|
|                      |              Core Services                    ||
|                      |  +---------------+  +---------------------+   ||
|                      |  | Auth Manager  |  | API Orchestrator    |   ||
|                      |  | - token load  |  | - two-stage search  |   ||
|                      |  | - refresh     |  | - response parsing  |   ||
|                      |  | - oauth flows |  | - error handling    |   ||
|                      |  +---------------+  +---------------------+   ||
|                      +----------------------------------------------+|
+----------------------------------------------------------------------+
                                    |
                                    v (HTTPS)
          +--------------------------------------------------+
          |   Google Antigravity API                         |
          |   daily-cloudcode-pa.sandbox.googleapis.com      |
          |   - /v1internal:generateContent                  |
          |   - /v1internal:loadCodeAssist                   |
          +--------------------------------------------------+
                                    |
                                    v
          +--------------------------------------------------+
          |   Google Search Infrastructure                   |
          |   (grounding via googleSearch tool)              |
          +--------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Transport Layer | Handle stdio read/write, message framing | `StdioServerTransport` from `@modelcontextprotocol/sdk` |
| Protocol Handler | JSON-RPC request routing, lifecycle management | `McpServer` class, handles initialize/list/call |
| Tool Registry | Expose tools to client, route tool calls | `server.registerTool()` or `server.tool()` API |
| Auth Manager | Token persistence, refresh, OAuth flows | Custom module reading/writing credentials file |
| API Orchestrator | Two-stage API pattern, request formatting | Custom module calling Antigravity API |
| Config Manager | Default model, thinking level, preferences | Optional - can be hardcoded initially |

## Recommended Project Structure

```
src/
├── index.ts              # Entry point, server initialization
├── server/               # MCP server setup
│   ├── server.ts         # McpServer instance and transport
│   └── tools/            # Tool definitions
│       ├── grounded-search.ts  # Main search tool
│       └── index.ts      # Tool registration
├── auth/                 # OAuth and token management
│   ├── token-store.ts    # Read/write credentials file
│   ├── oauth-flows.ts    # Device code + loopback flows
│   └── refresh.ts        # Token refresh logic
├── api/                  # Antigravity API client
│   ├── client.ts         # HTTP client with headers
│   ├── search.ts         # Two-stage search orchestration
│   └── types.ts          # API request/response types
├── config/               # Configuration (optional)
│   └── defaults.ts       # Default model, thinking level
└── utils/                # Shared utilities
    └── logging.ts        # stderr logging (NEVER stdout!)
```

### Structure Rationale

- **server/:** Separates MCP protocol concerns from business logic. Transport and tool registration in one place.
- **auth/:** Isolated authentication complexity. OAuth flows are stateful and involve multiple steps; keeping them separate makes testing easier.
- **api/:** Encapsulates all Antigravity API interaction. Headers, endpoints, and response parsing in one module.
- **utils/:** Critical: logging MUST use stderr. `console.log()` corrupts stdio transport.

## Architectural Patterns

### Pattern 1: Stdio Transport with JSON-RPC

**What:** MCP servers communicate via stdin/stdout using JSON-RPC 2.0 messages. The host spawns the server process and sends/receives JSON messages.

**When to use:** Always for Claude Code integration. This is the standard transport for local MCP servers.

**Trade-offs:**
- Pro: Zero network overhead, no ports to manage
- Pro: Works in any environment (SSH, containers)
- Con: No concurrent connections (single client)
- Con: Cannot log to stdout (corrupts messages)

**Example:**
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
    name: 'google-grounded-search',
    version: '1.0.0'
});

// CRITICAL: Use console.error() for logging, never console.log()
console.error('Server starting...');

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Pattern 2: Two-Stage API Orchestration

**What:** Instead of relying on the model's passive decision to use search grounding, force reliable search by making a dedicated API call with only grounding tools (no function declarations).

**When to use:** Whenever you need guaranteed search results. The Antigravity API's native `googleSearch` grounding is passive - the model may skip it if it thinks it knows the answer.

**Trade-offs:**
- Pro: Reliable search results every time
- Pro: Clear separation of concerns (search vs other capabilities)
- Con: Two API calls for features combining search with function calling
- Con: Cannot mix `googleSearch` with `functionDeclarations` in same call

**Example:**
```typescript
// Stage 1: MCP tool receives query from Claude
server.registerTool(
    'grounded_search',
    {
        description: 'Search the web using Google Search grounding',
        inputSchema: {
            query: z.string().describe('Search query'),
            thinking: z.boolean().optional().default(true)
        }
    },
    async ({ query, thinking }) => {
        // Stage 2: Make dedicated API call with ONLY grounding tools
        const response = await antigravityClient.search({
            contents: [{ role: 'user', parts: [{ text: query }] }],
            tools: [{ googleSearch: {} }],  // No functionDeclarations!
            generationConfig: {
                thinkingConfig: { thinkingLevel: thinking ? 'high' : 'low' }
            }
        });

        return formatSearchResults(response);
    }
);
```

### Pattern 3: Lazy Token Loading with Refresh

**What:** Load tokens on first use, check expiration before each API call, refresh automatically when needed.

**When to use:** MCP servers should not block on startup waiting for authentication. Load tokens lazily when the first tool call arrives.

**Trade-offs:**
- Pro: Fast server startup
- Pro: Graceful handling of missing/expired credentials
- Con: First tool call may be slower (token refresh)
- Con: Need clear error message if not authenticated

**Example:**
```typescript
class TokenStore {
    private tokens: Tokens | null = null;
    private readonly credPath = '~/.config/google-grounded-search/credentials.json';

    async getValidToken(): Promise<string> {
        // Lazy load from file
        if (!this.tokens) {
            this.tokens = await this.loadFromFile();
        }

        // Check expiration (with 5 minute buffer)
        if (!this.tokens || this.isExpired(this.tokens)) {
            if (this.tokens?.refresh_token) {
                this.tokens = await this.refreshTokens(this.tokens.refresh_token);
                await this.saveToFile(this.tokens);
            } else {
                throw new AuthenticationRequiredError(
                    'Not authenticated. Run: google-grounded-search auth'
                );
            }
        }

        return this.tokens.access_token;
    }
}
```

## Data Flow

### Request Flow

```
[Claude Code sends query]
    |
    v
[stdio input] --> [JSON-RPC parse] --> [Protocol Handler]
    |                                        |
    |                                        v
    |                               [tools/call: grounded_search]
    |                                        |
    |                                        v
    |                               [Tool Handler]
    |                                        |
    +----------------+                       v
                     |              [Auth Manager: getValidToken()]
                     |                       |
                     |                       v (if expired)
                     |              [Token Refresh via OAuth]
                     |                       |
                     |                       v
                     |              [API Orchestrator: executeSearch()]
                     |                       |
                     |                       v (HTTPS POST)
                     |              [Antigravity API]
                     |                       |
                     |                       v
                     |              [Parse groundingMetadata]
                     |                       |
                     |                       v
                     |              [Format MCP tool response]
                     |                       |
    v                v                       |
[stdio output] <-- [JSON-RPC response] <-----+
    |
    v
[Claude Code receives search results]
```

### Token Lifecycle

```
[Server Startup]
    |
    v (no blocking auth)
[Server Ready]
    |
    v (first tool call)
[Load credentials.json]
    |
    +-- [File exists?]
    |       |
    |       +-- NO --> [Return auth_required error]
    |       |
    |       +-- YES --> [Parse tokens]
    |                       |
    |                       v
    |               [Token expired?]
    |                       |
    +-- [refresh_token exists?]
            |
            +-- YES --> [POST to token endpoint]
            |               |
            |               v
            |           [Update credentials.json]
            |               |
            +-- NO --> [Return auth_required error]
                            |
                            v
                    [Return valid access_token]
```

### Key Data Flows

1. **Search Request:** Claude asks question -> MCP tool call -> Antigravity API -> Google Search grounding -> formatted response with sources/citations
2. **Token Refresh:** Tool call with expired token -> load refresh_token -> OAuth token endpoint -> save new tokens -> retry with new access_token
3. **Initial Auth:** User runs auth command -> OAuth flow (device code or loopback) -> receive tokens -> save to credentials file

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (default) | Stdio transport, file-based token storage, single credentials file |
| Multi-user (future) | Would need HTTP transport, per-user token storage, session management |
| High volume (unlikely) | Rate limiting already handled by sandbox endpoint; add request queuing if needed |

### Scaling Priorities

1. **First bottleneck:** Token refresh during concurrent requests. Solution: Token refresh mutex to prevent multiple simultaneous refreshes.
2. **Second bottleneck:** If expanding beyond single user, would need to switch from stdio to Streamable HTTP transport and implement proper session management.

## Anti-Patterns

### Anti-Pattern 1: Logging to stdout

**What people do:** Use `console.log()` for debug output in a stdio-based MCP server.
**Why it's wrong:** stdout IS the communication channel. Any extra output corrupts JSON-RPC messages and breaks the server.
**Do this instead:** Always use `console.error()` or a logging library configured for stderr.

```typescript
// WRONG
console.log('Processing search request');

// RIGHT
console.error('Processing search request');

// BETTER (dedicated logger)
import { createLogger } from './utils/logging.js';
const log = createLogger('search');
log.info('Processing search request'); // Writes to stderr
```

### Anti-Pattern 2: Blocking on Auth at Startup

**What people do:** Require valid tokens before the MCP server responds to `initialize`.
**Why it's wrong:** Blocks the MCP host, provides poor UX, makes debugging harder.
**Do this instead:** Start server immediately, return clear errors on tool calls if not authenticated.

```typescript
// WRONG
async function main() {
    const token = await ensureAuthenticated(); // Blocks!
    const server = new McpServer({ ... });
    await server.connect(transport);
}

// RIGHT
async function main() {
    const server = new McpServer({ ... });
    server.registerTool('grounded_search', schema, async (args) => {
        try {
            const token = await tokenStore.getValidToken();
            return await executeSearch(args, token);
        } catch (e) {
            if (e instanceof AuthenticationRequiredError) {
                return {
                    content: [{
                        type: 'text',
                        text: 'Authentication required. Run: google-grounded-search auth'
                    }],
                    isError: true
                };
            }
            throw e;
        }
    });
    await server.connect(transport);
}
```

### Anti-Pattern 3: Mixing googleSearch with Function Declarations

**What people do:** Pass both `googleSearch` and `functionDeclarations` in the same API call.
**Why it's wrong:** The Antigravity API does not support this combination. Search will silently fail.
**Do this instead:** Use two-stage orchestration - make separate API calls for search grounding vs function calling.

```typescript
// WRONG - search grounding won't work reliably
const response = await api.generateContent({
    tools: [
        { googleSearch: {} },
        { functionDeclarations: [myFunction] }
    ],
    // ...
});

// RIGHT - dedicated search call
const searchResponse = await api.generateContent({
    tools: [{ googleSearch: {} }],  // ONLY grounding tools
    // ...
});
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Antigravity API | HTTPS POST with bearer token | Must use `antigravity/1.15.8` User-Agent header |
| Google OAuth | Standard OAuth 2.0 with PKCE | Support both device code and loopback flows |
| Token storage | File-based JSON | `~/.config/google-grounded-search/credentials.json` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Transport <-> Protocol | StdioServerTransport | SDK handles framing, server handles routing |
| Protocol <-> Tools | Method call (sync) | Tool handlers are async functions |
| Tools <-> Auth | TokenStore API | `getValidToken()` returns Promise<string> |
| Tools <-> API | AntigravityClient API | `search(query, options)` returns formatted results |

## Build Order Implications

Based on component dependencies, the recommended implementation order is:

### Phase 1: Foundation (Must be first)
1. **Project setup** - TypeScript, MCP SDK, build tooling
2. **Transport Layer** - Stdio server that responds to `initialize` and `tools/list`
3. **Minimal Tool** - Empty `grounded_search` tool that returns placeholder text

**Rationale:** Get something running in Claude Code immediately. Validates build/config works.

### Phase 2: Authentication
4. **Token Store** - Read/write credentials file, expiration checking
5. **Token Refresh** - OAuth refresh_token flow
6. **OAuth Flows** - Device code flow (Gemini CLI style) for initial auth

**Rationale:** Auth is needed before API calls work. Device code flow is simplest.

### Phase 3: Core Search
7. **API Client** - HTTP client with correct headers, endpoint
8. **Search Orchestration** - Two-stage pattern, request formatting
9. **Response Parser** - Extract text, sources, search queries from groundingMetadata

**Rationale:** Now we can make real API calls. Search is the core value.

### Phase 4: Polish
10. **Error Handling** - Clear messages for auth errors, API failures
11. **Configuration** - Model selection, thinking level options
12. **Loopback OAuth** - Alternative auth flow for environments with browsers

**Rationale:** Nice-to-haves after core works.

## Sources

### Official MCP Documentation (HIGH confidence)
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - Core architecture concepts
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server) - Official TypeScript guide
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - SDK repository and examples

### MCP SDK Context7 (HIGH confidence)
- Context7 query: McpServer class, tool registration, transport patterns

### Community/Research (MEDIUM confidence)
- [MCP Architecture Guide - DEV Community](https://dev.to/danishashko/mcp-server-architecture-a-developers-guide-3m28)
- [Portal One: Production MCP Server with OAuth](https://portal.one/blog/mcp-server-with-oauth-typescript/)
- [MCP Framework stdio transport](https://mcp-framework.com/docs/Transports/stdio-transport/)

### Project-Specific Research (HIGH confidence)
- `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md` - Two-stage orchestration pattern
- `custom_research/2026-02-03-oauth-auth-research.md` - OAuth flow comparison

---
*Architecture research for: MCP server with OAuth + API search*
*Researched: 2026-02-03*
