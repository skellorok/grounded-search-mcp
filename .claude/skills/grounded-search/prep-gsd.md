---
name: grounded-search:prep-gsd
description: Check and configure GSD agents for grounded search integration
---

# Prepare GSD for Grounded Search

Check current GSD configuration and recommend changes to enable grounded search in research agents.

## Usage

```
/grounded-search:prep-gsd
```

## Behavior

This skill is idempotent - safe to run multiple times. It always checks current state first.

### Step 1: Check Current State

Check these items and report status:

1. **Project agents directory**: Does `.claude/agents/` exist at project level?
2. **Research agents present**: Are `gsd-phase-researcher.md` and `gsd-project-researcher.md` in project agents?
3. **Tool list configured**: Do project agents have `mcp__grounded-search__*` in their tools list?
4. **Preference instruction**: Do project agents have grounded_search preference in their body?
5. **MCP configuration**: Does `.mcp.json` have `grounded-search` server configured?

### Step 2: Present Checklist

Show a checklist of needed changes:

```
## GSD Integration Status

[ ] .claude/agents/ directory exists
[ ] gsd-phase-researcher.md in project (for override)
[ ] gsd-project-researcher.md in project (for override)
[ ] Tool list includes mcp__grounded-search__*
[ ] Preference instruction added to agent body
[ ] .mcp.json has grounded-search configured

### Recommended Changes

1. Create .claude/agents/ directory
2. Copy gsd-phase-researcher.md from ~/.claude/agents/
3. Add mcp__grounded-search__* to tool list
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

   If source agents don't exist, report: "Source agents not found at ~/.claude/agents/. Please ensure GSD is installed."

3. **Modify tool lists**: In each copied agent's frontmatter, add to tools line:
   ```yaml
   tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
   ```

4. **Add preference instruction**: Append to each agent's body (after existing content):
   ```markdown

   ## Web Research Tool Preference

   For web research tasks, prefer `mcp__grounded-search__grounded_search` over `WebSearch`:
   - Better search quality via Google's grounded index
   - Query transparency shows actual searches performed
   - Fall back to WebSearch if grounded_search is unavailable or fails
   ```

5. **Check .mcp.json**: If grounded-search is not configured, offer to add it.
   Do NOT modify .mcp.json without asking - it may have project-specific settings.

### Step 5: Ask About Commit

After applying changes, ask: "Commit these changes? (yes/no)"

If yes, commit with message: "chore: configure GSD agents for grounded-search integration"

## Notes

- Project-level agents override user-level agents with the same name
- Only research agents are modified (gsd-phase-researcher, gsd-project-researcher)
- Original GSD agents at ~/.claude/agents/ are never modified
- Re-running this skill after GSD updates will show if agents need re-configuration
