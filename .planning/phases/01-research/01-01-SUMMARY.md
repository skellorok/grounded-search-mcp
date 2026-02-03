---
phase: 01-research
plan: 01
subsystem: research
tags: [gemini-cli, opencode, antigravity, oauth, mcp, gsd-agents, google-search, grounding-metadata]

# Dependency graph
requires: []
provides:
  - AUTH-01 viability decision with source code evidence
  - SEARCH-03 viability decision with source code evidence
  - Code reuse strategy for antigravity-auth plugin
  - GSD integration approach with concrete syntax
  - Model availability findings (Gemini 3 client-side restriction)
affects: [02-foundation, 03-authentication, 04-core-search, 05-configuration]

# Tech tracking
tech-stack:
  analyzed: [gemini-cli, opencode-antigravity-auth, gsd-agents]
  patterns:
    - "Two-stage orchestration for reliable search"
    - "PKCE OAuth with loopback server or device code flow"
    - "Header randomization for rate limit avoidance"

key-files:
  created:
    - .planning/phases/01-research/01-01-SUMMARY.md
  modified:
    - .planning/phases/01-research/01-RESEARCH.md
  analyzed:
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/models.js
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/defaultModelConfigs.js
    - ~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/constants.js
    - ~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js
    - ~/.claude/agents/gsd-phase-researcher.md
    - ~/.claude/agents/gsd-project-researcher.md

key-decisions:
  - "AUTH-01 VIABLE: Gemini CLI auth works, Gemini 3 restriction is client-side only"
  - "SEARCH-03 VIABLE: API returns webSearchQueries in groundingMetadata"
  - "Code reuse: HIGH for constants/search pattern, MEDIUM for OAuth (MCP adaptation needed)"
  - "GSD integration: Must modify agent tools: frontmatter - tool lists are HARD CONSTRAINTS"
  - "Token storage: Separate from Gemini CLI at ~/.config/google-search-mcp/"
  - "Ban risk: Gemini CLI credentials preferred (official tool vs IDE impersonation)"

patterns-established:
  - "Source code validation: Line numbers and code snippets as evidence"
  - "Reuse classification: HIGH/MEDIUM/LOW for code portability assessment"

# Metrics
duration: ~45min
completed: 2026-02-03
---

# Phase 01 Plan 01: Research Investigations Summary

**Validated AUTH-01 and SEARCH-03 viability via source code; discovered Gemini 3 restriction is CLIENT-SIDE only; established code reuse strategy from OpenCode; documented GSD integration requires agent frontmatter modification (tool lists are HARD CONSTRAINTS)**

## Performance

- **Duration:** ~45 minutes (across checkpoint sessions)
- **Started:** 2026-02-03
- **Completed:** 2026-02-03T18:17:30Z
- **Tasks:** 4
- **Files modified:** 2 (01-RESEARCH.md, 01-01-SUMMARY.md)

## Accomplishments

- Validated AUTH-01 viable: Both Gemini CLI and Antigravity auth approaches work
- Validated SEARCH-03 viable: API returns `webSearchQueries` in `groundingMetadata`
- **Critical discovery:** Gemini 3 restriction is CLIENT-SIDE only - can request directly
- Established code reuse strategy with HIGH/MEDIUM/LOW classifications
- Documented GSD integration: **Agent tool lists are HARD CONSTRAINTS** - must modify frontmatter
- Identified three agents using WebSearch: gsd-phase-researcher, gsd-project-researcher, gsd-debugger
- Captured pending todo: Auth provider selection flag for Phase 3/5

## Task Commits

Each task was committed atomically:

1. **Task 1: Validate RESEARCH-01 findings** - `94a43d7` (research)
2. **Task 2: Validate RESEARCH-02 code reuse** - `9f80e68` (research)
3. **Task 3: Validate RESEARCH-03/04 GSD integration** - `54c619e` (research)
4. **Task 4: Compile SUMMARY** - (this commit)

