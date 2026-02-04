# Requirements: google-grounded-search MCP Server

**Defined:** 2026-02-03
**Core Value:** Real-time, grounded web search with authoritative source citations

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [x] **AUTH-01**: User can authenticate via Gemini CLI device code flow (enter code from browser)
- [x] **AUTH-02**: User can authenticate via Antigravity loopback flow with paste-back fallback
- [x] **AUTH-03**: Authentication persists across MCP server restarts
- [x] **AUTH-04**: User can trigger re-authentication when tokens expire

### Search

- [x] **SEARCH-01**: MCP exposes `grounded_search` tool that performs Google-grounded search
- [x] **SEARCH-02**: Search returns text response with source citations (URLs, titles)
- [x] **SEARCH-03**: Search returns the actual queries Google used (for transparency)
- [ ] **SEARCH-04**: User can specify model via tool parameter (gemini-3-flash, gemini-3-pro, etc.) — BLOCKED: API only supports one model per provider
- [x] **SEARCH-05**: User can specify thinking level via tool parameter

### Research/Investigation

- [x] **RESEARCH-01**: Investigate Gemini CLI vs Antigravity: (a) different API endpoints? (b) does Gemini CLI have grounded search? (c) does API return actual search queries used? If no grounded search, deprioritize AUTH-01. If no query transparency, deprioritize SEARCH-03 — **RESOLVED: AUTH-01 and SEARCH-03 both viable**
- [x] **RESEARCH-02**: Evaluate OpenCode plugin grounded search implementation for code reuse — **RESOLVED: HIGH reuse for constants/search pattern, MEDIUM for OAuth**
- [x] **RESEARCH-03**: Investigate how GSD agents call WebSearch/WebFetch to determine integration approach — **RESOLVED: Must modify agent frontmatter (tool lists are HARD CONSTRAINTS)**
- [x] **RESEARCH-04**: Investigate ~/.claude/agents/ workaround for plugin subagent tool access bug (GitHub #13605) — **RESOLVED: Not applicable, GSD agents already have MCP access**

### Configuration

- [x] **CONFIG-01**: User can configure default model preference (via provider selection - model is provider-determined)
- [x] **CONFIG-02**: User can configure default thinking level

### Error Handling

- [x] **ERROR-01**: Unauthenticated state returns clear error with auth instructions
- [x] **ERROR-02**: Unauthenticated state offers option to start auth flow

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### URL Context

- **URL-01**: Analyze specific URLs with Gemini (similar to WebFetch but grounded)

### GSD Integration

- **GSD-01**: Skill or integration that enables GSD agents to use grounded search

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Chat/conversation mode | MCP provides single-shot search tool only |
| Multi-account rotation | Complexity, leave for future version |
| Non-search Gemini capabilities | Focus on search grounding |

## Contingencies

| Requirement | Condition | Action if False | Status |
|-------------|-----------|-----------------|--------|
| AUTH-01 (Gemini CLI auth) | RESEARCH-01 confirms Gemini CLI API supports grounded search | Descope AUTH-01, use Antigravity auth only | **RESOLVED: Viable** |
| SEARCH-03 (query transparency) | RESEARCH-01 confirms API returns actual search queries used | Descope SEARCH-03 from v1 | **RESOLVED: Viable** |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RESEARCH-01 | Phase 1 | Complete |
| RESEARCH-02 | Phase 1 | Complete |
| RESEARCH-03 | Phase 1 | Complete |
| RESEARCH-04 | Phase 1 | Complete |
| AUTH-01 | Phase 3 | Complete |
| AUTH-02 | Phase 3 | Complete |
| AUTH-03 | Phase 3 | Complete |
| AUTH-04 | Phase 3 | Complete |
| ERROR-01 | Phase 3 | Complete |
| ERROR-02 | Phase 3 | Complete |
| SEARCH-01 | Phase 4 | Complete |
| SEARCH-02 | Phase 4 | Complete |
| SEARCH-03 | Phase 4 | Complete |
| SEARCH-04 | Phase 5 | Blocked (API) |
| SEARCH-05 | Phase 5 | Complete |
| CONFIG-01 | Phase 5 | Complete |
| CONFIG-02 | Phase 5 | Complete |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-04 (Phase 5 complete - CONFIG-01, CONFIG-02, SEARCH-05 satisfied; SEARCH-04 blocked by API)*
