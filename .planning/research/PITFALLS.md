# Pitfalls Research

**Domain:** MCP Server with Google Grounded Search (via Antigravity/Cloud Code Assist API)
**Researched:** 2026-02-03
**Confidence:** HIGH (verified with official MCP spec, Google docs, and community reports)

## Critical Pitfalls

### Pitfall 1: stdout Corruption Kills stdio Transport

**What goes wrong:**
Any non-JSON-RPC output written to stdout corrupts the MCP protocol stream. This includes `console.log()` statements, library banners, initialization messages, or debug output. A single stray character causes the client to fail parsing and crashes the session.

**Why it happens:**
Developers use `console.log()` for debugging out of habit. Some libraries print initialization messages to stdout. Error handling code may accidentally write to stdout instead of stderr.

**How to avoid:**
- Use `console.error()` exclusively for logging (goes to stderr)
- Configure logging frameworks to write to stderr only
- Implement mode-aware logging: different behavior for CLI mode vs MCP mode
- Test server output in isolation before connecting to MCP client
- For Python: set `PYTHONUNBUFFERED=1` and use `sys.stderr` for all debug output
- For Node.js: `process.stderr.write()` for any diagnostic output

**Warning signs:**
- JSON parse errors in MCP client logs
- "Invalid JSON" or "Unexpected token" errors
- Server appears to connect but immediately fails
- Works in CLI mode but fails in MCP mode

**Phase to address:**
Phase 1 (Core MCP Server Setup) - Establish correct logging infrastructure from day one

---

### Pitfall 2: JSON Schema Draft Incompatibility

**What goes wrong:**
MCP tool schemas using JSON Schema Draft 2020-12 features (like `$dynamicRef`, `anyOf`, nullable unions) are rejected by various MCP clients. GitHub Copilot, Azure AI Foundry, and other clients enforce strict schema validation that only supports a limited subset of JSON Schema.

**Why it happens:**
Different MCP clients implement different JSON Schema validators with varying levels of support. The MCP spec doesn't mandate a specific JSON Schema draft version. Developers copy schema patterns from other contexts that don't apply to MCP.

**How to avoid:**
- Use only basic JSON Schema features: `type`, `properties`, `required`, `description`, `enum`
- Avoid: `anyOf`, `oneOf`, `$ref`, `$dynamicRef`, nullable unions
- Always include `items` property when `type: "array"`
- Property keys must match pattern `^[a-zA-Z0-9_.-]{1,64}$` - no brackets, no special chars
- Test schemas with multiple MCP clients (Claude Desktop, GitHub Copilot, VS Code)
- Validate schemas against each target client's requirements

**Warning signs:**
- "Invalid tool schema" errors
- Tools discovered but marked as "omitted due to invalid schemas"
- Tool works in one client but fails in another
- Schema validation errors mentioning unsupported keywords

**Phase to address:**
Phase 1 (Tool Schema Design) - Define schema constraints before implementing tools

---

### Pitfall 3: OAuth Token Race Conditions

**What goes wrong:**
Multiple concurrent requests trigger simultaneous token refresh attempts. Without synchronization, each request gets a different refresh token, and only one succeeds. The others invalidate each other, causing cascading auth failures.

**Why it happens:**
OAuth refresh tokens are typically single-use. When the access token expires, multiple concurrent requests all detect expiration and attempt refresh simultaneously. The authorization server issues new tokens for each request, invalidating previous refresh tokens.

**How to avoid:**
- Implement a token refresh mutex/lock - only one refresh operation at a time
- Queue requests during refresh - hold pending requests until new token arrives
- Proactive refresh - refresh tokens before expiration (e.g., at 80% of lifetime)
- Use token refresh middleware that handles this automatically
- Consider refresh token rotation support if the auth server provides it

**Warning signs:**
- Intermittent 401 errors under load
- Auth failures that succeed on retry
- "Invalid refresh token" errors appearing randomly
- Auth works for single requests but fails with concurrent requests

**Phase to address:**
Phase 2 (OAuth Integration) - Design token management before implementing API calls

---

### Pitfall 4: Missing Exponential Backoff Causes Rate Limit Death Spiral

**What goes wrong:**
When hitting Google API rate limits (429 errors), immediate retries amplify the problem. Without proper backoff, the client hammers the API, extends the rate limit window, and may trigger more aggressive rate limiting or temporary bans.

