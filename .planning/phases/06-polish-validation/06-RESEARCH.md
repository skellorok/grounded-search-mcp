# Phase 6: Polish & Validation - Research

**Researched:** 2026-02-04
**Domain:** QA/Validation, Documentation, Release Preparation
**Confidence:** HIGH (implementation review + authoritative sources)

## Summary

Phase 6 validates existing implementations and prepares for public release. Research reveals that the core success criteria (exponential backoff, concurrent refresh mutex, transient failure recovery) are already implemented in earlier phases - this phase validates they work correctly together and documents the system.

Key findings:
1. **Implementation is complete** - All error handling, retry logic, and concurrency controls exist in `src/auth/refresh.ts` and `src/api/search.ts`
2. **WebSearch uses Brave Search** - Claude's WebSearch uses Brave Search API at $10/1000 searches + token costs; grounded_search uses Google via Gemini
3. **Testing infrastructure exists** - Vitest 3.2.x with MSW for network mocking is the standard approach
4. **GSD agents have tool lists as hard constraints** - Override requires modifying agent frontmatter or using MCP tool discovery
5. **All dependencies are MIT licensed** - MIT license is appropriate for this project

**Primary recommendation:** Focus on validation testing with documented scenarios, create comprehensive README following MCP conventions, and document WebSearch comparison empirically.

## Standard Stack

### Core (Already in place)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 3.2.x | Unit testing | Already configured, concurrent test support, Vite-native |
| msw | 2.x | Network mocking | Recommended by Vitest docs for HTTP request mocking |

### Supporting (For Phase 6)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| msw/node | 2.x | Node.js request interception | Mock API responses in validation tests |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| msw | nock | MSW is more modern, better Vitest integration |
| manual mocks | vi.mock() | MSW provides request-level mocking, closer to real behavior |

**Installation:**
```bash
npm install -D msw@latest
```

## Architecture Patterns

### Recommended Test Structure

```
src/
├── auth/
│   └── refresh.test.ts      # Token refresh + deduplication tests
├── api/
│   └── search.test.ts       # Search with fallback tests
├── config/
│   └── storage.test.ts      # Config loading/saving tests
└── __mocks__/
    └── handlers.ts          # MSW request handlers
```

### Pattern 1: MSW Network Mocking for Validation

**What:** Use MSW to simulate API responses including errors, timeouts, and rate limits
**When to use:** Testing error handling, fallback behavior, retry logic
**Example:**
```typescript
// Source: Vitest docs - mocking requests
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'

const server = setupServer(
  http.post('*/v1internal:generateContent', () => {
    return HttpResponse.json({
      response: { candidates: [{ content: { parts: [{ text: 'result' }] } }] }
    })
  })
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Override for specific tests
it('handles 429 rate limit', async () => {
  server.use(
    http.post('*/v1internal:generateContent', () => {
      return HttpResponse.json({ error: 'Rate limited' }, { status: 429 })
    })
  )
  // Test fallback behavior
})
```

### Pattern 2: Concurrent Test Execution

**What:** Use `.concurrent` for parallel test execution to simulate concurrent API usage
**When to use:** Testing token refresh deduplication, race conditions
**Example:**
```typescript
// Source: Vitest docs - concurrent tests
import { describe, it } from 'vitest'

describe.concurrent('token refresh deduplication', () => {
  it.concurrent('parallel call 1', async ({ expect }) => {
    const token = await getValidAccessToken('antigravity')
    expect(token).toBeDefined()
  })

  it.concurrent('parallel call 2', async ({ expect }) => {
    const token = await getValidAccessToken('antigravity')
    expect(token).toBeDefined()
  })
})
```

### Anti-Patterns to Avoid

- **Testing implementation details:** Test observable behavior (API responses), not internal state
- **Skipping error scenarios:** Every error path in the code needs a corresponding test
- **Not cleaning up handlers:** Always `server.resetHandlers()` between tests

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Network request mocking | Manual fetch override | MSW | Handles edge cases, interceptor cleanup, better DX |
| Test parallelization | Manual Promise.all | Vitest .concurrent | Built-in isolation, proper context handling |
| Timeout simulation | setTimeout in handlers | AbortSignal.timeout | Native, cleaner, more reliable |

**Key insight:** Vitest + MSW combination is the established pattern for testing network-dependent code in Node.js.

## Common Pitfalls

### Pitfall 1: Concurrent Test State Leakage

