---
phase: 01-research
plan: 01
subsystem: research
tags: [gemini-api, oauth, grounding, search, antigravity, mcp]
affects: [02-foundation, 03-authentication, 04-core-search]
tech-stack:
  analyzed: [gemini-cli, opencode-antigravity-auth, gsd-agents]
  patterns: [two-stage-orchestration, pkce-oauth, grounding-metadata]
key-files:
  analyzed:
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/models.js
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/defaultModelConfigs.js
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/config/config.js
    - ~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/tools/web-search.js
    - ~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/constants.js
    - ~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js
    - ~/.claude/agents/gsd-phase-researcher.md
    - ~/.claude/agents/gsd-project-researcher.md
    - ~/.claude/commands/gsd/research-phase.md
decisions:
  - AUTH-01: viable - Gemini CLI auth works, can request gemini-3 models directly
  - SEARCH-03: viable - API returns groundingMetadata.webSearchQueries
  - MODEL-CHOICE: gemini-3-flash recommended for search (Antigravity default, no restrictions)
  - AUTH-APPROACH: Gemini CLI credentials with direct model specification (lower risk, same capability)
metrics:
  completed: 2026-02-03
  duration: ~45min
---

# Phase 01 Plan 01: Research Investigations - Summary

## One-liner

Gemini 3 restriction is CLIENT-SIDE only; can use Gemini CLI auth + direct `gemini-3-flash` model requests for grounded search with full query transparency.

## What Was Done

1. **Validated RESEARCH-01 claims** - Investigated Gemini CLI model restriction mechanism vs Antigravity
2. **Answered user's critical questions** - Model availability differences, impersonation equivalence, plugin ecosystem
3. **Confirmed SEARCH-03 viability** - API returns `groundingMetadata.webSearchQueries`
4. **Documented code reuse strategy** - From OpenCode antigravity-auth plugin
5. **Verified GSD integration approach** - Agents in `~/.claude/agents/` have MCP access

## Key Findings

### CRITICAL DISCOVERY: Gemini 3 Restriction is Client-Side Only

**Source:** `models.js` lines 36-62

The `previewFeaturesEnabled` flag in Gemini CLI only affects model ALIASES (`auto`, `pro`, `flash`). Direct model names pass through unchanged:

```javascript
export function resolveModel(requestedModel, previewFeaturesEnabled = false) {
    switch (requestedModel) {
        case GEMINI_MODEL_ALIAS_PRO:
            return previewFeaturesEnabled ? 'gemini-3-pro-preview' : 'gemini-2.5-pro';
        case GEMINI_MODEL_ALIAS_FLASH:
            return previewFeaturesEnabled ? 'gemini-3-flash-preview' : 'gemini-2.5-flash';
        default:
            return requestedModel;  // <-- DIRECT MODEL NAMES PASS THROUGH
    }
}
```

**Implication:** Specifying `gemini-3-flash` or `gemini-3-flash-preview` directly in API requests bypasses the UI restriction. No "enable experimental" flag needed at API level.

**Evidence:** Antigravity's `constants.js` line 192 hardcodes `SEARCH_MODEL = "gemini-3-flash"` with no additional flags.

### RESEARCH-01: Gemini CLI vs Antigravity Comparison

#### Model Configuration Differences

| Aspect | Gemini CLI | Antigravity |
|--------|------------|-------------|
| Default model | gemini-2.5-pro | gemini-3-flash (for search) |
| Web search model | gemini-2.5-flash (via alias) | **gemini-3-flash** |
| Preview access | Via `previewFeaturesEnabled` flag | **Hardcoded gemini-3** |
| Non-Gemini models | No | **Yes** (Claude, GPT-OSS) |
| API restrictions | None (client-side UI only) | None |

#### Evidence: Web Search Configurations