**Why it happens:**
Developers implement simple retry logic without backoff. Under load, synchronized clients retry simultaneously, creating "thundering herd" effect. Free/sandbox tier has aggressive rate limits that are easily exceeded.

**How to avoid:**
- Implement exponential backoff: `wait = min(2^n + random_ms, max_backoff)`
- Add jitter (random delay) to prevent synchronized retries
- Honor `Retry-After` headers from Google API responses
- Set maximum retry count (e.g., 5 attempts) to prevent infinite loops
- Use max backoff ceiling (typically 32-64 seconds)
- Consider circuit breaker pattern for sustained failures

**Warning signs:**
- Escalating 429 errors under load
- Response times growing during high traffic
- Rate limit errors persisting longer than expected
- Multiple instances hitting limits simultaneously

**Phase to address:**
Phase 3 (API Integration) - Implement retry logic before production use

---

### Pitfall 5: Grounding Is Model-Controlled (Passive, Not Active)

**What goes wrong:**
Developers expect Google Search grounding to always search. But native grounding is passive - the model decides whether to search based on its judgment. For many queries, the model decides it "knows" the answer and skips the search, returning stale or hallucinated information.

**Why it happens:**
Grounding with Google Search is a tool the model may choose to use, not a guarantee. The model's training data may make it confident about topics where search would actually help. There's no API flag to force grounding on every request.

**How to avoid:**
- Use two-stage pattern: First call requests search explicitly, second call uses grounded results
- Check response for `groundingMetadata` to verify search occurred
- If `searchEntryPoint` field is present, grounding happened; if absent, model skipped search
- For critical queries, validate that grounding occurred and retry with modified prompt if not
- Consider temperature=1.0 as Google recommends for grounding

**Warning signs:**
- Responses lack `groundingMetadata` object
- Results match model's training data rather than current information
- Inconsistent search behavior for similar queries
- No `searchEntryPoint` in response metadata

**Phase to address:**
Phase 3 (Grounding Implementation) - Design two-stage pattern from the start

---

### Pitfall 6: Credential Storage in Plain Text

**What goes wrong:**
OAuth tokens stored in plain text config files, environment variables in cleartext, or unencrypted local storage. A single breach exposes all user credentials. Attackers with file system access can steal tokens and impersonate users.

**Why it happens:**
Config files are convenient for development. Environment variables seem "hidden enough." Desktop apps don't have server-side secure storage. Developers prioritize functionality over security in early phases.

**How to avoid:**
- Use OS-native secure storage: macOS Keychain, Windows Credential Manager, Linux Secret Service/keyring
- For Node.js: use `node-keytar` for cross-platform keychain access
- Never store tokens in plain text files, environment variables, or localStorage
- Encrypt tokens at rest if OS keychain isn't available
- Implement token revocation on logout/uninstall
- Use short-lived access tokens (hourly expiration) with secure refresh token storage

**Warning signs:**
- Tokens visible in config files
- Credentials logged or exposed in error messages
- No encryption at rest for stored credentials
- Single credential breach affects all users

**Phase to address:**
Phase 2 (OAuth Integration) - Implement secure storage before storing any credentials

---

### Pitfall 7: MCP Tool Call Exceptions Return Success with Error Text

**What goes wrong:**
In Python MCP SDK, exceptions in `@app.call_tool` handlers are caught and returned as successful responses with the exception message in the content field. The client sees HTTP 200 with error text instead of a proper JSON-RPC error. This breaks error handling and makes debugging difficult.

**Why it happens:**
The Python SDK has inconsistent exception handling between different handler types. `@app.list_resources` correctly translates exceptions to McpError, but `@app.call_tool` swallows them. This is a known issue in the SDK.

**How to avoid:**
- Explicitly catch exceptions and return proper error responses using `CallToolResult` with `isError=True`
- Never rely on exception propagation for error signaling in tool handlers
- Wrap tool handler bodies in try/catch and return structured error responses
- Test error paths explicitly - don't assume exceptions will surface correctly
- Consider using TypeScript SDK if Python SDK limitations are blocking

**Warning signs:**
- LLM receives "success" responses containing error messages
- Error handling logic never triggers
- Debugging shows exceptions occurring but client doesn't see errors
- Retry logic doesn't activate on failures