**What goes wrong:** Parallel tests share state (like the `refreshPromises` Map in refresh.ts)
**Why it happens:** Global singletons don't reset between concurrent tests
**How to avoid:** Either run token refresh tests sequentially OR mock the refresh module entirely
**Warning signs:** Tests pass individually but fail when run together

### Pitfall 2: MSW Handler Order Matters

**What goes wrong:** Generic handlers override specific ones
**Why it happens:** MSW matches first matching handler
**How to avoid:** `server.use()` overrides take precedence; define specific handlers in tests, not setup
**Warning signs:** Mocked error scenarios return success responses

### Pitfall 3: Async Cleanup Race Conditions

**What goes wrong:** Test completes before async cleanup finishes
**Why it happens:** `afterEach` returns before async operations complete
**How to avoid:** Always `await` async cleanup, use Vitest's cleanup function return pattern
**Warning signs:** "Cannot read property of undefined" errors after tests pass

### Pitfall 4: WebSearch Comparison Bias

**What goes wrong:** Comparing tools on different queries or contexts
**Why it happens:** Each tool may excel at different query types
**How to avoid:** Use identical queries, compare same response aspects, document methodology
**Warning signs:** Results favor one tool suspiciously consistently

## Code Examples

### Token Refresh Deduplication Test

```typescript
// Test that concurrent refresh calls deduplicate
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getValidAccessToken } from '../auth/refresh.js'

describe('token refresh deduplication', () => {
  let refreshCallCount = 0

  beforeEach(() => {
    refreshCallCount = 0
    // Mock to count actual refresh attempts
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      if (url.includes('oauth2.googleapis.com/token')) {
        refreshCallCount++
        await new Promise(r => setTimeout(r, 100)) // Simulate network delay
        return new Response(JSON.stringify({
          access_token: 'new_token',
          expires_in: 3600
        }))
      }
      return new Response('', { status: 404 })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('deduplicates concurrent refresh requests', async () => {
    // Simulate concurrent calls while token is expired
    const results = await Promise.all([
      getValidAccessToken('antigravity'),
      getValidAccessToken('antigravity'),
      getValidAccessToken('antigravity'),
    ])

    // All should get same token
    expect(results).toEqual(['new_token', 'new_token', 'new_token'])
    // But only ONE refresh call should have been made
    expect(refreshCallCount).toBe(1)
  })
})
```

### Error Response Validation Test

```typescript
// Test error formatting consistency
import { describe, it, expect } from 'vitest'
import { formatErrorResponse } from '../api/response.js'

describe('error response formatting', () => {
  it('formats 401 errors with re-auth instructions', () => {
    const result = formatErrorResponse(401, 'Unauthorized', 'antigravity')

    expect(result).toContain('## Authentication Error')
    expect(result).toContain('auth --login antigravity')
    expect(result).toContain('**To fix:**')
  })

  it('formats 429 rate limits with guidance', () => {
    const result = formatErrorResponse(429, 'Too many requests', 'gemini')

    expect(result).toContain('## Rate Limited')
    expect(result).toContain('Wait a few minutes')
    expect(result).toContain('auth --default-provider')
  })
})
```

### Config Loading Graceful Fallback Test

```typescript
// Test config loading handles corruption gracefully
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadConfig } from '../config/storage.js'
import { DEFAULT_CONFIG } from '../config/defaults.js'
import * as fs from 'node:fs/promises'

vi.mock('node:fs/promises')

describe('config loading', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns defaults on corrupt JSON', async () => {
    vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }')

    const config = await loadConfig()

    expect(config).toEqual(DEFAULT_CONFIG)
  })

  it('returns defaults on missing file', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException
    error.code = 'ENOENT'
    vi.mocked(fs.readFile).mockRejectedValue(error)

    const config = await loadConfig()

    expect(config).toEqual(DEFAULT_CONFIG)
  })
})
```

## WebSearch Comparison Analysis

### Technical Differences

| Aspect | Claude WebSearch | grounded_search (This MCP) |
|--------|-----------------|---------------------------|
| **Search Provider** | Brave Search | Google (via Gemini) |
| **Cost** | $10/1000 searches + tokens | Free (uses Gemini API) |
| **How It Works** | Claude generates query, Brave returns results, Claude synthesizes | Gemini generates query, Google Search returns results, Gemini summarizes, then Claude uses |
| **Citations** | Built-in with `cited_text` | URLs in Sources section |
| **Rate Limits** | Anthropic rate limits | Gemini/Google rate limits |
| **Freshness** | Brave's index | Google's index |

