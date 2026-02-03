# Phase 1: Research - Research

**Researched:** 2026-02-03
**Domain:** Meta-research (how to investigate technical assumptions)
**Confidence:** HIGH

## Summary

This is a meta-research phase where the "implementation" is investigation itself. The phase validates four technical assumptions (RESEARCH-01 through RESEARCH-04) that inform downstream implementation decisions for AUTH-01, SEARCH-03 viability, code reuse strategy, and GSD integration approach.

The primary research sources are local installations rather than web searches: OpenCode antigravity-auth plugin (`~/.cache/opencode/node_modules/opencode-antigravity-auth/`), Gemini CLI (`~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/`), GSD agent definitions (`~/.claude/agents/gsd-*.md`), and existing project research in `custom_research/`. Critical findings already exist in `custom_research/` including the two-stage orchestration pattern, working API endpoints, and `groundingMetadata.webSearchQueries` field (which answers RESEARCH-01b directly).

**Primary recommendation:** Execute investigations in order (RESEARCH-01 first), using local source code analysis over API experiments, validating existing `custom_research/` findings before filling gaps.

## Investigation Methods by Requirement

### RESEARCH-01: Gemini CLI vs Antigravity Comparison

**Purpose:** Determine if AUTH-01 (Gemini CLI auth) is viable and if SEARCH-03 (query transparency) is feasible.

**Investigation Locations:**

| Question | Location | Method |
|----------|----------|--------|
| Different API endpoints? | `/home/skello/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/defaultModelConfigs.js` | Read file, check `web-search` alias |
| Gemini CLI grounded search? | Same file + `dist/src/tools/web-search.js` | Verify `googleSearch: {}` in tools config |
| API returns search queries? | `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md` | Already documented: `groundingMetadata.webSearchQueries` |

**Key Findings from Pre-Research:**

1. **Gemini CLI DOES support grounded search:** The `web-search.js` tool uses `model: 'web-search'` alias which maps to `gemini-2.5-flash-base` with `tools: [{ googleSearch: {} }]`
2. **Same API endpoint:** Both use `cloudcode-pa.googleapis.com` (prod) or sandbox variants
3. **Query transparency confirmed:** `candidate.groundingMetadata.webSearchQueries` array returned in response

**Decision:** AUTH-01 viable, SEARCH-03 viable

**Validation Steps:**
1. Read `defaultModelConfigs.js` lines 150-157 to confirm `web-search` alias
2. Read `web-search.js` lines 27-29 to see `groundingMetadata` parsing
3. Cross-reference with `custom_research/` findings on `webSearchQueries`

### RESEARCH-02: OpenCode Code Reuse Evaluation

**Purpose:** Determine what code can be reused from OpenCode's antigravity-auth plugin.

**Investigation Location:**
`/home/skello/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/`

**Files to Analyze:**

| File | What to Extract | Reuse Potential |
|------|-----------------|-----------------|
| `constants.js` | Endpoints, headers, OAuth credentials, system instructions | HIGH - direct copy |
| `plugin/search.js` | Two-stage orchestration pattern, response parsing | HIGH - adapt pattern |
| `antigravity/oauth.js` | PKCE flow, loopback server, token exchange | MEDIUM - MCP context differs |
| `plugin/token.js` | Token refresh logic | MEDIUM - simplify for MCP |

**Key Patterns Already Documented:**
- Two-stage orchestration in `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md`
- OAuth comparison in `custom_research/2026-02-03-oauth-auth-research.md`

**Reuse Strategy:**
1. **Direct reuse:** Constants (endpoints, headers, version strings, system instructions)
2. **Pattern reuse:** Two-stage orchestration flow, response parsing with `groundingMetadata`
3. **Adapt:** OAuth flow for MCP server context (single process, not plugin IPC)

### RESEARCH-03: GSD Agent WebSearch/WebFetch Integration

**Purpose:** Determine how to integrate grounded search tool into GSD research workflows.