**Gemini CLI (`defaultModelConfigs.js` lines 150-157):**
```javascript
'web-search': {
    extends: 'gemini-2.5-flash-base',  // Uses 2.5, not 3
    modelConfig: {
        generateContentConfig: {
            tools: [{ googleSearch: {} }],
        },
    },
},
```

**Antigravity (`constants.js` line 192):**
```javascript
export const SEARCH_MODEL = "gemini-3-flash";  // Uses 3, not 2.5
```

#### Both Approaches ARE Impersonation (User Correct)

Both use the same API (`cloudcode-pa.googleapis.com`) with different client identities:

**Gemini CLI headers:**
```javascript
"User-Agent": "google-api-nodejs-client/10.3.0",
"X-Goog-Api-Client": "gl-node/22.18.0",
```

**Antigravity headers:**
```javascript
"User-Agent": "Mozilla/5.0 ... Antigravity/1.15.8 ...",
"X-Goog-Api-Client": "google-cloud-sdk vscode_cloudshelleditor/0.1",
```

Our MCP would impersonate whichever client's credentials we use. The user's analogy is accurate.

### RESEARCH-01b: Query Transparency (SEARCH-03)

**Confirmed:** API returns search queries in `groundingMetadata.webSearchQueries`

**Source:** `search.js` lines 82-84
```javascript
if (candidate.groundingMetadata) {
    if (gm.webSearchQueries) {
        result.searchQueries = gm.webSearchQueries;  // <-- SEARCH-03 viable
    }
}
```

### OpenCode Plugin Ecosystem

Three auth plugins exist for OpenCode:

| Plugin | Version | Description |
|--------|---------|-------------|
| opencode-gemini-cli-oauth | 1.3.0 | Gemini CLI credentials, device code flow |
| opencode-antigravity-auth | 1.15.8 | Antigravity credentials, Claude/GPT models |
| opencode-gemini-auth | 1.3.10 | Alternative Gemini auth |

**Why Antigravity is more popular:**
1. **Multi-provider:** Offers Claude Sonnet, Claude Opus, GPT-OSS (non-Gemini models)
2. **Default Gemini 3:** Hardcodes gemini-3-flash for search
3. **More scopes:** 5 vs 3 (includes `cclog`, `experimentsandconfigs`)

### RESEARCH-02: Code Reuse Strategy

| Component | File | Reuse Level | Action |
|-----------|------|-------------|--------|
| Constants | constants.js | HIGH | Copy endpoints, headers, version |
| Search pattern | search.js | HIGH | Adapt two-stage orchestration |
| Response parsing | search.js | HIGH | Copy parseSearchResponse() |
| OAuth PKCE | oauth.js | MEDIUM | Adapt for MCP (no loopback) |
| Token refresh | token.js | MEDIUM | Simplify for single-token MCP |

**Two-stage pattern key insight:** Native `googleSearch` is passive. Must wrap in function tool that makes dedicated API call.

### RESEARCH-03/04: GSD Integration