### Token Usage Comparison (Hypothesis)

**grounded_search:**
- Query → Gemini (input tokens on Gemini, free tier)
- Response from Gemini → Claude (output tokens to Claude)
- Claude processes → Final response (output tokens from Claude)

**WebSearch:**
- Query → Claude (input tokens)
- Claude decides to search → Brave Search ($0.01)
- Results returned → Claude (counts as input tokens)
- Claude synthesizes → Final response (output tokens)

**Analysis:** grounded_search offloads search query generation and initial synthesis to Gemini (free), potentially reducing Claude token usage. WebSearch counts search results as input tokens. Actual comparison requires empirical measurement.

### Investigation Approach (From CONTEXT.md)

1. **Source analysis** - Confirmed: WebSearch uses Brave Search API
2. **Empirical testing** - Run identical queries, compare:
   - Response time
   - Source quality
   - Token counts (check usage in responses)
   - Search depth
3. **Documentation review** - Confirmed: Anthropic docs show $10/1000 searches

### Questions to Answer Empirically

| Question | How to Measure |
|----------|----------------|
| Does grounded_search save tokens? | Compare `usage.input_tokens` + `usage.output_tokens` for identical queries |
| Does Gemini intermediate step risk hallucination? | Review sources cited vs actual search results |
| Search depth comparison | Compare number of sources, diversity of domains |
| Response accuracy | Subjective comparison of factual accuracy |

## GSD Integration Patterns

### Agent Tool Declaration Analysis

From `gsd-phase-researcher.md` and `gsd-project-researcher.md`:
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
```

From `gsd-debugger.md`:
```yaml
tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch
```

**Key insight:** Tool lists in agent frontmatter are hard constraints. To use grounded_search:
1. User must add `mcp__gemini-search__*` to tools list
2. Or agent must use ToolSearch to discover available MCP tools

### Configuration Propagation Testing

| Approach | Where | Hypothesis |
|----------|-------|------------|
| PROJECT.md level | `.planning/PROJECT.md` | May propagate to spawned agents via orchestrator context |
| Per-phase CONTEXT.md | `.planning/phases/XX/CONTEXT.md` | Directly visible to phase agents |
| REQUIREMENTS.md | `.planning/REQUIREMENTS.md` | May be included in agent context |
| Agent override | `~/.claude/agents/` | User creates modified local copy |

### Override Mechanism (Conditional)

```markdown
# In agent modified_tools section (hypothetical override)
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__gemini-search__*

# Or in agent instructions:
"For web research, prefer grounded_search if available (check with ToolSearch).
Fall back to WebSearch if grounded_search is not configured."
```

### Testing Protocol

1. Create fresh test project (`~/test-gsd-integration/`)
2. Initialize GSD (`/gsd:new-project`)
3. Configure gemini-search-mcp in `.mcp.json`
4. Test each propagation approach:
   - Add to PROJECT.md: "Use grounded_search for all research"
   - Add to REQUIREMENTS.md as non-functional requirement
   - Add to phase CONTEXT.md
5. Spawn research agent, verify which tool is used
6. Document which approach actually works

## Documentation Structure

### README.md (Following MCP Conventions)

```markdown
# gemini-search-mcp

Google Search grounding via Gemini API for Claude Code

## Overview
[1-2 paragraphs explaining what this does and why]

## Quick Start
[Minimal setup for Claude Code users]

## Installation
[npm/GitHub install instructions]

## Configuration
[.mcp.json setup]

## Tools Reference

### grounded_search
[Parameters, examples, return format]

### auth
[All flags with examples]

### config
[All flags with examples]

## Authentication
[OAuth flow explanation for both providers]

## Why grounded_search?
[Brief comparison with WebSearch - link to detailed doc]

## GSD Integration
[Brief instructions - link to detailed doc]

## Architecture
[For developers: how it works internally]

## Contributing
[Standard open source contribution guide]

## License
MIT
```

### docs/websearch-comparison.md

```markdown
# WebSearch vs grounded_search Comparison

## Technical Differences
[Table from research]

## Token Usage Analysis
[Empirical results]

## When to Use Which
[Decision guide]

## Test Methodology
[How comparison was conducted]
```

### docs/gsd-integration.md

```markdown
# GSD Integration Guide

