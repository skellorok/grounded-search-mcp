# Project Research Summary

**Project:** Google Grounded Search MCP Server
**Domain:** MCP Server with OAuth + API Integration (TypeScript/Node.js)
**Researched:** 2026-02-03
**Confidence:** HIGH

## Executive Summary

This project builds an MCP (Model Context Protocol) server that exposes Google Search grounding capabilities via the Antigravity API to Claude Code and other MCP clients. The product differentiates from Claude's built-in WebSearch and competitors like Brave MCP through structured citation metadata (segment-level source mapping), Google's superior search relevance, and transparency in what queries were actually executed. The recommended approach uses TypeScript with the official MCP SDK, stdio transport for local Claude Code integration, and OAuth 2.0 with PKCE for Google authentication.

The architecture follows a proven pattern: stdio JSON-RPC transport layer, dedicated auth manager with lazy token loading and automatic refresh, and a two-stage API orchestration pattern to guarantee search grounding occurs (the API's native grounding is passive - the model decides whether to search). Critical risks include stdout corruption breaking JSON-RPC communication, OAuth token race conditions under concurrent requests, and plain text credential storage. These are mitigated through stderr-only logging infrastructure, token refresh mutex, and OS-native keychain integration from day one.

Research confidence is high across all areas. The MCP SDK is official and well-documented, Google's OAuth patterns are standard, the Antigravity API has existing implementation examples, and community pitfalls are thoroughly documented. The main gap is Antigravity API sandbox stability (Google internal endpoint), which requires validation during implementation but has low risk given existing usage in Gemini CLI.

## Key Findings

### Recommended Stack

The official MCP TypeScript SDK provides the foundation with strong type safety via Zod v4 schemas. Node.js 20 LTS offers native fetch and stable ESM support, eliminating axios/got dependencies. Google's official `google-auth-library` handles OAuth 2.0 with PKCE, automatic token refresh, and both device code (CLI-friendly) and loopback (desktop-friendly) flows. Development tooling uses `tsx` for fast TypeScript execution without compilation headaches and Vitest for testing (MCP SDK's choice).

**Core technologies:**
- **TypeScript 5.5+ with @modelcontextprotocol/sdk 1.25.3**: Official MCP implementation with Zod 4.x integration for schema validation - SDK imports from `zod/v4` and requires strict mode for proper type inference
- **Node.js 20 LTS**: LTS stability, native fetch eliminates HTTP client dependencies, stable ESM support critical for MCP SDK's ES modules-only design
- **google-auth-library 10.5+**: Google's official OAuth client with PKCE support via `generateCodeVerifierAsync()`, handles token refresh automatically, established production use
- **Zod 4.3.5**: Required peer dependency for MCP SDK, 6.5x faster than v3, backwards compatible with v3.25+ but SDK requires v4 for optimal performance

**Critical configuration:**
- **package.json**: `"type": "module"` is mandatory (MCP SDK is ESM-only)
- **tsconfig.json**: `"module": "Node16"` with `.js` extensions on imports, `"strict": true` required for Zod v4
- **Transport**: StdioServerTransport for Claude Code (default), never SSE (deprecated)
- **Logging**: console.error() exclusively - console.log() corrupts JSON-RPC on stdio

### Expected Features

The MVP focuses on core search grounding with structured citations. Single-tool design (no API wrapper one-on-one anti-pattern) where `grounded_search` exposes query, model selection, and thinking level as optional parameters. Research shows 65.9% of users say citations boost trust, making source URLs and titles table stakes.

**Must have (table stakes):**
- **Single grounded_search tool** - core value prop; MCP tools should be polymorphic, not proliferated
- **Source citations with URLs** - parse `groundingMetadata.groundingChunks` for titles and URLs; industry standard for search tools
- **Real-time results** - primary differentiator vs LLM training data; API provides this natively via Google Search backend
- **Authentication persistence** - store tokens in `~/.config/`, auto-refresh on expiry; users expect one-time auth
- **Clear error messages** - MCP best practice; LLMs need actionable errors (e.g., "Not authenticated. Run: gemini-search-mcp auth")
- **Input validation** - Zod schemas prevent injection; validate query length, sanitize inputs

