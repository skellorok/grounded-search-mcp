# GSD Integration Guide

Integrate grounded-search-mcp with the GSD (Get Shit Done) framework for better research quality.

## Quick Start

Run the prep command to automatically configure your project:

```
/grounded-search:prep-gsd
```

This checks your current configuration and offers to:
- Create project-level agent overrides
- Add grounded_search to tool lists
- Add preference instructions to research agents

## Prerequisites

Before integrating with GSD:

1. **grounded-search-mcp installed and configured** in your `.mcp.json`
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
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
---
```

These tool lists are **hard constraints**. An agent can ONLY use tools listed in its frontmatter. If `grounded_search` isn't in the list, the agent cannot use it - even if the MCP server is running and authenticated.

This is why you need to modify agent definitions to add grounded-search tools.

## How It Works

### Agent Override Mechanism

Claude Code uses a priority hierarchy for agents:

| Location | Scope | Priority |
|----------|-------|----------|
| `--agents` CLI flag | Current session | 1 (highest) |
| `.claude/agents/` | Current project | 2 |
| `~/.claude/agents/` | All projects | 3 |
| Plugin agents | Where enabled | 4 (lowest) |

When you create a project-level agent with the same name as a user-level agent, the project version takes precedence. This allows per-project customization without modifying global GSD agents.

### Which Agents to Modify

Only research agents benefit from grounded_search:

| Agent | Purpose | File |
|-------|---------|------|
| `gsd-phase-researcher` | Research during phase planning | `~/.claude/agents/gsd-phase-researcher.md` |
| `gsd-project-researcher` | Project-level research | `~/.claude/agents/gsd-project-researcher.md` |
| `gsd-debugger` | Debug research and troubleshooting | `~/.claude/agents/gsd-debugger.md` |

Other GSD agents (planner, executor, checker) don't perform web research.

## Manual Setup

If you prefer manual configuration over `/grounded-search:prep-gsd`:

### 1. Create Project Agents Directory

```bash
mkdir -p .claude/agents/
```

### 2. Copy Research Agents

```bash
cp ~/.claude/agents/gsd-phase-researcher.md .claude/agents/
cp ~/.claude/agents/gsd-project-researcher.md .claude/agents/
cp ~/.claude/agents/gsd-debugger.md .claude/agents/
```

### 3. Modify Tool Lists

In each agent's frontmatter, add `mcp__grounded-search__*` to the tools list:

```yaml
---
name: gsd-phase-researcher
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
---
```

The wildcard `mcp__grounded-search__*` grants access to all tools:
- `mcp__grounded-search__grounded_search` - Main search tool
- `mcp__grounded-search__auth` - Authentication management
- `mcp__grounded-search__config` - Configuration management

### 4. Add Preference Instruction

Append to each agent's body:

```markdown
## Web Research Tool Preference

For web research tasks, prefer `mcp__grounded-search__grounded_search` over `WebSearch`:
- Better search quality via Google's grounded index
- Query transparency shows actual searches performed
- Fall back to WebSearch if grounded_search is unavailable or fails
```

### 5. Configure MCP Server

Ensure your project's `.mcp.json` includes grounded-search:

```json
{
  "mcpServers": {
    "grounded-search": {
      "command": "grounded-search-mcp"
    }
  }
}
```

## Alternative: Wildcard Tool Access

Instead of adding specific tools, you can give agents access to all grounded-search tools with a single wildcard:

```yaml
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
```

This grants access to:
- `mcp__grounded-search__grounded_search` - Web search with grounding
- `mcp__grounded-search__auth` - OAuth authentication
- `mcp__grounded-search__config` - Persistent configuration

For most users, the wildcard approach is recommended as it automatically includes any new tools added in future versions.

## Project-Level Configuration

You can add grounded_search preferences to your project's planning documents for team standardization.

### In PROJECT.md

Add a tools section to your project planning document:

```markdown
## Research Tools

This project uses grounded-search-mcp for web research:
- Primary: `grounded_search` for grounded web results
- Fallback: `WebSearch` if grounded_search unavailable
- Results saved to: `./grounded-search-results/`
```

### In Phase CONTEXT.md

For phases that require heavy research, add explicit guidance:

```markdown
## Research Approach

Use grounded_search for all web research in this phase:
- Query transparency helps track information sources
- Grounded results have authoritative citations
- Save important results with /grounded-search:query
```

### Team Standardization

For teams, commit the `.claude/agents/` directory to version control:

```bash
git add .claude/agents/gsd-phase-researcher.md
git add .claude/agents/gsd-project-researcher.md
git commit -m "chore: add grounded-search to research agents"
```

This ensures all team members get the same agent configuration automatically.

## Saving Research Results

Use the query skill to save search results for later reference:

```
/grounded-search:query "your search terms"
```

Results are saved to `./grounded-search-results/` with timestamped filenames.

## Troubleshooting

### Agent Not Using grounded_search

1. Verify project agent exists: `ls .claude/agents/gsd-phase-researcher.md`
2. Check tool list includes `mcp__grounded-search__*`
3. Ensure MCP server is running: `auth --status`

### GSD Update Reverted Changes

When GSD updates, it may overwrite user-level agents. Project-level agents in `.claude/agents/` are not affected. Re-run `/grounded-search:prep-gsd` to check if reconfiguration is needed.

### Tool Not Found

Verify the MCP server key matches. Tools are named `mcp__<server-key>__<tool-name>`:
- Server key in .mcp.json: `grounded-search`
- Tool names: `mcp__grounded-search__grounded_search`, `mcp__grounded-search__auth`, `mcp__grounded-search__config`

### Authentication Errors

If you see authentication errors:

1. Check status: `auth --status`
2. Re-authenticate if needed: `auth --login antigravity`
3. Verify OAuth completed successfully in browser
4. Check token expiry - tokens refresh automatically but may need re-auth after long periods

## Maintenance Considerations

**GSD agents update frequently.** Your local overrides won't receive upstream improvements automatically.

**Recommended approach:**

1. Keep a diff of your modifications (or use project-level overrides)
2. Periodically check GSD releases for agent updates
3. Re-apply your tool list modifications to updated agents
4. Consider contributing a grounded_search integration to GSD upstream

**Minimal override strategy:**

To minimize maintenance burden, only modify the tool list line. The rest of the agent can remain unchanged:

```diff
- tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*
+ tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
```

This single-line change is easy to re-apply after GSD updates.

## Complete Override Example

Here's a minimal local override for `gsd-phase-researcher`:

```markdown
---
name: gsd-phase-researcher
description: Phase research with grounded search capability
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
---

[Original agent body content here - copy from ~/.claude/agents/gsd-phase-researcher.md]

## Web Research Tool Preference

For web research tasks, prefer `mcp__grounded-search__grounded_search` over `WebSearch`:
- Better search quality via Google's grounded index
- Query transparency shows actual searches performed
- Fall back to WebSearch if grounded_search is unavailable or fails
```

The key changes from the original:
1. Added `mcp__grounded-search__*` to the tools list
2. Added the "Web Research Tool Preference" section at the end

Everything else can remain identical to the upstream GSD agent.
