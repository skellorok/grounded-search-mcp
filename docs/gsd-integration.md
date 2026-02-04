# GSD Integration Guide

Integrate grounded_search with the [GSD (Get Shit Done) framework](https://github.com/anthropics/claude-code/tree/main/gsd) for Claude Code.

## Prerequisites

Before integrating with GSD:

1. **gemini-search-mcp installed and configured** in your `.mcp.json`
2. **Authentication complete** - run `auth --login antigravity` and complete OAuth
3. **GSD framework installed** in your Claude Code environment

Verify authentication status:
```
auth --status
```

## The Challenge

GSD agents define explicit tool lists in their frontmatter:

```yaml
---
name: gsd-phase-researcher
description: Research agent for phase planning
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
---
```

These tool lists are **hard constraints**. An agent can ONLY use tools listed in its frontmatter. If `mcp__gemini-search__grounded_search` isn't in the list, the agent cannot use it regardless of what's available in `.mcp.json`.

## Solution: Local Agent Overrides

Create local copies of GSD agents with grounded_search added to their tool lists.

### Step 1: Identify Agents to Override

The following GSD agents use WebSearch for research:

| Agent | Purpose | File |
|-------|---------|------|
| `gsd-phase-researcher` | Research during phase planning | `~/.claude/agents/gsd-phase-researcher.md` |
| `gsd-project-researcher` | Project-level research | `~/.claude/agents/gsd-project-researcher.md` |
| `gsd-debugger` | Debug research and troubleshooting | `~/.claude/agents/gsd-debugger.md` |

### Step 2: Copy Agent to Local Override

```bash
# Create local override of the phase researcher
cp ~/.claude/agents/gsd-phase-researcher.md ~/.claude/agents/my-gsd-phase-researcher.md
```

### Step 3: Modify the Tool List

Edit the copied file and add grounded_search to the tools line:

**Before:**
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
```

**After:**
```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__gemini-search__grounded_search, mcp__gemini-search__auth
```

Note: Adding `mcp__gemini-search__auth` allows the agent to check authentication status or re-authenticate if needed.

### Step 4: Add Preference Instructions (Optional)

Add guidance to the agent's instructions section to prefer grounded_search:

```markdown
## Web Research

For web research tasks, prefer `grounded_search` over `WebSearch` when available:

- **grounded_search** provides Google Search results with source citations and query transparency
- Use `grounded_search --query "your search"` for research queries
- Fall back to `WebSearch` if grounded_search fails or isn't authenticated

Check authentication status with `auth --status` before heavy research.
```

### Step 5: Use Your Custom Agent

When invoking GSD workflows, specify your custom agent:

```
/gsd:research --agent my-gsd-phase-researcher
```

Or configure it as default in your GSD settings.

## Alternative: Wildcard Tool Access

Instead of adding specific tools, you can give agents access to all gemini-search tools:

```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__gemini-search__*
```

This grants access to:
- `mcp__gemini-search__grounded_search`
- `mcp__gemini-search__auth`
- `mcp__gemini-search__config`

## Project-Level Configuration

You can add grounded_search preferences to your project's planning documents.

### In PROJECT.md

```markdown
## Research Tools

For research tasks in this project, prefer `mcp__gemini-search__grounded_search` over WebSearch:
- Better search quality via Google index
- Query transparency shows actual searches performed
- Cost-effective for high-volume research

Authentication: Ensure `auth --status` shows authenticated before research phases.
```

### In Phase CONTEXT.md

```markdown
## Research Approach

This phase involves significant API research. Use:
1. `grounded_search` for documentation and API reference lookups
2. `WebSearch` as fallback if grounded_search fails
3. `WebFetch` to retrieve specific pages found in search results
```

## Troubleshooting

### "Tool not found: mcp__gemini-search__grounded_search"

**Causes:**
1. gemini-search-mcp not configured in `.mcp.json`
2. MCP server not running (restart Claude Code)
3. Tool name misspelled in agent frontmatter

**Solutions:**
- Verify `.mcp.json` has gemini-search configured
- Restart Claude Code after `.mcp.json` changes
- Check exact tool name: `mcp__gemini-search__grounded_search`

### Agent Still Uses WebSearch

**Causes:**
1. Agent frontmatter doesn't include grounded_search
2. Using upstream agent instead of local override
3. No preference instructions in agent

**Solutions:**
- Verify your local override has the tool in its list
- Ensure you're invoking the correct agent name
- Add explicit preference instructions

### Authentication Errors During Research

**Causes:**
1. Tokens expired and need refresh
2. Never authenticated with provider
3. OAuth tokens revoked

**Solutions:**
- Run `auth --status` to check current state
- Run `auth --login antigravity` to re-authenticate
- Check for token files in config directory

## Maintenance Considerations

**GSD agents update frequently.** Your local overrides won't receive upstream improvements automatically.

**Recommended approach:**
1. Keep a diff of your modifications
2. Periodically check GSD releases for agent updates
3. Re-apply your tool list modifications to updated agents
4. Consider contributing a grounded_search integration to GSD upstream

**Minimal override:**
To minimize maintenance burden, only override the tool list line. Keep all other agent content identical to upstream so you can easily merge updates.

## Example: Complete Override

Here's a minimal local override for `gsd-phase-researcher`:

```markdown
---
name: my-gsd-phase-researcher
description: Phase researcher with grounded_search support
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__gemini-search__*
---

[Rest of agent content identical to upstream gsd-phase-researcher.md]

## Additional Instructions

For web research, prefer grounded_search over WebSearch:
- grounded_search provides Google Search with query transparency
- Use auth --status to verify authentication before research
- Fall back to WebSearch if grounded_search is unavailable
```

This approach gives you grounded_search access while maintaining compatibility with standard GSD workflows.
