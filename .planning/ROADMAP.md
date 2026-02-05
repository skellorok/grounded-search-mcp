# Roadmap: google-grounded-search MCP Server

## Overview

This roadmap delivers an MCP server that provides Google Search grounding via the Antigravity API. The journey begins with research to validate technical assumptions (particularly Gemini CLI viability), establishes foundation with a working MCP skeleton, implements authentication and core search functionality with structured citations, and concludes with configuration options. Each phase delivers observable, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Research** - Validate technical assumptions and inform downstream decisions
- [x] **Phase 2: Foundation** - Establish MCP server skeleton with placeholder tool
- [x] **Phase 3: Authentication** - OAuth flows with token persistence and error states
- [x] **Phase 4: Core Search** - Grounded search with citations and transparency
- [x] **Phase 5: Configuration** - Model selection, thinking levels, and user preferences
- [x] **Phase 6: Polish & Validation** - Edge cases, error recovery, production readiness
- [x] **Phase 6.1: UAT Gap Closure & DX Tooling** - Code fixes, rename, new commands, doc updates (INSERTED)

## Phase Details

### Phase 1: Research
**Goal**: Validate technical assumptions that inform downstream implementation decisions
**Depends on**: Nothing (first phase)
**Requirements**: RESEARCH-01, RESEARCH-02, RESEARCH-03, RESEARCH-04
**Success Criteria** (what must be TRUE):
  1. RESEARCH-01 complete: Decision made on AUTH-01 viability (Gemini CLI grounded search support documented)
  2. RESEARCH-01 complete: Decision made on SEARCH-03 viability (API query transparency documented)
  3. RESEARCH-02 complete: OpenCode code reuse strategy documented
  4. RESEARCH-03 and RESEARCH-04 complete: GSD integration approach documented
**Plans**: 1 plan

Plans:
- [x] 01-01-PLAN.md - Validate technical assumptions via source code analysis (RESEARCH-01 through RESEARCH-04)

### Phase 2: Foundation
**Goal**: Establish working MCP server skeleton with placeholder tool
**Depends on**: Phase 1 (research informs implementation approach)
**Requirements**: None (infrastructure phase, enables all subsequent requirements)
**Success Criteria** (what must be TRUE):
  1. MCP server runs and registers with Claude Code
  2. Placeholder `grounded_search` tool appears in tool list
  3. Placeholder tool returns mock response when invoked
  4. Server follows MCP protocol correctly (JSON-RPC, schema validation)
**Plans**: 1 plan

Plans:
- [x] 02-01-PLAN.md - Initialize project scaffold, implement MCP server with placeholder tools, verify integration

### Phase 3: Authentication
**Goal**: Users can authenticate and maintain persistent access to the Antigravity API
**Depends on**: Phase 2 (server skeleton exists)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, ERROR-01, ERROR-02
**Success Criteria** (what must be TRUE):
  1. User can authenticate via device code flow with manual code entry (both Gemini CLI and Antigravity providers)
  2. Authentication tokens persist across MCP server restarts (user authenticates once)
  3. User can trigger re-authentication when tokens expire or become invalid
  4. Unauthenticated state shows clear error message with instructions
  5. Unauthenticated state offers option to start auth flow
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md - Core auth infrastructure (providers, token storage, PKCE device flow)
- [x] 03-02-PLAN.md - Auth tool with flag-based interface (login, status, logout, default-provider)
- [x] 03-03-PLAN.md - Token refresh with retry/deduplication, search tool auth checks

### Phase 4: Core Search
**Goal**: Users can perform grounded searches and receive results with citations
**Depends on**: Phase 3 (API calls require authentication)
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03 (conditional)
**Success Criteria** (what must be TRUE):
  1. `grounded_search` tool performs actual Google-grounded search via Antigravity API
  2. Search results include text response with source citations (URLs and titles)
  3. Search results include the actual queries Google used for transparency (if RESEARCH-01 confirms API support)
  4. Two-stage orchestration guarantees grounding occurs (not passive model decision)
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — API constants and request building (endpoints, headers, two-stage orchestration)
- [x] 04-02-PLAN.md — Response parsing and tool integration (groundingMetadata extraction, markdown formatting)

### Phase 5: Configuration
**Goal**: Users can persist search preferences across sessions
**Depends on**: Phase 4 (configuration extends working search)
**Requirements**: CONFIG-01, CONFIG-02 (SEARCH-04, SEARCH-05 partially satisfied - see notes)
**Success Criteria** (what must be TRUE):
  1. User can configure default provider preference (antigravity vs gemini) - persists
  2. User can configure default thinking level (high/low/none) - persists
  3. Configuration stored in XDG-compliant location (reuse auth token pattern)
  4. Tool response includes provider/model metadata for transparency
