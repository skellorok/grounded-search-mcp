# Antigravity Grounding Investigation - Handoff

**Date:** 2026-02-06
**Status:** IN PROGRESS - Need to find how OpenCode forces search grounding
**Context:** UAT Test 10 re-verification for Phase 6.1

## The Problem

Antigravity (gemini-3-flash) returns text responses but **NO `groundingMetadata`** - meaning no sources/citations are returned. The model appears to answer from training data rather than actually performing web searches.

## What We Know

### 1. Gemini CLI Works, Antigravity Doesn't

| Provider | Model | groundingMetadata | Sources |
|----------|-------|-------------------|---------|
| Gemini CLI | gemini-2.5-flash | ✓ Present | ✓ Yes |
| Antigravity | gemini-3-flash | ✗ undefined | ✗ No |

Earlier searches that HAD sources were actually Gemini CLI (via fallback from Antigravity "capacity" errors).

### 2. Raw API Response Confirms No Grounding

Debug script output shows:
```
Candidate keys: [ 'content', 'finishReason' ]
groundingMetadata: undefined
```

Response contains ONLY: `content`, `finishReason` - no `groundingMetadata`, no URLs anywhere.

### 3. OpenCode Has Same Parsing Code

OpenCode's `search.js` parses `groundingMetadata` the exact same way:
- Location: `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js`
- Lines 80-95: Parses `candidate.groundingMetadata.groundingChunks[].web.uri/title`

### 4. API Spec Says groundingMetadata Should Be Automatic

Per https://github.com/NoeFabris/opencode-antigravity-auth/blob/main/docs/ANTIGRAVITY_API_SPEC.md:
- When `tools: [{ googleSearch: {} }]` is passed, `groundingMetadata` should appear automatically
- No explicit config needed to enable it

## The Missing Piece

**User remembers:** "We discussed that OpenCode does something to always FORCE the model to perform a search and not use training data. I thought we copied that same approach!"

This is the key - there must be something in OpenCode's approach that FORCES the search to actually happen, not just makes it available as a tool.

## Where To Look

1. **OpenCode's two-stage orchestration pattern:**
   - Research file: `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md`
   - Describes how OpenCode wraps search as a function that makes SEPARATE API calls

2. **OpenCode plugin files to examine:**
   - `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin/search.js` (already reviewed)
   - `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin.js` (main plugin - HOW it exposes google_search)
   - `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/constants.js`

3. **Our implementation:**
   - `src/api/request.ts` - builds search request
   - `src/api/search.ts` - executes search
   - `src/api/response.ts` - parses response

## Hypothesis

The difference might be in HOW the search is triggered:

**OpenCode approach (two-stage):**
1. Main conversation has `google_search` as a FUNCTION DECLARATION
2. Model calls `google_search` function
3. OpenCode intercepts and makes SEPARATE API call with `tools: [{googleSearch: {}}]`
4. That separate call returns grounding metadata

**Our approach (single-stage?):**
- We might be passing `tools: [{googleSearch: {}}]` directly in the main request
- Model sees the tool but chooses NOT to use it (uses training data instead)

## Debug Scripts Created

All in `/tmp/claude-1000/-home-skello-projects-gemini-search-mcp/fce2a2e1-0b46-4dc2-b959-c08aa9b491c4/scratchpad/`:
- `debug-antigravity.js` - Basic test
- `debug-full-response.js` - Dumps full response
- `debug-force-search.js` - Tries to force search via query
- `debug-with-project.js` - Tests with resolved project ID
- `debug-full-keys.js` - Searches for any grounding fields

## Also Found: Thinking Level Issue

User's config has `defaultThinking: "low"` saved. To fix:
```
config --reset defaultThinking
```
Or: `config --set defaultThinking=high`

## Next Steps

1. **Re-read our custom research** about two-stage orchestration
2. **Compare OpenCode's plugin.js** - how does it expose google_search as a function?
3. **Check if our request format** is actually doing two-stage or single-stage
4. **Key question:** Are we just passing the tool, or are we forcing its invocation?

## Files to Read on Resume

```
# Our research on OpenCode's approach
cat custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md

# OpenCode's main plugin (how it exposes google_search)
cat ~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/plugin.js

# Our request building
cat src/api/request.ts

# Our search execution
cat src/api/search.ts
```

---
*Handoff created: 2026-02-06*