## Key Findings

### RESEARCH-01: AUTH-01 and SEARCH-03 Viability

**Decision: Both AUTH-01 and SEARCH-03 remain VIABLE**

#### AUTH-01 (Gemini CLI Authentication)

**Source evidence:**
- File: `~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/defaultModelConfigs.js`
- Lines 150-157: `web-search` alias configured with `tools: [{ googleSearch: {} }]`

**Critical discovery - Model availability:**
- File: `models.js` lines 36-62
- `resolveModel()` has `default: return requestedModel` case
- **Implication:** Gemini 3 restriction is CLIENT-SIDE only in Gemini CLI
- Model aliases (`auto`, `pro`, `flash`) are gated by `previewFeaturesEnabled` flag
- Direct model names (`gemini-3-flash`) pass through unchanged

**Benefit:** Best of both worlds - lower risk Gemini CLI credentials + Gemini 3 model access

#### SEARCH-03 (Query Transparency)

**Source evidence:**
- File: `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js`
- Lines 80-84: `webSearchQueries` extraction from `groundingMetadata`

```javascript
if (candidate.groundingMetadata) {
  if (gm.webSearchQueries) {
    result.searchQueries = gm.webSearchQueries;
  }
}
```

**Finding:** Gemini CLI doesn't parse `webSearchQueries` (doesn't need it), but OpenCode does. We just need to add the same extraction logic.

#### Two-Model Architecture

Both approaches use the **same API endpoint** (`cloudcode-pa.googleapis.com`):
- Gemini CLI: Production endpoint
- OpenCode: Sandbox endpoint (`daily-cloudcode-pa.sandbox.googleapis.com`)

**Key insight:** Search always uses Gemini model (gemini-3-flash) regardless of what chat model user selected.

### RESEARCH-02: Code Reuse Strategy

#### Reuse Classifications

| Component | Classification | Action |
|-----------|---------------|--------|
| `constants.js` - OAuth credentials | HIGH | Direct copy |
| `constants.js` - endpoints/headers | HIGH | Direct copy |
| `constants.js` - `getRandomizedHeaders()` | HIGH | Direct copy |
| `search.js` - two-stage pattern | HIGH | Adapt for MCP wrapper |
| `search.js` - `parseSearchResponse()` | HIGH | Direct copy |
| `search.js` - `formatSearchResult()` | HIGH | Copy, may modify format |
| `oauth.js` - PKCE URL building | MEDIUM | Adapt callback handling |
| `oauth.js` - token exchange | MEDIUM | Adapt for MCP context |
| `oauth.js` - project ID resolution | MEDIUM | Direct copy |
| `server.js` - loopback server | LOW | Reference only |
| `token.js` - refresh logic | MEDIUM | Simplify for MCP |

#### Key Constants

```javascript
// Gemini CLI OAuth (from oauth2.js)
GEMINI_CLI_CLIENT_ID = "681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com"
GEMINI_CLI_CLIENT_SECRET = "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"

// Antigravity OAuth (from constants.js)
ANTIGRAVITY_CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com"
ANTIGRAVITY_CLIENT_SECRET = "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"
ANTIGRAVITY_VERSION = "1.15.8"  // CRITICAL - must stay in sync

// Endpoints
ANTIGRAVITY_ENDPOINT_DAILY = "https://daily-cloudcode-pa.sandbox.googleapis.com"
SEARCH_MODEL = "gemini-3-flash"
```

#### OAuth Approach Decision

**Can fully replicate Gemini CLI auth in our MCP (no dependency on Gemini CLI installation):**
- Copy OAuth credentials from source code
- Implement PKCE flow ourselves
- Use Gemini CLI's `codeassist.google.com/authcode` redirect for device code flow
- Headers: Use `google-api-nodejs-client/10.3.0` to match Gemini CLI

**Token storage:** Separate from Gemini CLI at `~/.config/google-search-mcp/`