**Investigation Locations:**

| Source | Path | What to Learn |
|--------|------|---------------|
| GSD Phase Researcher | `~/.claude/agents/gsd-phase-researcher.md` | Tool declaration pattern, when WebSearch used |
| GSD Project Researcher | `~/.claude/agents/gsd-project-researcher.md` | Same pattern, parallel research context |
| GSD Research Synthesizer | `~/.claude/agents/gsd-research-synthesizer.md` | How results consumed |

**Key Questions to Answer:**
1. Can we inject tool preference at invocation time? **YES** - via `tools:` field in agent YAML frontmatter
2. How do agents modify behavior? **Prompts + tool instructions** - agents list tools in YAML, instructions guide when to use
3. Does tool produce RESEARCH.md? **NO** - researcher agent consumes tool output, writes RESEARCH.md itself
4. CONTEXT.md handling? **CONTEXT.md read first** - constrains research scope, not produced by tool

**Tool Declaration Pattern (from agent files):**
```yaml
---
name: gsd-phase-researcher
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
---
```

**Integration Approach:**
Replace `WebSearch` with MCP tool in tools list: `mcp__google-grounded-search__grounded_search`

### RESEARCH-04: ~/.claude/agents/ Workaround for Plugin Bug

**Purpose:** Determine if moving agent definitions out of plugins restores MCP tool access.

**Background:** GitHub #13605 documents that custom plugin subagents cannot access MCP tools (built-in agents can).

**Investigation Method:**
1. Understand current GSD agent location: `~/.claude/agents/` (global, NOT in plugin)
2. Verify agents already use MCP tools: `mcp__context7__*` in tools list
3. Confirm workaround is already in effect

**Key Finding:**
GSD agents are ALREADY defined in `~/.claude/agents/` (global location), NOT inside a plugin's `agents/` directory. This means:
- They are NOT affected by GitHub #13605
- MCP tools work for these agents
- No workaround needed for current setup

**For New Integration:**
The grounded search MCP server just needs to be added to `.mcp.json` config. Agents in `~/.claude/agents/` will inherit access to the new tool without modification.

## Existing Resources

### custom_research/ Directory

| File | Contents | Confidence |
|------|----------|------------|
| `2026-02-03-antigravity-api-mcp-integration-deep-dive.md` | Complete API spec, two-stage pattern, endpoints, headers | HIGH |
| `2026-02-03-oauth-auth-research.md` | OAuth comparison, credentials, scopes | HIGH |
| `2026-02-03-research-tools-handoff.md` | Summary, implementation options | HIGH |

**Validation required:** Spot-check key claims against source code to ensure no drift.

### Local Installations

| Installation | Path | Use For |
|--------------|------|---------|
| OpenCode antigravity-auth | `~/.cache/opencode/node_modules/opencode-antigravity-auth/` | Code reuse evaluation |
| Gemini CLI | `~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/` | Endpoint/feature verification |
| GSD Agents | `~/.claude/agents/gsd-*.md` | Integration pattern discovery |

## API Testing Approach

If validation requires direct API testing:

```bash
# Test grounded search via OpenCode (already proven working)
opencode run -m google/antigravity-gemini-3-flash "What is today's date?"

# Verify token location
ls ~/.ccs/cliproxy/auth/antigravity-*.json
ls ~/.config/opencode/antigravity-accounts.json
```

**Note:** API testing is OPTIONAL. Source code analysis provides sufficient confidence for planning decisions.

## Downstream Decision Framework

### AUTH-01 Decision Tree

```
Is Gemini CLI web-search using googleSearch grounding tool?
├── YES → AUTH-01 viable (Gemini CLI device code flow supported)
└── NO → Descope AUTH-01 (Antigravity auth only)
```

**Current answer:** YES (confirmed via `defaultModelConfigs.js` line 154)

### SEARCH-03 Decision Tree

```
Does API response include groundingMetadata.webSearchQueries?
├── YES → SEARCH-03 viable (expose queries in tool response)
└── NO → Claude recommends alternatives or descopes
```

