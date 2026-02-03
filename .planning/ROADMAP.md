# Roadmap: google-grounded-search MCP Server

## Overview

This roadmap delivers an MCP server that provides Google Search grounding via the Antigravity API. The journey begins with research to validate technical assumptions (particularly Gemini CLI viability), establishes foundation with a working MCP skeleton, implements authentication and core search functionality with structured citations, and concludes with configuration options. Each phase delivers observable, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Research** - Validate technical assumptions and inform downstream decisions
- [ ] **Phase 2: Foundation** - Establish MCP server skeleton with placeholder tool
- [ ] **Phase 3: Authentication** - OAuth flows with token persistence and error states
- [ ] **Phase 4: Core Search** - Grounded search with citations and transparency
- [ ] **Phase 5: Configuration** - Model selection, thinking levels, and user preferences
- [ ] **Phase 6: Polish & Validation** - Edge cases, error recovery, production readiness

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
**Plans**: TBD

Plans:
- [ ] 01-01: Research investigations (RESEARCH-01 through RESEARCH-04)

### Phase 2: Foundation
**Goal**: Establish working MCP server skeleton with placeholder tool
**Depends on**: Phase 1 (research informs implementation approach)
**Requirements**: None (infrastructure phase, enables all subsequent requirements)
**Success Criteria** (what must be TRUE):
  1. MCP server runs and registers with Claude Code
  2. Placeholder `grounded_search` tool appears in tool list
  3. Placeholder tool returns mock response when invoked
  4. Server follows MCP protocol correctly (JSON-RPC, schema validation)
**Plans**: TBD

Plans:
- [ ] 02-01: MCP server foundation with placeholder tool

### Phase 3: Authentication
**Goal**: Users can authenticate and maintain persistent access to the Antigravity API
**Depends on**: Phase 2 (server skeleton exists)
**Requirements**: AUTH-01 (conditional), AUTH-02, AUTH-03, AUTH-04, ERROR-01, ERROR-02
**Success Criteria** (what must be TRUE):
  1. User can authenticate via device code flow or loopback flow (method depends on RESEARCH-01)
  2. Authentication tokens persist across MCP server restarts (user authenticates once)
  3. User can trigger re-authentication when tokens expire or become invalid
  4. Unauthenticated state shows clear error message with instructions
  5. Unauthenticated state offers option to start auth flow
**Plans**: TBD

Plans:
- [ ] 03-01: OAuth device code flow (AUTH-02 Antigravity, AUTH-01 if viable)
- [ ] 03-02: Token persistence and refresh (AUTH-03, AUTH-04)
- [ ] 03-03: Auth error states (ERROR-01, ERROR-02)

### Phase 4: Core Search
**Goal**: Users can perform grounded searches and receive results with citations
**Depends on**: Phase 3 (API calls require authentication)
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03 (conditional)
**Success Criteria** (what must be TRUE):
  1. `grounded_search` tool performs actual Google-grounded search via Antigravity API
  2. Search results include text response with source citations (URLs and titles)
  3. Search results include the actual queries Google used for transparency (if RESEARCH-01 confirms API support)
  4. Two-stage orchestration guarantees grounding occurs (not passive model decision)
**Plans**: TBD

Plans:
- [ ] 04-01: API client with two-stage orchestration
- [ ] 04-02: Response parsing and citation formatting

### Phase 5: Configuration
**Goal**: Users can customize search behavior via parameters and preferences
**Depends on**: Phase 4 (configuration extends working search)
**Requirements**: SEARCH-04, SEARCH-05, CONFIG-01, CONFIG-02
**Success Criteria** (what must be TRUE):
  1. User can specify model via tool parameter (gemini-3-flash, gemini-3-pro, etc.)
  2. User can specify thinking level via tool parameter
  3. User can configure default model preference (persists across calls)
  4. User can configure default thinking level (persists across calls)
**Plans**: TBD

Plans:
- [ ] 05-01: Model and thinking level parameters
- [ ] 05-02: Configuration persistence

### Phase 6: Polish & Validation
**Goal**: Production-ready MCP server with robust error handling and edge case coverage
**Depends on**: Phase 5 (polish requires feature-complete implementation)
**Requirements**: None (all requirements mapped; this phase is quality assurance)
**Success Criteria** (what must be TRUE):
  1. Exponential backoff handles rate limits gracefully (no death spiral)
  2. Token refresh works under concurrent requests (mutex prevents race conditions)
  3. Server recovery from transient API failures does not require restart
  4. All MCP schema validated against Claude Code (no Draft 2020-12 incompatibilities)
**Plans**: TBD

Plans:
- [ ] 06-01: Error handling and resilience
- [ ] 06-02: End-to-end validation and edge cases

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Research | 0/1 | Not started | - |
| 2. Foundation | 0/1 | Not started | - |
| 3. Authentication | 0/3 | Not started | - |
| 4. Core Search | 0/2 | Not started | - |
| 5. Configuration | 0/2 | Not started | - |
| 6. Polish & Validation | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-03*
*Last revised: 2026-02-03 (split Research/Foundation into separate phases)*
*Total v1 requirements: 17 (17 mapped, 0 orphaned)*