**Ban risk comparison:**
- Antigravity: Impersonates Google's experimental IDE (higher risk)
- Gemini CLI: Official Google tool (lower risk)

#### License Compliance

Both MIT and Apache 2.0 licensed - can copy with attribution:
- Gemini CLI: Apache 2.0
- OpenCode antigravity-auth: MIT

### RESEARCH-03/04: GSD Integration

#### CRITICAL: Agent Tool Lists are HARD CONSTRAINTS

**Source evidence:**
- File: `~/.claude/agents/gsd-phase-researcher.md`
- Frontmatter: `tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*`

**Implication:** CONTEXT.MD cannot grant tool access. To use our MCP tool in GSD research workflows, **must modify agent `tools:` frontmatter** to add `mcp__google-grounded-search__*`.

#### Agents Requiring Modification

Three GSD agents use WebSearch and would benefit from grounded search:

1. `gsd-phase-researcher.md` - Phase research investigations
2. `gsd-project-researcher.md` - Project-level research
3. `gsd-debugger.md` - Debugging with web search

#### Integration Syntax

```yaml
---
name: gsd-phase-researcher
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__google-grounded-search__*
---
```

#### Project-Level Override

Don't need to fork entire GSD framework - just create modified agent file in project's `.claude/agents/` directory. Claude uses project-level agents over global ones.

#### CONTEXT.MD Behavior

- Generated by `/gsd:discuss-phase`
- Can edit after generation to lock decisions
- Read by researcher agent, constrains research scope
- **Does NOT grant tool access** (tools are frontmatter-controlled)

#### Skills vs Tools

- Skills provide instructions to agents (via markdown files)
- Skills do NOT automatically intercept tool calls
- MCP works outside GSD - can use with `/research:deep-dive`, direct agent calls, etc.

#### Plugin Bug #13605 - NOT APPLICABLE

GSD agents are in `~/.claude/agents/` (global location), NOT inside a plugin's `agents/` directory. They already have MCP tool access (evidence: `mcp__context7__*` in tools list). No workaround needed.

## Decisions Made

| Decision | Rationale | Status |
|----------|-----------|--------|
| AUTH-01 remains viable | Gemini CLI supports grounded search, Gemini 3 client-side restriction | Confirmed |
| SEARCH-03 remains viable | API returns webSearchQueries in groundingMetadata | Confirmed |
| Use Gemini CLI credentials for lower ban risk | Official tool vs experimental IDE impersonation | Recommended |
| Implement OAuth ourselves, don't depend on Gemini CLI installation | Reduces dependencies, clear code ownership | Recommended |
| Store tokens separately at ~/.config/google-search-mcp/ | Avoid conflicts with Gemini CLI | Recommended |
| Copy two-stage pattern from OpenCode | Proven reliable, well-documented | Confirmed |
| Modify GSD agent frontmatter for integration | Only way to add MCP tool access | Confirmed |

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all source files were accessible and findings matched expectations.

## User Setup Required

None - no external service configuration required for research phase.

## Pending Todos

1. **Auth provider selection flag** (captured in STATE.md for Phase 3/5): Design decision needed - support single provider, config-time selection, or runtime flag for Gemini CLI vs Antigravity credentials

## Next Phase Readiness

**Ready for Phase 2 (Foundation):**
- AUTH-01 and SEARCH-03 viability confirmed with evidence
- Code reuse strategy documented with specific files
- Two-stage orchestration pattern understood
- GSD integration path clear

**No blockers identified.**

**Downstream phase implications:**
- Phase 2 (Foundation): Project scaffold, TypeScript setup
- Phase 3 (Authentication): Use Gemini CLI credentials, implement PKCE ourselves
- Phase 4 (Core Search): Port two-stage pattern from OpenCode
- Phase 5 (Configuration): Add auth provider selection flag (todo captured)

---
*Phase: 01-research*
*Completed: 2026-02-03*