**Current answer:** YES (confirmed via OpenCode search.js lines 82-84)

### Code Reuse Decision Tree

```
Is OpenCode two-stage pattern directly reusable?
├── YES → Port pattern with minimal adaptation
└── NO → Implement from API spec in custom_research/
```

**Current answer:** Pattern reusable, constants reusable, OAuth needs MCP adaptation

### GSD Integration Decision Tree

```
Are GSD agents affected by plugin MCP bug (#13605)?
├── YES → Investigate ~/.claude/agents/ workaround
└── NO → Add MCP tool to config, agents inherit access
```

**Current answer:** NO - agents already in `~/.claude/agents/`, not affected

## Investigation Order

Per CONTEXT.md decisions:

1. **RESEARCH-01** (Gemini CLI grounding) - Determines AUTH-01 and SEARCH-03 viability
2. **RESEARCH-02** (OpenCode reuse) - Informs implementation approach
3. **RESEARCH-03/04** (GSD integration) - Can be done in parallel, no blocking dependencies

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth PKCE | Custom implementation | OpenCode pattern from `oauth.js` | Edge cases with state encoding |
| Header randomization | Hard-coded headers | `getRandomizedHeaders()` from constants.js | Rate limit avoidance |
| Response parsing | Custom JSON walker | `parseSearchResponse()` pattern | groundingMetadata structure is complex |

## Common Pitfalls

### Pitfall 1: Missing Two-Stage Orchestration
**What goes wrong:** Native `googleSearch: {}` is passive - model may not search
**Why it happens:** Assumption that passing tool means it will be used
**How to avoid:** Implement two-stage pattern from OpenCode
**Warning signs:** Search queries return training data, not live results

### Pitfall 2: Production Endpoint Rate Limits
**What goes wrong:** 429 errors from `cloudcode-pa.googleapis.com`
**Why it happens:** Production endpoint is rate-limited
**How to avoid:** Use sandbox: `daily-cloudcode-pa.sandbox.googleapis.com`
**Warning signs:** 429 responses, "rate limited" errors

### Pitfall 3: Version String Mismatch
**What goes wrong:** "This version of Antigravity is no longer supported" error
**Why it happens:** User-Agent version string outdated
**How to avoid:** Use `ANTIGRAVITY_VERSION` constant (currently `1.15.8`)
**Warning signs:** Error message about version support

## Open Questions

1. **Token sharing:** Can we read tokens from CCS/OpenCode directly, or must users re-authenticate?
   - Recommendation: Try reading existing tokens first, fall back to fresh auth

2. **Endpoint preference:** Should we prefer Gemini CLI or Antigravity credentials?
   - Recommendation: Antigravity (more scopes, proven with search)

## Sources

### Primary (HIGH confidence)
- Local source: `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/constants.js` - Endpoints, headers, version
- Local source: `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js` - Two-stage pattern
- Local source: `~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/defaultModelConfigs.js` - web-search alias
- Local source: `~/.claude/agents/gsd-phase-researcher.md` - Agent tool declaration pattern
- Project file: `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md` - Complete API documentation

### Secondary (MEDIUM confidence)
- GitHub issue #13605: https://github.com/anthropics/claude-code/issues/13605 - Plugin subagent MCP bug
- OpenCode GitHub: https://github.com/NoeFabris/opencode-antigravity-auth - Reference implementation

### Tertiary (LOW confidence)
- None - all findings verified against source code

## Metadata

**Confidence breakdown:**
- RESEARCH-01 (Gemini CLI grounding): HIGH - Verified in source code
- RESEARCH-02 (OpenCode reuse): HIGH - Source code analyzed
- RESEARCH-03 (GSD integration): HIGH - Agent files examined
- RESEARCH-04 (Plugin bug workaround): HIGH - Verified agents not affected

**Research date:** 2026-02-03
**Valid until:** 60 days (local installations may update)