## Prerequisites
[gemini-search-mcp configured]

## Agent Override Approach
[Instructions for creating local agent overrides]

## Configuration Propagation
[Which methods work]

## Troubleshooting
[Common issues]
```

## License Selection

All direct dependencies use MIT license:
- @modelcontextprotocol/sdk: MIT
- env-paths: MIT
- pkce-challenge: MIT
- zod: MIT

The official MCP servers (filesystem, fetch, etc.) all use MIT license.

**Recommendation:** MIT License - consistent with ecosystem, permissive for users.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual fetch mocking | MSW | 2023+ | Better request interception, cleaner tests |
| Vitest 2.x | Vitest 3.x | Late 2025 | Improved concurrent test support |
| MCP SDK v1 | MCP SDK v2 (Q1 2026) | Upcoming | New Zod schema requirements |

**Deprecated/outdated:**
- nock for HTTP mocking: Still works but MSW is preferred
- vi.mock for fetch: Works but MSW provides better isolation

## Open Questions

### 1. Token Usage Measurement Methodology

**What we know:** WebSearch returns usage stats in response, grounded_search returns formatted markdown
**What's unclear:** How to compare total token cost fairly (Gemini tokens vs Claude tokens)
**Recommendation:** Focus on Claude token usage only (what user pays for) since Gemini is free tier

### 2. GSD Agent Override Propagation

**What we know:** Agent frontmatter tools are hard constraints
**What's unclear:** Which configuration propagation methods actually work for spawned agents
**Recommendation:** Empirical testing in Phase 6 execution, document findings

### 3. MCP SDK v2 Migration

**What we know:** v2 requires `z.object()` wrapping for schemas; v1 accepted raw shapes
**What's unclear:** When v2 becomes mandatory
**Recommendation:** Current code uses Zod correctly; monitor for v2 release

## Validation Scenarios

### Concurrency Scenarios

| Scenario | What to Verify | How to Test |
|----------|---------------|-------------|
| Parallel grounded_search calls | Token refresh deduplication | 3+ concurrent calls with expired token |
| Rapid-fire sequential searches | No rate limit death spiral | 10+ searches in quick succession |
| Mixed operations | No race conditions | search + auth --status + config --get simultaneously |

### Error Scenarios

| Scenario | What to Verify | How to Test |
|----------|---------------|-------------|
| Token expiry mid-search | Refresh + retry works | Mock token expiry during API call |
| Network interruption | Timeout + graceful error | Mock AbortSignal.timeout() |
| Invalid config file | Server starts with defaults | Write corrupt JSON to config path |
| 401/403 API response | Auth error with instructions | MSW handler returns 401 |
| 429 API response | Rate limit guidance shown | MSW handler returns 429 |
| 503 capacity error | Antigravity fallback works | MSW returns "No capacity available" |

### Additional Scenarios (Claude's Discretion)

| Scenario | What to Verify | How to Test |
|----------|---------------|-------------|
| Refresh token revoked | Clear error, re-auth instruction | Mock `invalid_grant` response |
| Both providers fail | No providers message | Mock failures for both |
| Malformed API response | Graceful handling, no crash | MSW returns invalid JSON |
| Empty search results | "No results found" message | MSW returns empty candidates |

## Sources

### Primary (HIGH confidence)

- Vitest docs (Context7 /vitest-dev/vitest) - Test patterns, MSW integration, concurrent tests
- MCP TypeScript SDK (Context7 /modelcontextprotocol/typescript-sdk) - Tool schema requirements
- Anthropic WebSearch docs (https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool) - WebSearch technical details

### Secondary (MEDIUM confidence)

- MCP servers repository (https://github.com/modelcontextprotocol/servers) - README patterns, license conventions
- npm package metadata - Dependency licenses verified

### Tertiary (LOW confidence)

- Web search results for GSD framework - Community patterns, may change

## Metadata

**Confidence breakdown:**
- Validation testing: HIGH - Vitest/MSW patterns verified with Context7
- Documentation: HIGH - MCP conventions verified from official repos
- WebSearch comparison: MEDIUM - Technical details confirmed, empirical comparison needs execution
- GSD integration: MEDIUM - Tool constraint verified, propagation needs testing
- Error handling review: HIGH - Implementation already reviewed, test patterns established

**Research date:** 2026-02-04
**Valid until:** 30 days (stable domain, established patterns)
