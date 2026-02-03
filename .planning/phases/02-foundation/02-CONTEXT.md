# Phase 2: Foundation - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish working MCP server skeleton with placeholder tools. Server runs, registers with Claude Code, exposes tool schemas, and returns mock responses. No real API calls — that's Phase 3+.

</domain>

<decisions>
## Implementation Decisions

### Project Structure
- **Language:** TypeScript
- **Package manager:** npm (universally available, runtime performance irrelevant for this use case)
- **Directory layout:** Feature folders — `src/tools/`, `src/auth/`, `src/api/`
- **Node version:** 18+ minimum (widest compatibility, 20+ works fine)
- **TypeScript:** Strict mode enabled
- **Module system:** Claude's discretion (ESM preferred based on MCP SDK)

### Tool Schema Design
- **Tool name:** `grounded_search`
- **Primary parameter:** `query` (string, required)
- **Additional parameters (stubbed):** `model`, `thinking_level` — schema stable from start
- **Model default:** `gemini-3-flash`
- **Thinking levels:** Claude's discretion based on Gemini API capabilities
- **Description style:** Concise (one sentence)
- **Auth tool:** Single `auth` tool supporting both Gemini CLI and Antigravity providers via parameter

### Mock Response Format
- **Structure:** Claude's discretion — should mirror real response shape for integration testing
- **Behavior:** Claude's discretion — echo query or static, whichever best verifies integration
- **Auth mock:** Claude's discretion — simulate success or return not-implemented based on testing needs

### Development Workflow
- **Dev server:** Claude's discretion (tsx watch or build-then-run)
- **Test framework:** Claude's discretion (vitest preferred)
- **Linting/formatting:** Biome (all-in-one, fast)
- **Pre-commit hooks:** Yes — lint + typecheck via Husky + lint-staged
- **CI:** Claude's discretion on timing (now vs Polish phase)
- **MCP registration:** Document both local (.claude/settings.json) and user (~/.claude/settings.json) options
- **README:** Claude's discretion on scope for this phase
- **Package name:** Claude's discretion based on discoverability

### Claude's Discretion
- Module system (ESM vs CommonJS)
- Exact mock response structure and behavior
- Auth mock behavior
- Dev server approach
- Test framework selection
- CI timing
- README scope
- Package name
- Thinking level values

</decisions>

<specifics>
## Specific Ideas

- Gemini 3 model names follow pattern: `gemini-3-flash`, `gemini-3-pro`
- Auth tool must handle two providers: Gemini CLI credentials and Antigravity
- Tool schemas should be stable from start — add parameters now even if stubbed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-foundation*
*Context gathered: 2026-02-03*
