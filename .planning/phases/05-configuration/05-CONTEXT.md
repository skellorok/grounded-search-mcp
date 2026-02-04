# Phase 5: Configuration - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Persist user search preferences across sessions and add response transparency. Users can configure default provider, thinking level, timeout, and verbosity. Search responses include metadata showing what provider/model was used.

**Constraints discovered during Phase 4:**
- Model selection is provider-specific (gemini-2.5-flash for Gemini CLI, gemini-3-flash for Antigravity)
- Thinking parameter already implemented in search tool
- This phase adds persistence and transparency, not new parameters

</domain>

<decisions>
## Implementation Decisions

### Config Storage
- Separate file from auth tokens: `config.json` alongside `tokens.json`
- Location: `~/.config/gemini-search-mcp/config.json` (same XDG dir as auth)
- Pretty JSON format (human-editable, indented)
- Include schema version field for future migration
- Invalid config: warn + fallback to defaults (don't fail)
- Claude's discretion: atomic writes (temp file + rename) or direct write

### Config Fields
- `version`: Schema version for migration
- `defaultProvider`: 'antigravity' | 'gemini'
- `defaultThinking`: 'high' | 'low' | 'none'
- `includeThoughts`: boolean (show model thinking)
- `timeout`: number in ms
- `verbose`: boolean (extra logging/debug info)

### Config Tool
- New tool named `config` (not extending auth tool)
- Flag-based interface: `--set key=value`, `--get key`, `--reset`, `--show`
- Supports multiple `--set` flags in one call
- Reset supports both `--reset` (all) and `--reset key` (individual)
- `--show` displays: current values, defaults, and valid options for each setting
- Strict validation on `--set` (reject invalid values immediately)
- No confirmation needed for `--reset`

### Response Metadata
- New section: `### Request Details` (bullet list format)
- Content: Provider, Model (always shown, regardless of verbose setting)
- Placement: After Sources, before Search Queries Used
- Error responses: Include full attempt chain ("Tried: antigravity (failed), gemini (failed)")
- When `include_thoughts=true`: Add `### Model Thinking` section (regular, not collapsible)
- When `verbose=true`: Add response time to Request Details

### Default Values
- `defaultProvider`: 'antigravity'
- `defaultThinking`: 'high'
- `includeThoughts`: false
- `timeout`: 60000 (60 seconds)
- `verbose`: false

### First-Run & Fallback Behavior
- Auto-create config.json with defaults on first search
- If preferred provider not authenticated: fallback to other + note in metadata
- If thinking requested but provider doesn't support it: note in metadata
- Migration: auto-migrate old schema versions + backup as config.json.bak

### Claude's Discretion
- Exact validation error messages
- Config file write atomicity (temp+rename vs direct)
- Logging implementation for verbose mode
- Request Details bullet list formatting details

</decisions>

<specifics>
## Specific Ideas

- Reuse XDG path resolution from existing auth/tokens.ts
- Config tool output should be clear markdown like auth tool
- Response metadata should help GSD agents understand what happened (provider fallback, thinking limitations)

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope

</deferred>

---

*Phase: 05-configuration*
*Context gathered: 2026-02-04*
