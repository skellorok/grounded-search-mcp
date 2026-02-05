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

- **gsd-phase-researcher.md** - Used by /gsd:research-phase
- **gsd-project-researcher.md** - Used for project-wide research

Other GSD agents (planner, executor, checker) don't perform web research.

## Manual Setup

If you prefer manual configuration over /grounded-search:prep-gsd:

### 1. Create Project Agents Directory

```bash
mkdir -p .claude/agents/
```

### 2. Copy Research Agents

```bash
cp ~/.claude/agents/gsd-phase-researcher.md .claude/agents/
cp ~/.claude/agents/gsd-project-researcher.md .claude/agents/
```

### 3. Modify Tool Lists

In each agent's frontmatter, add `mcp__grounded-search__*` to the tools list:

```yaml
---
name: gsd-phase-researcher
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__grounded-search__*
---
```

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