**Should have (competitive):**
- **Structured citation metadata** - groundingChunks with indices mapping claims to sources enable inline citations; differentiator vs Brave/WebSearch
- **Search queries transparency** - surface `webSearchQueries` from API so users see what Google actually searched; builds trust
- **Model selection parameter** - gemini-3-flash (fast) vs gemini-3-pro (quality); simple routing to different models
- **Thinking level configuration** - control reasoning depth (high/low/minimal); trade speed for comprehensiveness
- **Confidence scores** - API returns 0-1 scores for grounding supports; pass through to enable user judgment of result quality
- **Grounding supports with segment indices** - map exact text segments to source indices for precise attribution

**Defer (v2+):**
- **URL context analysis** - separate tool for analyzing specific URLs; conflicts with googleSearch in same request (API limitation)
- **Multi-account rotation** - avoid rate limits; complexity explosion and likely ToS violation; sandbox endpoint not rate-limited anyway
- **Claude models via Antigravity** - API supports them but out of scope for search-focused MVP; document possibility
- **Streaming results** - MCP tool results are atomic; streaming partial results confuses LLMs; 300-800ms latency acceptable

### Architecture Approach

The system follows standard MCP server patterns: stdio transport (JSON-RPC 2.0) for Claude Code communication, protocol handler for initialize/list/call routing, and dedicated service layers for authentication and API orchestration. The transport layer uses `StdioServerTransport` from the official SDK. Core services include an auth manager (token load/refresh/OAuth flows) and an API orchestrator implementing the two-stage search pattern.

**Major components:**
1. **Transport + Protocol Layer** - StdioServerTransport handles stdin/stdout framing; McpServer class routes JSON-RPC calls to tool handlers; NEVER log to stdout (corrupts protocol)
2. **Auth Manager** - Lazy token loading (load on first use, not startup); automatic refresh with mutex to prevent race conditions; supports both device code and loopback OAuth flows; stores credentials in `~/.config/gemini-search-mcp/credentials.json` (should migrate to OS keychain)
3. **API Orchestrator** - Implements two-stage pattern: tool receives query from Claude, makes dedicated API call with ONLY grounding tools (no functionDeclarations); parses groundingMetadata for sources/citations; formats results for MCP consumption
4. **Tool Registry** - Single `grounded_search` tool with Zod schema; optional parameters for model and thinking level; returns structured results with text, sources, and search queries
5. **Config Manager** - Default model (gemini-3-flash), default thinking level, API endpoint (sandbox vs production); can be hardcoded initially, externalize for v1.x

**Key patterns:**
- **Stdio transport**: Zero network overhead, works in any environment (SSH, containers), but cannot log to stdout and supports only single client
- **Two-stage orchestration**: Dedicated API call with ONLY googleSearch tool guarantees search occurs (native grounding is passive - model decides whether to search)
- **Lazy token loading with refresh**: Fast server startup, graceful handling of missing/expired credentials, first call may be slower due to refresh

### Critical Pitfalls

Research identified eight critical pitfalls with high impact. The top five must be addressed from day one in Phase 1-2 planning.

1. **stdout corruption kills stdio transport** - Any non-JSON-RPC output to stdout (console.log, library banners, debug) corrupts messages and crashes sessions. Solution: Use console.error() exclusively, configure all logging to stderr, test in isolation before connecting to MCP client. **Address in Phase 1: Core MCP Server Setup**

2. **JSON Schema draft incompatibility** - MCP clients reject Draft 2020-12 features (anyOf, $ref, nullable unions). GitHub Copilot, Azure AI Foundry enforce strict validation. Solution: Use only basic features (type, properties, required, description, enum), always include `items` for arrays, property keys must match `^[a-zA-Z0-9_.-]{1,64}$`, test with multiple clients. **Address in Phase 1: Tool Schema Design**

3. **OAuth token race conditions** - Multiple concurrent requests trigger simultaneous token refresh; OAuth refresh tokens are single-use so only one succeeds, others invalidate each other causing cascading failures. Solution: Implement token refresh mutex (only one refresh at a time), queue requests during refresh, proactive refresh at 80% of token lifetime. **Address in Phase 2: OAuth Integration**