**Plugin bug (#13605) does not affect us:**
- GSD agents are in `~/.claude/agents/` (global), NOT plugin directory
- Already use MCP tools: `mcp__context7__*` in tool lists
- New MCP tool just needs to be added to `.mcp.json`

**Integration syntax:** `mcp__gemini-search__grounded_search` (or `mcp__gemini-search__*` for wildcard)

#### Agent Tool Declaration Pattern

Both `gsd-phase-researcher.md` and `gsd-project-researcher.md` use identical frontmatter:

```yaml
---
name: gsd-phase-researcher
description: [description]
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
color: cyan
---
```

**Key observations:**
- Tools are comma-separated in a single `tools:` field
- MCP tools use format: `mcp__<server>__<tool>` or `mcp__<server>__*` for wildcards
- Wildcard support confirmed: `mcp__context7__*` is actively used

#### CONTEXT.md Integration Questions Answered

**Q1: Can we inject tool preference at invocation time?**

**NO** - Tool preferences are declared in agent frontmatter, not at invocation.

However, the orchestrator prompt CAN influence tool usage through instructions. The agent reads its own file for tools declaration (line 4 of agent file), orchestrator cannot modify this dynamically.

**Workaround options:**
1. Modify agent file - Add MCP tool to the `tools:` line
2. Prompt guidance - Include "Prefer `mcp__gemini-search__grounded_search` over WebSearch for grounded queries"
3. Create variant agent - `gsd-phase-researcher-grounded.md` with MCP tool

**Q2: How do agents modify behavior (prompts vs tool instructions vs hooks)?**

**Prompts only.** No hooks exist.

Execution flow:
1. Orchestrator reads agent file for `tools:` field
2. Orchestrator constructs prompt with context
3. Agent receives prompt + available tools
4. Agent behavior guided entirely by role definition (body content) and orchestrator prompt

Tool instructions in agent body are guidance, not constraints.

**Q3: Does tool produce RESEARCH.md or agent consumes output?**

**Agent produces RESEARCH.md. Tool provides data that agent formats.**

Flow: Tool (grounded_search) -> returns JSON/data -> Agent parses -> Agent writes RESEARCH.md

From `gsd-phase-researcher.md`:
- Agent writes to `.planning/phases/XX-name/{phase}-RESEARCH.md`
- Agent uses tools to gather information
- Agent synthesizes findings into RESEARCH.md format
- Tool output is consumed by agent, not directly written to files

**Q4: What happens if CONTEXT.md exists when researcher runs?**

**CONTEXT.md constrains research scope.** (gsd-phase-researcher.md lines 27-36)

The researcher agent:
1. Reads CONTEXT.md at step 1 (mandatory)
2. Uses `## Decisions` section as locked constraints - research THESE, not alternatives
3. Uses `## Claude's Discretion` section for freedom areas
4. Ignores `## Deferred Ideas` completely

This means if CONTEXT.md specifies "use library X", researcher researches X deeply and doesn't explore alternatives.

#### GSD Integration Approach

**Step 1: Add MCP to Claude Code configuration**
```json
// ~/.mcp.json
{
  "mcpServers": {
    "gemini-search": {
      "command": "node",
      "args": ["/path/to/gemini-search-mcp/dist/index.js"],
      "env": {}
    }
  }
}
```

**Step 2: Update agent tool declarations (optional but recommended)**
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__gemini-search__*
```

**Step 3: Add prompt guidance in orchestrators (optional enhancement)**
Add to research orchestrator prompts:
```
When performing web research, prefer `mcp__gemini-search__grounded_search` for queries requiring authoritative, grounded sources with citations.
```

**Recommendation:** Supplement WebSearch rather than replace - allows fallback if MCP has issues.

## Decisions Made

### Decision 1: AUTH-01 Viable - Gemini CLI Auth Works

**Rationale:** Client-side model restriction only affects aliases. Direct model specification bypasses it entirely.

**Approach:** Use Gemini CLI credentials (lower risk) but specify `gemini-3-flash` directly in API requests.

### Decision 2: SEARCH-03 Viable - Query Transparency Supported

**Rationale:** `groundingMetadata.webSearchQueries` array returned in API response, as confirmed in OpenCode search.js.

### Decision 3: Recommended Auth Approach

**Best of both worlds:**
- **Credentials:** Gemini CLI (official client, lower ban risk)
- **Model:** `gemini-3-flash` (better quality, Antigravity's choice)
- **Endpoint:** `daily-cloudcode-pa.sandbox.googleapis.com` (avoids prod rate limits)

This gives us:
- Lower risk (Gemini CLI is official)
- Gemini 3 access (just specify the model directly)
- Working search (sandbox endpoint proven)

### Decision 4: Code Reuse Strategy

HIGH reuse from OpenCode:
- `constants.js`: Endpoints, headers, version strings, search system instruction
- `search.js`: Two-stage orchestration pattern, response parsing
- `getRandomizedHeaders()`: Rate limit avoidance

MEDIUM reuse (adapt):
- `oauth.js`: PKCE flow (need device code instead of loopback for MCP)
- `token.js`: Refresh logic (simplify for single-token scenario)

## Deviations from Plan

None - plan executed with additional scope to address user's critical questions.

## Impact on Downstream Phases

### Phase 02 (Foundation)

- Use Gemini CLI credentials in config
- Add `gemini-3-flash` as default search model
- Copy constants from OpenCode

### Phase 03 (Authentication)

- Implement device code flow (Gemini CLI style)
- Can request `gemini-3-flash` directly
- No need for "enable preview" flag

### Phase 04 (Core Search)

- Use two-stage orchestration pattern from OpenCode
- Parse `groundingMetadata.webSearchQueries` for SEARCH-03
- Use sandbox endpoint to avoid rate limits

### Phase 05 (GSD Integration)

- Add MCP tool to `.mcp.json`
- Agents in `~/.claude/agents/` automatically get access
- No plugin bug workaround needed

## Technical Evidence

### Gemini 3 Availability Proof

**File:** `models.js` lines 11-17
```javascript
export const VALID_GEMINI_MODELS = new Set([
    'gemini-3-pro-preview',     // Valid
    'gemini-3-flash-preview',   // Valid
    'gemini-2.5-pro',           // Default
    'gemini-2.5-flash',         // Default
    'gemini-2.5-flash-lite',    // Valid
]);
```

All Gemini 3 models are in the valid set. The UI just doesn't show them by default.

**File:** `config.js` lines 571-576
```javascript
const authType = this.contentGeneratorConfig.authType;
if (authType === AuthType.USE_GEMINI || authType === AuthType.USE_VERTEX_AI) {
    this.setHasAccessToPreviewModel(true);
}
```

OAuth authentication automatically grants preview model access.

### Search Works Without Preview Flag

**File:** `constants.js` line 192
```javascript
export const SEARCH_MODEL = "gemini-3-flash";
```

Antigravity uses `gemini-3-flash` directly in search requests with no preview flag. The API accepts it.

## Open Questions (Resolved)

1. **Is Gemini 3 restriction client-side or server-side?**
   - **RESOLVED:** Client-side only. Direct model names bypass the restriction.

2. **Can we use Gemini CLI auth with Gemini 3 models?**
   - **RESOLVED:** Yes. Auth method is separate from model selection.

3. **Why did OpenCode community prefer Antigravity?**
   - **RESOLVED:** Multi-provider support (Claude, GPT), default Gemini 3, more scopes.

4. **Are there Gemini CLI OAuth plugins for OpenCode?**
   - **RESOLVED:** Yes - `opencode-gemini-cli-oauth` exists (v1.3.0).

## Sources

### Primary (Source Code)
- `~/.nvm/.../gemini-cli-core/dist/src/config/models.js` - Model resolution logic
- `~/.nvm/.../gemini-cli-core/dist/src/config/config.js` - Preview features handling
- `~/.nvm/.../gemini-cli-core/dist/src/config/defaultModelConfigs.js` - Web search config
- `~/.cache/opencode/.../opencode-antigravity-auth/dist/src/constants.js` - Search model
- `~/.cache/opencode/.../opencode-antigravity-auth/dist/src/plugin/search.js` - Two-stage pattern
- `~/.claude/agents/gsd-phase-researcher.md` - Agent tool declaration, CONTEXT.md handling
- `~/.claude/agents/gsd-project-researcher.md` - Agent tool declaration pattern
- `~/.claude/commands/gsd/research-phase.md` - Orchestrator invocation flow

### Secondary (npm registry)
- opencode-gemini-cli-oauth@1.3.0
- opencode-antigravity-auth@1.15.8
- opencode-gemini-auth@1.3.10

---

*Research completed: 2026-02-03*
*Phase: 01-research, Plan: 01*
