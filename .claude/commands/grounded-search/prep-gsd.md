---
name: grounded-search:prep-gsd
description: Check and configure GSD agents for grounded search integration
---

# Prepare GSD for Grounded Search

Check current GSD configuration and recommend changes to enable grounded search in research and debug agents.

## Usage

```
/grounded-search:prep-gsd
```

## Behavior

This skill is idempotent - safe to run multiple times. It always checks current state first.

### Step 1: Check Current State

Check these items and report status:

1. **Project agents directory**: Does `.claude/agents/` exist at project level?
2. **Target agents present**: Are `gsd-phase-researcher.md`, `gsd-project-researcher.md`, and `gsd-debugger.md` in project agents?
3. **Tool list configured**: Do project agents have `mcp__grounded-search__*` in their tools list?
4. **Preference instruction**: Do project agents have the grounded search priority section in their body?
5. **Brave Search config**: Does `.planning/config.json` have `brave_search` enabled? (informational — affects priority guidance)
6. **MCP configuration**: Does `.mcp.json` have `grounded-search` server configured?

### Step 2: Present Checklist

Show a checklist of needed changes:

```
## GSD Integration Status

[ ] .claude/agents/ directory exists
[ ] gsd-phase-researcher.md in project (for override)
[ ] gsd-project-researcher.md in project (for override)
[ ] gsd-debugger.md in project (for override)
[ ] Tool list includes mcp__grounded-search__*
[ ] Web research priority instruction added to agent body
[ ] .mcp.json has grounded-search configured

### Brave Search
Detected: yes/no (from .planning/config.json brave_search flag)
Priority instruction accounts for Brave: yes/no

### Recommended Changes

1. Create .claude/agents/ directory
2. Copy gsd-phase-researcher.md from ~/.claude/agents/
3. Copy gsd-project-researcher.md from ~/.claude/agents/
4. Copy gsd-debugger.md from ~/.claude/agents/
5. Add mcp__grounded-search__* to tool lists
6. Add web research priority instruction
...
```

### Step 3: Wait for Confirmation

Ask: "Apply these changes? (yes/no)"

Do NOT proceed without explicit "yes" confirmation.

### Step 4: Apply Changes

For confirmed items:

1. **Create directory**: `mkdir -p .claude/agents/`

2. **Copy agents**: If source agents exist at `~/.claude/agents/`:
   - Copy `gsd-phase-researcher.md` to `.claude/agents/`
   - Copy `gsd-project-researcher.md` to `.claude/agents/`
   - Copy `gsd-debugger.md` to `.claude/agents/`

   If source agents don't exist, report: "Source agents not found at ~/.claude/agents/. Please ensure GSD is installed."

3. **Modify tool lists**: In each copied agent's frontmatter, append `mcp__grounded-search__*` to the existing tools line. Preserve the agent's original tools — do not replace them.

   For research agents (phase-researcher, project-researcher), the result should look like:
   ```yaml
   tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
   ```

   For the debugger, the result should look like:
   ```yaml
   tools: Read, Write, Edit, Bash, Grep, Glob, WebSearch, mcp__grounded-search__*
   ```

4. **Patch the existing web research priority section**: Each research agent has an inline tool priority list (typically "Context7 first → WebFetch → WebSearch" or similar). Find this existing priority section and replace it with the updated priority that includes grounded search. Do NOT just append — patch in place so there is one authoritative priority list.

   Updated priority for research agents:
   ```markdown
   ## Web Research Tool Priority

   Use this order for web research:
   1. **Context7** — library/framework documentation (always try first)
   2. **WebFetch** — when you have a specific URL for official docs
   3. **mcp__grounded-search__grounded_search** — general web research (Google-grounded, shows actual queries used)
   4. **gsd-tools.cjs websearch** — Brave Search API (only if brave_search flag is enabled in init context)
   5. **WebSearch** — fallback if all above are unavailable or fail

   If grounded_search is unavailable (MCP server not running), skip to the next option in the priority list.
   ```

   For the debugger (which has no existing priority section), append to the end of the body:
   ```markdown

   ## Web Research Tool Priority

   When investigating issues that require web research:
   1. **mcp__grounded-search__grounded_search** — preferred for general web research (Google-grounded, shows actual queries used)
   2. **WebSearch** — fallback if grounded_search is unavailable or fails
   ```

5. **Check .mcp.json**: If grounded-search is not configured, offer to add it.
   Do NOT modify .mcp.json without asking - it may have project-specific settings.

### Step 5: Ask About Commit

After applying changes, ask: "Commit these changes? (yes/no)"

If yes, commit with message: "chore: configure GSD agents for grounded-search integration"

## Notes

- Project-level agents override user-level agents with the same name
- Three agents are modified: gsd-phase-researcher, gsd-project-researcher, gsd-debugger
- Original GSD agents at ~/.claude/agents/ are never modified
- Re-running this skill after GSD updates will show if agents need re-configuration
- When GSD updates, project-level overrides are NOT affected — but the base agent may have changed. Re-run this command to detect drift and re-copy if needed