4. **Missing exponential backoff causes rate limit death spiral** - Immediate retries on 429 errors amplify the problem; synchronized clients create "thundering herd" effect extending rate limit windows. Solution: Exponential backoff with jitter (`wait = min(2^n + random_ms, 32s)`), honor Retry-After headers, max 5 retry attempts, circuit breaker for sustained failures. **Address in Phase 3: API Integration**

5. **Grounding is model-controlled (passive, not active)** - Native grounding is passive - the model decides whether to search based on its judgment. Many queries, the model skips search and returns stale/hallucinated information. Solution: Use two-stage pattern (first call requests search explicitly), check for `groundingMetadata` presence to verify search occurred, validate `searchEntryPoint` field presence indicates grounding happened. **Address in Phase 3: Grounding Implementation**

**Additional critical risks:**
6. **Credential storage in plain text** - OAuth tokens in plain text config files expose all users on file system breach. Solution: Use OS-native secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service), never plain text files/env vars, use `node-keytar` for cross-platform access. **Address in Phase 2: OAuth Integration**

7. **MCP tool call exceptions return success with error text** - Python SDK specific; not applicable to TypeScript but validates importance of explicit error handling. TypeScript approach: Wrap handlers in try/catch, return structured error responses, test error paths explicitly. **Address in Phase 1: Core MCP Server**

8. **Server termination not detected over stdio** - Server crash/kill not detected by client; calls hang indefinitely until application timeout. Solution: Implement timeouts on all MCP calls (asyncio.wait_for or Promise.race), reasonable timeout values (30s for search), monitor server health separately. **Address in Phase 1: Transport Layer**

## Implications for Roadmap

Based on research, suggested four-phase structure with clear dependencies:

### Phase 1: Foundation & MCP Core
**Rationale:** Must establish working MCP protocol communication before adding authentication or API calls. This phase validates build configuration, TypeScript/Zod/SDK integration, and stdio transport. Critical to address stdout corruption and exception handling pitfalls from day one.

**Delivers:** MCP server that responds to Claude Code; registers in client; exposes placeholder `grounded_search` tool; returns mock data

**Addresses features:**
- Single grounded_search tool (schema definition only)
- Input validation (Zod schema with constraints)
- Clear error messages (error handling infrastructure)

**Avoids pitfalls:**
- Pitfall 1: Logging infrastructure uses stderr exclusively
- Pitfall 2: Tool schema uses only basic JSON Schema features, tested against Claude Desktop
- Pitfall 7: Explicit error handling pattern with structured responses
- Pitfall 8: Implement timeouts on tool calls

**Technical scope:**
- Project setup: package.json with type: module, tsconfig with Node16 + strict mode
- Transport layer: StdioServerTransport with McpServer class
- Tool registry: `grounded_search` with Zod schema (query: string, model: optional enum, thinking: optional boolean)
- Logging utility: stderr-only logger with log levels
- Error handling: Try/catch wrapper returning `CallToolResult` with isError flag

**Research flag:** Standard MCP patterns, well-documented. Skip `/gsd:research-phase`.

---

### Phase 2: OAuth Authentication
**Rationale:** Auth required before any API calls work. Implement one flow initially (device code recommended - CLI-friendly, simpler than loopback). Must address token race conditions and secure storage from the start - technical debt here becomes security vulnerability.

**Delivers:** OAuth device code flow; token persistence; automatic refresh; credentials stored in OS keychain (or documented path to migrate from file-based storage)

**Addresses features:**
- Authentication persistence (store tokens, auto-refresh)
- Clear error messages for auth states (not authenticated, expired, refresh failed)

**Uses stack elements:**
- google-auth-library with PKCE support
- node-keytar for OS keychain access (or defer to Phase 4 polish)

**Avoids pitfalls:**
- Pitfall 3: Token refresh mutex prevents race conditions
- Pitfall 6: Secure credential storage (keychain preferred, encrypted file minimum)

