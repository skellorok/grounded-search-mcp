# Phase 6: Polish & Validation - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Production-ready MCP server through validation testing, documentation, and release preparation. Original success criteria (exponential backoff, concurrent refresh mutex, transient failure recovery, MCP schema validation) are already implemented in earlier phases — this phase validates they work correctly together and prepares for public release.

**Rescoped from:** Pure QA to validation + documentation + release prep

</domain>

<decisions>
## Implementation Decisions

### Validation Testing

**Concurrency scenarios to test:**
- Parallel grounded_search calls — verify token refresh deduplication holds
- Rapid-fire sequential searches — verify rate limiting doesn't cause death spiral
- Mixed operations (search + auth check + config read) simultaneously — verify no race conditions
- GSD parallel agent spawns — important for real-world usage where multiple research agents run concurrently

**Error scenarios to test:**
- Token expiry mid-search — verify refresh + retry works
- Network interruption — verify timeout + graceful error message
- Invalid/corrupt config file — verify server starts with defaults (no crash)
- Claude discretion on additional scenarios based on implementation review

**Reporting:**
- Markdown validation report (06-VALIDATION.md)
- Vitest unit tests for automated regression testing

### Documentation

**README structure:**
- Standard MCP format: Overview, Installation, Configuration, Tools Reference, Authentication
- Target audience: Both Claude Code users (quick start) and developers (architecture)

**Comparison documentation:**
- "Why grounded_search?" summary in README
- Detailed WebSearch comparison in docs/websearch-comparison.md

**GSD integration:**
- Brief section in README linking to detailed guide
- Detailed guide in docs/gsd-integration.md

### WebSearch Comparison Investigation

**Investigation approach:** All three methods
1. Source analysis — examine Claude Code CLI source for WebSearch implementation
2. Empirical testing — run same queries through both tools, compare side-by-side
3. Documentation review — check Anthropic docs for WebSearch specification

**Questions to answer:**
- What search API does WebSearch use? Is it inferior to Google?
- Token usage — does grounded_search save or increase tokens vs WebSearch?
- Accuracy — does Gemini intermediate step risk hallucination, or does 2-model approach improve accuracy?
- Search depth — does Gemini search deeply based on query, or just pulls top N Google results and summarizes?

**Documentation location:** Summary in README, detailed analysis in docs/websearch-comparison.md

**Token analysis methodology:** Claude determines feasible measurement approach

### GSD Integration

**Scope:** Test that local agent overrides work, then document the approach
- Do NOT ship modified agents (GSD updates often, would require tracking upstream)
- Provide instructions for users to create their own overrides

**Agents to test:**
- gsd-phase-researcher (most common research scenario)
- gsd-project-researcher
- gsd-debugger
- Any agent currently using WebSearch tool

**Configuration propagation — test all approaches:**
1. PROJECT.md level — add to project config/rules
2. Per-phase CONTEXT.md — explicitly mention in each phase context
3. REQUIREMENTS.md — add as non-functional requirement
4. Determine which actually propagates to downstream agents

**Override mechanism:** Conditional
- Use grounded_search when MCP server available
- Fall back to WebSearch if not configured/unavailable
- Log warning when falling back (don't fail silently)

**Test environment:** Fresh test project (isolate from this project's GSD setup)

**MCP unavailable handling:** Warn + fallback
- Detect MCP unavailable
- Log warning about grounded_search not available
- Use WebSearch as fallback

### Release Preparation

**npm strategy:**
- GitHub as primary source for now
- Keep npm publish option open for later (add todo)
- Package.json already has appropriate fields

**License:** Claude decides based on dependencies and MCP conventions

### Error Messaging

**Approach:** Review + improve
- Audit all error messages across codebase
- Verify consistency in style and formatting
- Ensure all errors have actionable guidance
- Current style (markdown with ## Heading, explanation, **To fix:** steps) is baseline

### Claude's Discretion

- Additional error scenarios for validation testing
- Specific test queries for WebSearch comparison
- Token measurement methodology
- License selection (likely MIT or Apache 2.0 based on dependencies)
- Any additional unit tests beyond validation scenarios

</decisions>

<specifics>
## Specific Ideas

- "I know GSD calls some agents in parallel, not sure if the ones doing research, but if yes then parallel invocation by multiple agent spawns is important"
- WebSearch comparison should answer: "Does this approach save tokens or increases because result summary is offloaded to Gemini, does this potentially dilute accuracy cause gemini could hallucinate? Or improve it because it goes through 2 models, first Gemini summarizes search results then Claude thinks about them"
- The custom_research pattern this project uses (orchestrator noted it, all subsequent agents knew to look there) — don't document this, just focus on GSD grounded search integration
- GSD agents are updated often, so shipping modified agents would create maintenance burden

</specifics>

<deferred>
## Deferred Ideas

- npm publish to registry — captured as todo for future
- Shipping pre-built GSD agents — rejected due to maintenance burden

</deferred>

---

*Phase: 06-polish-validation*
*Context gathered: 2026-02-04*
