# Requirements: google-grounded-search MCP Server

**Defined:** 2026-02-03
**Core Value:** Real-time, grounded web search with authoritative source citations

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can authenticate via Gemini CLI device code flow (enter code from browser)
- [ ] **AUTH-02**: User can authenticate via Antigravity loopback flow with paste-back fallback
- [ ] **AUTH-03**: Authentication persists across MCP server restarts
- [ ] **AUTH-04**: User can trigger re-authentication when tokens expire

### Search

- [ ] **SEARCH-01**: MCP exposes `grounded_search` tool that performs Google-grounded search
- [ ] **SEARCH-02**: Search returns text response with source citations (URLs, titles)
- [ ] **SEARCH-03**: Search returns the actual queries Google used (for transparency)
- [ ] **SEARCH-04**: User can specify model via tool parameter (gemini-3-flash, gemini-3-pro, etc.)
- [ ] **SEARCH-05**: User can specify thinking level via tool parameter

### Research/Investigation

- [ ] **RESEARCH-01**: Investigate Gemini CLI vs Antigravity: (a) different API endpoints? (b) does Gemini CLI have grounded search? If no grounded search, deprioritize AUTH-01
- [ ] **RESEARCH-02**: Evaluate OpenCode plugin grounded search implementation for code reuse
- [ ] **RESEARCH-03**: Investigate how GSD agents call WebSearch/WebFetch to determine integration approach
- [ ] **RESEARCH-04**: Investigate ~/.claude/agents/ workaround for plugin subagent tool access bug (GitHub #13605) — moving agent definitions out of plugins may restore MCP tool access

### Configuration

- [ ] **CONFIG-01**: User can configure default model preference
- [ ] **CONFIG-02**: User can configure default thinking level

### Error Handling

- [ ] **ERROR-01**: Unauthenticated state returns clear error with auth instructions
- [ ] **ERROR-02**: Unauthenticated state offers option to start auth flow

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

| Requirement | Condition | Action if False |
|-------------|-----------|-----------------|
| AUTH-01 (Gemini CLI auth) | RESEARCH-01 confirms Gemini CLI API supports grounded search | Descope AUTH-01, use Antigravity auth only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | TBD | Pending |
| AUTH-02 | TBD | Pending |
| AUTH-03 | TBD | Pending |
| AUTH-04 | TBD | Pending |
| SEARCH-01 | TBD | Pending |
| SEARCH-02 | TBD | Pending |
| SEARCH-03 | TBD | Pending |
| SEARCH-04 | TBD | Pending |
| SEARCH-05 | TBD | Pending |
| RESEARCH-01 | TBD | Pending |
| RESEARCH-02 | TBD | Pending |
| RESEARCH-03 | TBD | Pending |
| RESEARCH-04 | TBD | Pending |
| CONFIG-01 | TBD | Pending |
| CONFIG-02 | TBD | Pending |
| ERROR-01 | TBD | Pending |
| ERROR-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0
- Unmapped: 17 (roadmap pending)

---
*Requirements defined: 2026-02-03*
*Last updated: 2026-02-03 after definition*