**Technical scope:**
- Auth manager: TokenStore class with getValidToken(), isExpired(), refresh logic
- OAuth flows: Device code flow with Google OAuth endpoints
- Token storage: Implement keychain integration OR file-based with clear migration path documented
- Refresh mutex: Ensure only one refresh operation at a time, queue pending requests
- Proactive refresh: Check expiration with 5-minute buffer, refresh at 80% lifetime

**Research flag:** Standard OAuth patterns with Google-specific examples. Skip `/gsd:research-phase`.

---

### Phase 3: API Integration & Search Grounding
**Rationale:** Core value delivery. Now that auth works, implement actual search functionality. Two-stage orchestration pattern is critical - native grounding is passive and unreliable. Must implement exponential backoff from the start to prevent rate limit death spiral.

**Delivers:** Working search via Antigravity API; structured citations; search query transparency; validates grounding occurred

**Addresses features:**
- Real-time results (API call to Google Search)
- Source citations with URLs (parse groundingMetadata.groundingChunks)
- Search queries transparency (surface webSearchQueries)
- Model selection parameter (route to gemini-3-flash vs gemini-3-pro)
- Thinking level configuration (map to thinkingConfig.thinkingLevel)

**Implements architecture:**
- API Orchestrator component with two-stage search pattern
- Response parser for groundingMetadata extraction
- Request formatter with required headers (User-Agent: antigravity/1.15.8)

**Avoids pitfalls:**
- Pitfall 4: Exponential backoff with jitter, honor Retry-After, max retries
- Pitfall 5: Two-stage pattern with groundingMetadata validation

**Technical scope:**
- API client: HTTP client using native fetch with bearer token auth
- Two-stage orchestration: Make dedicated call with ONLY `{ googleSearch: {} }` tool, no functionDeclarations
- Response parser: Extract text, groundingChunks (titles/URLs), webSearchQueries, searchEntryPoint
- Grounding validation: Check for groundingMetadata presence, warn if absent
- Retry logic: Exponential backoff `min(2^n + random(0-1000)ms, 32s)`, max 5 attempts
- Error handling: Translate API errors to actionable messages (auth, rate limit, server error)

**Research flag:** Two-stage pattern validated in custom research but requires implementation validation. Consider `/gsd:research-phase` if API behavior differs from documented.

---

### Phase 4: Enhancement & Polish
**Rationale:** Once core works, add features that improve UX but aren't critical for MVP validation. This phase includes second auth method (loopback), confidence scores, better error messages, and migration to full keychain storage if deferred.

**Delivers:** Loopback OAuth flow; confidence scores in output; enhanced error messages; production-ready credential storage

**Addresses features:**
- Second auth method (loopback OAuth for desktop environments with browser)
- Confidence scores (surface grounding support scores)
- Enhanced error handling (user-friendly messages with recovery suggestions)

**Technical scope:**
- Loopback OAuth: Local HTTP server for OAuth redirect, auto-open browser
- Confidence scores: Pass through grounding support scores (0-1) in tool response
- Error message enhancement: Add recovery instructions, link to docs
- Keychain migration: If file-based in Phase 2, migrate to node-keytar
- Configuration externalization: Allow model/thinking level via config file or env vars

**Research flag:** Standard patterns, defer research unless blocking issues emerge.

---

### Phase Ordering Rationale

- **Phase 1 first**: Cannot test auth or API calls without working MCP protocol communication. Stdio corruption is instant failure. Must establish foundation.
- **Phase 2 before Phase 3**: API requires authentication. Token race conditions must be solved before load testing. Secure storage prevents technical debt becoming security vulnerability.
- **Phase 3 delivers MVP**: With auth working, search implementation completes minimum viable product. Two-stage pattern validated here.
- **Phase 4 deferred**: Loopback OAuth, confidence scores, and polish features improve UX but aren't critical for validating core value proposition (better grounding than WebSearch).

**Dependency chain from architecture:**
```
Phase 1: Transport + Protocol
    └─enables─> Phase 2: Auth Manager
                    └─enables─> Phase 3: API Orchestrator
                                    └─enables─> Phase 4: Enhancements
```

