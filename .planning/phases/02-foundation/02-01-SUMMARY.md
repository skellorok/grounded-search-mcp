---
phase: 02-foundation
plan: 01
subsystem: infra
tags: [mcp, typescript, zod, stdio, biome, husky]

# Dependency graph
requires:
  - phase: 01-research
    provides: Technical validation (AUTH-01, SEARCH-03 viable), stack decisions
provides:
  - MCP server skeleton running on stdio transport
  - grounded_search tool with query/model/thinking_level parameters
  - auth tool with provider parameter
  - Pre-commit hooks with typecheck and lint
  - Project scaffold (package.json, tsconfig, biome)
affects:
  - 03-authentication (will implement real auth flows)
  - 04-core-search (will implement real Gemini API calls)
  - 05-configuration (will add config persistence)

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/sdk@1.25.3"
    - "zod@3.25.30"
    - "typescript@5.8.3"
    - "@biomejs/biome@1.9.4"
    - "husky@9.1.7"
    - "vitest@3.1.3"
  patterns:
    - MCP tool registration with Zod schemas
    - Stdio transport for Claude Code communication
    - stderr for logging (stdout reserved for JSON-RPC)
    - ESM modules with .js import extensions

key-files:
  created:
    - src/index.ts
    - src/tools/index.ts
    - src/tools/search.ts
    - src/tools/auth.ts
    - src/types/index.ts
    - src/auth/index.ts
    - src/api/index.ts
    - .mcp.json
  modified: []

key-decisions:
  - "Use Zod 3.25.x (not 4.x) for MCP SDK compatibility"
  - "Pre-commit runs full lint instead of lint-staged (avoids node_modules config pollution)"
  - "Project-scope MCP registration via .mcp.json for easy testing"

patterns-established:
  - "Tool registration: registerXxxTool(server) functions in src/tools/"
  - "Logging: console.error only, never console.log"
  - "Imports: Always use .js extension for local imports"
  - "Response format: { content: [{ type: 'text', text: JSON.stringify(...) }] }"

# Metrics
duration: 6min
completed: 2026-02-03
---

# Phase 2 Plan 1: Foundation Summary

**MCP server with grounded_search and auth tools returning mock responses, complete TypeScript/Biome/Husky toolchain**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-03T19:07:51Z
- **Completed:** 2026-02-03T19:13:25Z
- **Tasks:** 3/3
- **Files modified:** 12

## Accomplishments

- MCP server runs and registers with Claude Code via .mcp.json
- grounded_search tool appears in tools/list with full schema (query, model, thinking_level)
- auth tool appears with provider parameter (gemini-cli, antigravity)
- Both tools return mock responses ready for real implementation
- Pre-commit hooks enforce typecheck and lint on every commit

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project scaffold** - `c7840d7` (feat)
2. **Task 2: Implement MCP server with placeholder tools** - `93ac1b4` (feat)
3. **Task 3: Verify MCP integration with Claude Code** - `4810870` (feat)

## Files Created/Modified

- `package.json` - Project config with MCP SDK, Zod, dev dependencies
- `tsconfig.json` - TypeScript config with Node16 module resolution
- `biome.json` - Linting and formatting (tabs, single quotes, recommended rules)
- `vitest.config.ts` - Test configuration for node environment
- `.husky/pre-commit` - Runs typecheck and lint
- `src/index.ts` - MCP server entry point with stdio transport
- `src/tools/index.ts` - Tool registration (registerTools function)
- `src/tools/search.ts` - grounded_search tool with Zod schema
- `src/tools/auth.ts` - auth tool with provider parameter
- `src/types/index.ts` - Response type definitions
- `src/auth/index.ts` - Placeholder getTokens() returning null
- `src/api/index.ts` - Placeholder search() returning mock response
- `.mcp.json` - Project-scope MCP registration for Claude Code

## Decisions Made

1. **Zod 3.25.x over 4.x** - MCP SDK 1.25.3 uses zod/v4 import path but works with v3.25+. Used 3.25.30 for stability.

2. **Full lint over lint-staged** - lint-staged was picking up deprecated config from node_modules package.json files. Switched to full `npm run lint` in pre-commit which is more reliable.

3. **Project-scope .mcp.json** - Used project-scope registration for easy development testing. User-scope registration documented as alternative.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .planning to biome ignore list**
- **Found during:** Task 1 (lint verification)
- **Issue:** Biome was flagging .planning/*.json files for formatting
- **Fix:** Added `.planning/**` to biome.json files.ignore
- **Files modified:** biome.json
- **Verification:** `npm run lint` passes
- **Committed in:** c7840d7 (Task 1 commit)

**2. [Rule 3 - Blocking] Switched from lint-staged to full lint in pre-commit**
- **Found during:** Task 1 (first commit attempt)
- **Issue:** lint-staged was parsing deprecated configs from node_modules/cac/package.json
- **Fix:** Changed pre-commit hook from `npx lint-staged` to `npm run lint`
- **Files modified:** .husky/pre-commit
- **Verification:** Commits succeed with pre-commit checks
- **Committed in:** c7840d7 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to unblock development workflow. No scope creep.

## Issues Encountered

None beyond the blocking issues documented above.

## Verification Results

All verification commands pass:

```
npm run build     # PASS - TypeScript compiles
npm run typecheck # PASS - No type errors
npm run lint      # PASS - No lint issues
npm start         # PASS - Server starts on stdio
```

MCP Inspector verification via JSON-RPC:

```json
// tools/list shows both tools
{"tools":[
  {"name":"grounded_search","inputSchema":{...}},
  {"name":"auth","inputSchema":{...}}
]}

// grounded_search returns mock response
{"content":[{"type":"text","text":"{\"answer\":\"[MOCK] Search results for: \\\"test query\\\"\",...}"}]}

// auth returns mock error
{"content":[{"type":"text","text":"[MOCK] Auth with gemini-cli not yet implemented"}],"isError":true}
```

## User Setup Required

None - no external service configuration required for Phase 2.

## Next Phase Readiness

**Ready for Phase 3 (Authentication):**
- Server skeleton complete and running
- auth tool placeholder ready for real OAuth implementation
- Token storage location documented in Phase 1 research (~/.config/google-search-mcp/)

**No blockers.**

---
*Phase: 02-foundation*
*Completed: 2026-02-03*
