# google-grounded-search MCP Server

## What This Is

An MCP server that provides Google Search grounding via the Antigravity/Cloud Code Assist API, using a Google One AI Pro subscription. It offers significantly better search capabilities than Claude Code's built-in WebSearch tool by leveraging Google's search infrastructure with real-time results and source citations.

## Core Value

**Real-time, grounded web search with authoritative source citations** - every search returns actual current information from Google Search, not training data, with links to sources.

## Requirements

### Validated

(None yet - ship to validate)

### Active

- [ ] **AUTH-01**: User can authenticate via Gemini CLI device code flow (enter code from browser)
- [ ] **AUTH-02**: User can authenticate via Antigravity loopback flow with paste-back fallback
- [ ] **AUTH-03**: Authentication persists across MCP server restarts
- [ ] **AUTH-04**: User can trigger re-authentication when tokens expire
- [ ] **SEARCH-01**: MCP exposes `grounded_search` tool that performs Google-grounded search
- [ ] **SEARCH-02**: Search returns text response with source citations (URLs, titles)
- [ ] **SEARCH-03**: Search returns the actual queries Google used (for transparency)
- [ ] **SEARCH-04**: User can specify model via tool parameter (gemini-3-flash, gemini-3-pro, etc.)
- [ ] **SEARCH-05**: Support URL context analysis (fetch and analyze specific URLs)
- [ ] **CONFIG-01**: User can configure default model preference
- [ ] **CONFIG-02**: User can configure thinking level (high/low/minimal)
- [ ] **ERROR-01**: Unauthenticated state returns clear error with auth instructions
- [ ] **ERROR-02**: Unauthenticated state offers option to start auth flow

### Out of Scope

- Chat/conversation mode - MCP provides single-shot search tool only
- Multi-account rotation - leave for future version
- Non-search Gemini capabilities - focus on search grounding
- Claude models via Antigravity - focus on Google's search capability
- Automatic GSD integration - document how to integrate, don't modify GSD agents

## Context

### Technical Environment

- **Target platform**: Claude Code MCP server (stdio transport)
- **Runtime**: Node.js (TypeScript)
- **API**: Google's Cloud Code Assist API (`daily-cloudcode-pa.sandbox.googleapis.com`)
- **Auth**: Google OAuth with PKCE

### Prior Work (Research Completed)

**API Research** (in `custom_research/`):
- Endpoint: `daily-cloudcode-pa.sandbox.googleapis.com` (sandbox, not rate-limited)
- Two-stage orchestration pattern required for reliable search
- Cannot mix `googleSearch` grounding with function declarations
- Must use `antigravity/1.15.8` in User-Agent header

**OAuth Research**:
- Gemini CLI: Device code flow via `codeassist.google.com/authcode`
- Antigravity: PKCE with loopback server (ports 51121 or 36742)
- Both use same underlying OAuth infrastructure

**GSD Integration Research**:
- GSD researcher agents use `WebSearch`, `WebFetch`, `mcp__context7__*`
- GitHub issue #13605: Plugin subagents can't access MCP tools
- Workaround: Use `general-purpose` agent or remove `tools:` field

### Known Issues to Address

- **Headers must match Antigravity version**: `antigravity/1.15.8` required
- **Native grounding is passive**: Model decides whether to search; two-stage pattern forces it
- **Production endpoint rate-limited**: Must use sandbox endpoint

## Constraints

- **Tech stack**: TypeScript with Node.js - matches Gemini CLI and existing MCP servers
- **Transport**: stdio only - Claude Code MCP standard
- **API dependency**: Requires Google One AI Pro subscription for quota
- **Header requirement**: Must use Antigravity 1.15.8 User-Agent or similar

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TypeScript over Python | Matches Gemini CLI, good MCP SDK support | - Pending |
| Both OAuth methods | Maximum flexibility for different environments | - Pending |
| Sandbox endpoint | Production is rate-limited, sandbox works reliably | - Pending |
| Antigravity credentials | More scopes, proven by OpenCode community | - Pending |
| google-grounded-search naming | Describes capability, generic enough | - Pending |

---
*Last updated: 2026-02-03 after initialization*