**Pitfall mitigation timeline:**
- Phase 1: Pitfalls 1, 2, 7, 8 (protocol/transport)
- Phase 2: Pitfalls 3, 6 (auth security)
- Phase 3: Pitfalls 4, 5 (API reliability)
- Phase 4: Polish and edge cases

### Research Flags

**Needs deeper research during planning:**
- **Phase 3 (API Integration)**: Two-stage orchestration pattern validated conceptually but may need implementation research if Antigravity API behavior differs from documentation. The custom research files provide foundation but API is Google-internal endpoint with sparse public docs. Recommendation: Attempt implementation first, invoke `/gsd:research-phase` if API responses don't match expected format or grounding fails silently.

**Standard patterns (skip research-phase):**
- **Phase 1 (Foundation)**: MCP SDK patterns thoroughly documented in official docs and Context7. Stdio transport is standard. Skip research.
- **Phase 2 (OAuth)**: Google OAuth with PKCE is standard, well-documented. Token refresh patterns established. google-auth-library examples abundant. Skip research.
- **Phase 4 (Polish)**: Loopback OAuth, error messaging, config management all standard patterns. Skip research.

**Research completed pre-planning:**
- STACK.md: HIGH confidence across all technologies
- FEATURES.md: HIGH confidence, validated against MCP best practices and competitor analysis
- ARCHITECTURE.md: HIGH confidence, standard MCP patterns
- PITFALLS.md: HIGH confidence, sourced from official specs and community reports

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Official MCP SDK (v1.25.3) with HIGH source reputation; Zod v4 documented; google-auth-library standard; Node.js 20 LTS stable. All versions verified. |
| Features | **HIGH** | MCP best practices documented; competitor analysis (Brave MCP, Perplexity, WebSearch) validated feature expectations; 65.9% citation trust stat from AI search report; feature dependencies mapped. |
| Architecture | **HIGH** | Standard MCP patterns from official docs; stdio transport well-understood; OAuth patterns documented; two-stage orchestration validated in custom research files; build order derived from dependency analysis. |
| Pitfalls | **HIGH** | Eight critical pitfalls sourced from MCP spec (transports, authorization), NearForm implementation guide, Google OAuth best practices, community GitHub issues (Python SDK #396), security analysis from Red Hat. All prevention strategies verified. |

**Overall confidence:** **HIGH**

Research across all four areas meets HIGH confidence threshold. Primary sources used throughout (official MCP docs, Google documentation, established libraries). Community sources (Medium, DEV Community) used only for validation and supplementary examples, not core recommendations.

### Gaps to Address

While overall confidence is high, three areas require validation during implementation:

1. **Antigravity API sandbox stability** - API endpoint is `daily-cloudcode-pa.sandbox.googleapis.com`, a Google-internal sandbox. Custom research files provide API structure but production stability unknown. **Mitigation:** Phase 3 should include API health monitoring; document fallback to production endpoint if sandbox proves unreliable. Risk is LOW - Gemini CLI uses this endpoint successfully.

2. **Token lifetime and rotation** - google-auth-library documentation states automatic refresh but doesn't specify token lifetime or rotation policy. Custom research mentions Intuit's 5-year max lifetime as example but Google's policy unclear. **Mitigation:** Implement expiration monitoring in Phase 2; log actual token lifetimes during development; validate refresh works before expiration reaches edge cases.

3. **MCP Schema validation variance across clients** - Pitfall 2 documents GitHub Copilot and Azure AI Foundry have different validation rules than Claude Desktop. **Mitigation:** Phase 1 testing should validate schema against Claude Desktop + one additional client (GitHub Copilot recommended). If deployment targets expand, test each client explicitly.

4. **Grounding reliability with two-stage pattern** - Custom research validates two-stage orchestration concept but actual implementation success rate unknown. Does googleSearch-only call guarantee grounding 100% of time? **Mitigation:** Phase 3 should log groundingMetadata presence for all calls; if success rate < 95%, invoke `/gsd:research-phase` to investigate prompt engineering or alternative approaches.

## Sources

### Primary Sources (HIGH confidence)

**Official MCP Documentation:**
- [MCP Architecture Overview](https://modelcontextprotocol.io/docs/learn/architecture) - Core architecture concepts, transport patterns
- [Build an MCP Server](https://modelcontextprotocol.io/docs/develop/build-server) - Official TypeScript tutorial with SDK examples
- [MCP TypeScript SDK GitHub](https://github.com/modelcontextprotocol/typescript-sdk) - v1.25.3 release notes, API reference, transport implementations
- [MCP Specification - Transports (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports) - stdio transport specification
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization) - OAuth 2.1 patterns for MCP
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) - Security guidelines for server implementation
- [Context7: /modelcontextprotocol/typescript-sdk](https://context7.com/modelcontextprotocol/typescript-sdk) - SDK documentation with HIGH source reputation

**Google Documentation:**
- [Google Auth Library npm](https://www.npmjs.com/package/google-auth-library) - v10.5.0 OAuth client with PKCE support
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices) - Recommended OAuth patterns
- [Grounding with Google Search - Vertex AI](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search) - Official grounding documentation
- [Google Grounding with Google Search - Gemini API](https://ai.google.dev/gemini-api/docs/google-search) - API reference for search grounding

**Stack Documentation:**
- [Zod Official Documentation v4](https://zod.dev/v4) - v4.3.5 release notes, performance improvements (6.5x faster than v3)
- [MCP Inspector GitHub](https://github.com/modelcontextprotocol/inspector) - Official testing tool

### Secondary Sources (MEDIUM confidence)

**Community Guides:**
- [NearForm: MCP Tips, Tricks and Pitfalls](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/) - Implementation best practices
- [Portal One: MCP Server with OAuth (TypeScript)](https://portal.one/blog/mcp-server-with-oauth-typescript/) - OAuth integration patterns
- [15 Best Practices for Building MCP Servers](https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/) - Production readiness
- [MCP Architecture Guide - DEV Community](https://dev.to/danishashko/mcp-server-architecture-a-developers-guide-3m28) - Component patterns
- [Error Handling in MCP Servers - Stainless](https://www.stainless.com/mcp/error-handling-and-debugging-mcp-servers) - Error handling strategies

**Security & OAuth:**
- [OAuth Concurrency - Nango Blog](https://nango.dev/blog/concurrency-with-oauth-token-refreshes) - Token race condition solutions
- [OAuth 2.0 Best Practices RFC 9700 - WorkOS](https://workos.com/blog/oauth-best-practices) - Industry OAuth patterns
- [MCP Security Risks - Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls) - Security analysis
- [Node-Keytar Secure Storage](https://cameronnokes.com/blog/how-to-securely-store-sensitive-information-in-electron-with-node-keytar/) - Keychain integration

**Pitfall Documentation:**
- [MCP Python SDK Issue #396](https://github.com/modelcontextprotocol/python-sdk/issues/396) - Exception handling behavior
- [MCP JSON Schema Issues - GitHub](https://github.com/directus/directus/issues/25906) - Schema validation variance
- [Debugging MCP Servers - mcpevals.io](https://www.mcpevals.io/blog/debugging-mcp-servers-tips-and-best-practices) - Common debugging scenarios

**Feature Research:**
- [AI Search Engines Report 2026](https://www.allaboutai.com/resources/ai-statistics/ai-search-engines/) - User expectations (65.9% citation trust)
- [AI Citation Problem - Columbia Journalism Review](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php) - Citation quality analysis

**Implementations:**
- [Brave Search MCP Server](https://github.com/brave/brave-search-mcp-server) - Reference MCP search implementation
- [Integrating MCP Servers with Claude Code](https://intuitionlabs.ai/articles/mcp-servers-claude-code-internet-search) - Integration patterns

### Tertiary Sources (Project-Specific Research)

**Custom Research Files (HIGH confidence for project-specific patterns):**
- `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md` - Antigravity API capabilities, two-stage orchestration pattern
- `custom_research/2026-02-03-oauth-auth-research.md` - OAuth flow comparison for this specific project
- `custom_research/2026-02-03-research-tools-handoff.md` - Authentication patterns specific to Antigravity

---
*Research completed: 2026-02-03*
*Ready for roadmap: yes*