**Phase to address:**
Phase 1 (Core MCP Server) - Implement explicit error handling pattern in first tool

---

### Pitfall 8: Server Termination Not Detected Over stdio

**What goes wrong:**
When the MCP server process terminates abruptly (crash, sys.exit, kill), the client connected via stdio doesn't detect the broken pipe. Client calls hang indefinitely waiting for a response that will never come, until application-level timeout expires.

**Why it happens:**
The stdio transport doesn't have built-in heartbeat or connection health checks. EOF/broken pipe detection is not properly surfaced in the Python SDK's transport layer. The client has no way to distinguish "server is thinking" from "server is dead."

**How to avoid:**
- Implement application-level timeouts on all MCP calls (e.g., `asyncio.wait_for`)
- Set reasonable timeout values based on expected operation duration
- Implement heartbeat/ping mechanism if using long-running operations
- Monitor server process health separately from MCP communication
- Consider using Streamable HTTP transport for better connection health visibility

**Warning signs:**
- Client hangs indefinitely on requests
- No error surfaced when server crashes
- Application freezes require manual intervention
- Can't distinguish slow response from dead server

**Phase to address:**
Phase 1 (Transport Layer) - Implement timeouts from first MCP call

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing tokens in env vars | Easy setup, no keychain deps | Security vulnerability, credential leak risk | Never in production; dev-only with clear warnings |
| Skipping schema validation | Faster development, less boilerplate | Client compatibility issues surface late | Never - validate schemas against target clients early |
| Single retry without backoff | Handles transient failures | Rate limit death spiral under load | Only for truly rare errors, not rate limits |
| Global state for user context | Simpler code, fewer parameters | User data leakage between requests | Never - always scope state to request/session |
| Trusting grounding will occur | Simpler flow, one API call | Stale/hallucinated results when model skips search | Never for critical queries; always verify metadata |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Grounding API | Mixing grounding with function declarations | Use grounding and function calling in separate requests - they cannot coexist |
| Google Grounding API | Using production endpoint during development | Use sandbox endpoint for dev - production is rate-limited aggressively |
| Antigravity API | Wrong headers or version mismatch | Match headers exactly to Antigravity version (1.15.8 requires specific header format) |
| OAuth Provider | Assuming refresh tokens are permanent | Tokens may have max lifetime (e.g., Intuit: 5 years) - implement rotation |
| MCP Client | Returning non-JSON-RPC to stdout | Reserve stdout exclusively for protocol; use stderr for everything else |
| MCP Client | Expecting all clients to support same schema features | Test with each target client - validation varies significantly |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No request queuing | Concurrent requests cause token race conditions | Implement mutex on token refresh | 5+ concurrent users |
| No rate limit tracking | Sudden 429 errors under load | Track quota usage, implement client-side limits | Approaching quota ceiling |
| Unbounded response sizes | Timeouts, memory spikes, token budget exhaustion | Paginate results, summarize large responses | Responses > 10KB |
| Synchronous grounding calls | Blocked threads, poor throughput | Use async patterns, queue long operations | 10+ requests/second |
| No circuit breaker | Cascading failures when downstream fails | Implement circuit breaker with failure thresholds | Sustained downstream outage |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| OAuth tokens in MCP tool descriptions | Tokens visible to AI model, potential leakage | Never embed secrets in tool metadata; use server-side secure storage |
| Single shared credential for all users | One breach compromises everyone | User-scoped tokens with proper isolation |
| Tool description injection | Hidden instructions in Unicode affect AI behavior | Sanitize tool definitions, scan for invisible characters |
| Over-permissioning MCP tools | AI can perform destructive actions | Least-privilege design; separate read/write tools |
| No authentication on remote MCP server | Anyone can access internal tools | Implement OAuth 2.1 per MCP spec; never expose unauthenticated |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Exposing raw grounding errors | Users see cryptic API errors | Translate errors to actionable messages; suggest retry |
| No feedback during slow grounding | Users think app is frozen | Show "Searching..." indicator; implement progress updates |
| Silent grounding failures | Users get stale answers without knowing | Indicate when response is grounded vs. from model knowledge |
| Tool names overlap | AI picks wrong tool, confusing results | Distinct, descriptive tool names; clear separation of concerns |
| Massive search results | Token budget exhaustion, slow responses | Paginate, summarize, or provide drill-down tools |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **OAuth flow:** Often missing token refresh handling - verify refresh actually works when access token expires
- [ ] **Error handling:** Often missing timeout logic - verify hangs don't occur when server/API is slow
- [ ] **Grounding:** Often missing metadata validation - verify `groundingMetadata` presence confirms search occurred
- [ ] **Tool schemas:** Often missing multi-client testing - verify schema works in Claude Desktop, Copilot, etc.
- [ ] **Logging:** Often missing stderr redirection - verify zero stdout pollution in MCP mode
- [ ] **Rate limiting:** Often missing backoff - verify 429s don't cause retry storms
- [ ] **Credential storage:** Often missing encryption - verify tokens aren't in plain text files

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| stdout corruption | LOW | Add stderr-only logging; restart server |
| Schema incompatibility | MEDIUM | Simplify schemas to basic types; redeploy; re-test with affected clients |
| Token race condition | MEDIUM | Implement refresh mutex; clear corrupted tokens; re-authenticate users |
| Rate limit death spiral | LOW | Stop retries; wait for quota reset; implement backoff before resuming |
| Grounding not occurring | LOW | Modify prompts to request search explicitly; implement two-stage pattern |
| Plain text token exposure | HIGH | Rotate all credentials immediately; migrate to secure storage; notify affected users |
| Exception swallowing | MEDIUM | Refactor handlers with explicit error returns; add error response tests |
| Server crash undetected | LOW | Add timeouts to all calls; implement health monitoring |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| stdout corruption | Phase 1: Core MCP Setup | Zero stdout output when running in MCP mode; all logs on stderr |
| Schema incompatibility | Phase 1: Tool Design | Schemas validated against Claude Desktop + one other client |
| Token race conditions | Phase 2: OAuth Integration | Concurrent request test passes without auth errors |
| Rate limit death spiral | Phase 3: API Integration | Load test shows graceful degradation under rate limits |
| Passive grounding | Phase 3: Grounding | groundingMetadata presence verified for all search queries |
| Plain text credentials | Phase 2: OAuth Integration | Security audit shows no plain text tokens in filesystem |
| Exception swallowing | Phase 1: Core MCP Setup | Error handler test confirms proper JSON-RPC errors returned |
| Server crash undetected | Phase 1: Transport Layer | Timeout test confirms client recovers from server crash |

