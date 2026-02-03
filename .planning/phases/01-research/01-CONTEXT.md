# Phase 1: Research - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate technical assumptions before implementation begins. Research outputs are decisions and documentation, not code. Findings inform scope of AUTH-01, SEARCH-03, and GSD integration approach.

</domain>

<decisions>
## Implementation Decisions

### Investigation Approach
- Use local installations (OpenCode, Gemini CLI, GSD framework) over web searches
- Check `custom_research/` first to avoid duplicating work
- Test APIs directly when possible
- Sequential investigation with checkpoints between each question

### Investigation Depth
- Claude determines appropriate depth based on findings
- No time constraint — take time needed for solid answers
- Validate existing custom_research findings before filling gaps

### Priority Order
1. RESEARCH-01 (Gemini CLI grounding) — determines AUTH-01 and SEARCH-03 viability
2. Claude decides order for RESEARCH-02, RESEARCH-03/04 based on dependencies

### Checkpoints
- Pause between each research question for review
- If fundamental blocker found, pause and discuss before continuing

### Contingency Decisions
- If Gemini CLI doesn't support grounded search: **Descope AUTH-01** (Antigravity API auth only)
- If API doesn't expose search queries: Claude recommends based on alternatives found
- If OpenCode has no reusable code: Claude chooses best approach
- If fundamental blocker discovered: Pause and discuss options

### Output Format
- Standard GSD RESEARCH.md format for consistency with existing workflows
- Comprehensive RESEARCH-03/04 findings — must answer all GSD integration questions

### GSD Integration Investigation Scope
- Answer comprehensively: Can we inject tool preference at invocation time?
- How do agents modify behavior — prompts vs tool instructions vs hooks?
- Does tool produce RESEARCH.md or does researcher agent consume tool output?
- What happens if CONTEXT.md already exists when researcher runs?
- Both `gsd-phase-researcher` and `gsd-project-researcher` need consideration

### Claude's Discretion
- Order of RESEARCH-02 vs RESEARCH-03/04
- Depth of investigation per question (based on findings)
- Implementation approach if OpenCode code isn't directly reusable

</decisions>

<specifics>
## Specific Ideas

- Local OpenCode installation has the proven two-stage orchestration pattern
- Existing research in `custom_research/` covers:
  - Antigravity API spec with working endpoints
  - Two-stage orchestration pattern (critical finding)
  - OAuth comparison between Gemini CLI and Antigravity
  - API returns `groundingMetadata.webSearchQueries` (answers RESEARCH-01b)
- Token locations: `~/.ccs/cliproxy/auth/antigravity-*.json` (CCS), `~/.config/opencode/antigravity-accounts.json` (OpenCode)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-research*
*Context gathered: 2026-02-03*