**Plans**: 1 plan

**Scope notes:**
- SEARCH-04 (model selection): Constrained by API - googleSearch only works on gemini-2.5-flash (Gemini CLI) and gemini-3-flash (Antigravity). User selects provider, which implies model.
- SEARCH-05 (thinking level): Parameter already implemented in Phase 4. This phase adds persistence.

Plans:
- [x] 05-01-PLAN.md - Config module, config tool, and response metadata integration

### Phase 6: Polish & Validation
**Goal**: Production-ready MCP server with validation testing and comprehensive documentation
**Depends on**: Phase 5 (polish requires feature-complete implementation)
**Requirements**: None (all requirements mapped; this phase is quality assurance and release prep)
**Success Criteria** (what must be TRUE):
  1. Token refresh deduplication verified by unit tests (concurrent calls result in single refresh)
  2. Config loading graceful fallback verified (corrupt/missing files return defaults)
  3. Error responses follow consistent format with actionable guidance
  4. Comprehensive README with installation, configuration, and usage documentation
  5. MIT license and release-ready package.json
**Plans**: 2 plans

Plans:
- [x] 06-01-PLAN.md - Validation test suite (Vitest tests for refresh, config, error handling)
- [x] 06-02-PLAN.md - Documentation and release preparation (README, WebSearch comparison, GSD guide, license)

### Phase 6.1: UAT Gap Closure & DX Tooling (INSERTED)
**Goal**: Address all UAT gaps - code fixes, project rename, new commands, doc updates, URL resolution
**Depends on**: Phase 6 (discovered during UAT)
**Requirements**: None (gaps discovered during validation)
**Success Criteria** (what must be TRUE):
  1. Fallback reason surfaced in response metadata (not just "Fallback provider used")
  2. Non-auth errors (404, 500, timeout) trigger provider fallback
  3. Project renamed from gemini-search-mcp to grounded-search-mcp (folder, package.json, all refs)
  4. GSD agent resolution verified and documented accurately
  5. `/grounded-search:prep-gsd` command exists - auto-configures GSD agents for project
  6. `/grounded-search:query` command exists - saves search results to local files
  7. All documentation updated with correct project name and verified GSD integration
  8. Source URLs resolved to actual destinations (not Google redirect URLs)
  9. GSD integration guide has both automated AND manual instructions
**Plans**: 6 plans

**UAT Gaps (from 06-UAT.md):**
| # | Gap | Severity | Category |
|---|-----|----------|----------|
| 6 | Fallback reason not surfaced | minor | Code fix |
| 7 | Non-auth errors don't trigger fallback | major | Code fix |
| 2 | Project naming (gemini -> grounded) | major | Rename |
| 4 | GSD integration incomplete | major | Research + features + docs |
| 10 | Source URLs are Google redirects | blocker | API workaround |
| 9 | GSD guide missing manual instructions | major | Documentation |

Plans:
- [x] 06.1-01-PLAN.md — Code fixes: fallback reason + expanded error triggers
- [x] 06.1-02-PLAN.md — Project rename: package.json, token-storage, LICENSE, .mcp.json
- [x] 06.1-03-PLAN.md — Slash commands: /grounded-search:query and /grounded-search:prep-gsd
- [x] 06.1-04-PLAN.md — Documentation updates: README, gsd-integration.md, source docstrings
- [x] 06.1-05-PLAN.md — URL resolution: resolve Google redirects to actual destination URLs
- [x] 06.1-06-PLAN.md — GSD guide restoration: merge improved + original manual instructions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Research | 1/1 | Complete | 2026-02-03 |
| 2. Foundation | 1/1 | Complete | 2026-02-03 |
| 3. Authentication | 3/3 | Complete | 2026-02-03 |
| 4. Core Search | 2/2 | Complete | 2026-02-03 |
| 5. Configuration | 1/1 | Complete | 2026-02-04 |
| 6. Polish & Validation | 2/2 | Complete | 2026-02-04 |
| 6.1 UAT Gap Closure & DX Tooling | 6/6 | Complete | 2026-02-05 |

---
*Roadmap created: 2026-02-03*
*Last revised: 2026-02-05 (Phase 6.1 complete)*
*Total v1 requirements: 17 (17 mapped, 0 orphaned)*