## Sources

- [MCP Specification - Transports (2025-06-18)](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)
- [MCP Implementation Tips, Tricks and Pitfalls - Nearform](https://nearform.com/digital-community/implementing-model-context-protocol-mcp-tips-tricks-and-pitfalls/)
- [MCP Authorization Specification](https://modelcontextprotocol.io/specification/draft/basic/authorization)
- [MCP Security Risks - Red Hat](https://www.redhat.com/en/blog/model-context-protocol-mcp-understanding-security-risks-and-controls)
- [MCP Python SDK Issue #396 - Exception Handling](https://github.com/modelcontextprotocol/python-sdk/issues/396)
- [Error Handling in MCP Servers - Stainless](https://www.stainless.com/mcp/error-handling-and-debugging-mcp-servers)
- [Debugging MCP Servers - mcpevals.io](https://www.mcpevals.io/blog/debugging-mcp-servers-tips-and-best-practices)
- [OAuth Concurrency - Nango Blog](https://nango.dev/blog/concurrency-with-oauth-token-refreshes)
- [OAuth 2.0 Best Practices RFC 9700 - WorkOS](https://workos.com/blog/oauth-best-practices)
- [Google OAuth Best Practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)
- [Google Grounding with Google Search - Vertex AI Docs](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search)
- [Gemini API Grounding Billing 2026](https://aiexpertreviewer.com/gemini-grounding-billing-2026/)
- [Handling 429 Rate Limit Errors - Google Cloud Blog](https://cloud.google.com/blog/products/ai-machine-learning/learn-how-to-handle-429-resource-exhaustion-errors-in-your-llms)
- [MCP JSON Schema Issues - GitHub Issues](https://github.com/directus/directus/issues/25906)
- [Node-Keytar Secure Storage](https://cameronnokes.com/blog/how-to-securely-store-sensitive-information-in-electron-with-node-keytar/)

---
*Pitfalls research for: MCP Server with Google Grounded Search*
*Researched: 2026-02-03*
