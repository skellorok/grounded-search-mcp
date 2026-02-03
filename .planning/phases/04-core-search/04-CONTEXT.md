# Phase 4: Core Search - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Perform grounded web searches via both Gemini CLI and Antigravity providers, using two-stage orchestration to guarantee grounding. Return text responses with source citations and query transparency. Model/thinking configuration parameters are Phase 5 scope.

</domain>

<decisions>
## Implementation Decisions

### Two-Stage Orchestration
- Always use two-stage orchestration pattern regardless of provider
- Forces search to happen (no training data fallback)
- Dedicated search request with ONLY `googleSearch: {}` tool + system instruction
- Model cannot skip search - guarantees grounding occurs

### Model and Thinking Defaults
- Default model: `gemini-3-flash`
- Default thinking level: `low` (faster responses)
- Default `includeThoughts`: `false`
- `include_thoughts` parameter available (defaults to false) for debugging
- Phase 5 adds user configuration for model and thinking overrides

### Provider Behavior
- Provider affects: endpoint, headers, rate limit handling
- Gemini CLI: production endpoint (`cloudcode-pa.googleapis.com`), simple headers
- Antigravity: sandbox endpoint (`daily-cloudcode-pa.sandbox.googleapis.com`), rotated headers via `getRandomizedHeaders()`
- Request structure and response format identical across providers
- Auto-fallback to other provider if first fails (when both configured)

### Response Structure
- Markdown sections format (like OpenCode)
- `## Search Results` + grounded text
- `### Sources` + linked citations
- `### Search Queries Used` + quoted queries

### Citation Formatting
- Format: `- [Title](url) (domain.com)`
- Shows title, full URL, and domain at a glance
- Helps GSD agents assess source credibility quickly
- API returns title + URL only (no snippets available)

### Query Transparency
- Always include `### Search Queries Used` section
- Quoted bullet list format: `- "query text"`
- Helps GSD agents verify search goal achieved
- Enables agents to decide on follow-up queries

### Error Handling
- Plain text error messages (agent interprets)
- Clearly indicate error type: auth failure vs API error vs no results
- Include guidance on what to do
- NO auto-triggered auth flow - inform only
- GSD agents can fallback to WebSearch if in their tool list
- Users see clear message and can manually re-auth

### Claude's Discretion
- Exact system instruction wording for search requests
- Request ID generation approach
- Retry timing for transient API failures
- Header rotation frequency for Antigravity

</decisions>

<specifics>
## Specific Ideas

- Port two-stage pattern from OpenCode's `search.js` (lines 118-178)
- Reuse `parseSearchResponse()` for extracting groundingMetadata
- Reuse `getRandomizedHeaders()` from constants.js for Antigravity
- Response format should work well for GSD research agents (markdown they can reason about)

</specifics>

<deferred>
## Deferred Ideas

- Model selection parameter (`model: "gemini-3-pro"`) - Phase 5
- Thinking level parameter (`thinking: "high" | "low" | "off"`) - Phase 5
- Persistent user preferences for model/thinking - Phase 5
- URL context tool integration (`urlContext: {}`) - future enhancement

</deferred>

---

*Phase: 04-core-search*
*Context gathered: 2026-02-03*
