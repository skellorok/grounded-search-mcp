# grounded-search-mcp

MCP server providing grounded Google Search with real-time results and source citations

## Overview

This MCP server provides Google Search grounding through Gemini's API, offering an alternative to Claude's built-in WebSearch tool. Instead of Brave Search, you get Google's comprehensive search index with transparent query generation and detailed source citations.

**Why grounded_search over WebSearch?**
- **Google Search quality** - Access Google's larger, more comprehensive index
- **Query transparency** - See the actual search queries Gemini generates
- **Source citations** - Get deduplicated sources with URLs and domains
- **Cost effective** - Uses your existing Google One AI Pro quota instead of per-search pricing

**Who is this for?**
Claude Code users with a Google One AI Pro subscription who want higher quality search results and more control over web research.

## Quick Start

1. **Clone and build:**
   ```bash
   git clone https://github.com/your-username/grounded-search-mcp
   cd grounded-search-mcp
   npm install && npm run build
   ```

2. **Configure Claude Code** (add to `.mcp.json`):
   ```json
   {
     "mcpServers": {
       "grounded-search": {
         "command": "node",
         "args": ["/path/to/grounded-search-mcp/build/index.js"]
       }
     }
   }
   ```

3. **Authenticate:**
   ```
   auth --login antigravity
   ```

4. **Search:**
   ```
   grounded_search --query "latest TypeScript 5.8 features"
   ```

## GSD Users

If you use the GSD (Get Shit Done) framework:

```
/grounded-search:prep-gsd
```

This configures your GSD research agents to prefer grounded_search over WebSearch.
See [GSD Integration Guide](./docs/gsd-integration.md) for details.

## Installation

### From GitHub

```bash
git clone https://github.com/your-username/grounded-search-mcp
cd grounded-search-mcp
npm install
npm run build
```

### Configuration

Add to your Claude Code `.mcp.json` file. You can place this at:
- **Project level:** `.mcp.json` in your project root
- **User level:** `~/.config/claude-code/.mcp.json`
- **Scope level:** Organization-specific location

```json
{
  "mcpServers": {
    "grounded-search": {
      "command": "node",
      "args": ["/absolute/path/to/grounded-search-mcp/build/index.js"]
    }
  }
}
```

Replace `/absolute/path/to/` with the actual path where you cloned the repository.

**Important:** Restart Claude Code after modifying `.mcp.json`.

## Tools Reference

### grounded_search

Perform Google-grounded web searches via Gemini API.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (1-1000 characters) |
| `thinking` | enum | No | Thinking level: `high`, `low`, or `none`. Default: `high`. Currently inactive (gemini-2.5-flash does not support thinkingConfig). Retained for future model support. |

**Example:**
```
grounded_search --query "React Server Components best practices 2024"
grounded_search --query "npm security vulnerabilities" --thinking high
```

**Response Format:**
```markdown
## Search Results

[Synthesized answer with information from search results]

## Sources

1. **[Source Title]** - example.com
   https://example.com/page

2. **[Another Source]** - docs.example.com
   https://docs.example.com/article

## Request Details

- **Provider:** Antigravity
- **Model:** gemini-2.5-flash
- **Response time:** 2.3s

## Search Queries Used

1. "react server components 2024"
2. "RSC best practices"
```

### auth

Manage authentication for Google OAuth providers.

**Flags:**
| Flag | Argument | Description |
|------|----------|-------------|
| `--status` | none | Show authentication status for all providers |
| `--login` | `antigravity` or `gemini` | Start OAuth authentication flow |
| `--login ... --code` | authorization code or URL | Complete OAuth flow with code |
| `--logout` | `antigravity`, `gemini`, or `both` | Remove stored tokens |
| `--default-provider` | `antigravity` or `gemini` | Set default provider for searches |

**Examples:**
```
auth --status                           # Check authentication status
auth --login antigravity                # Start Antigravity OAuth flow
auth --login antigravity --code <URL>   # Complete with callback URL
auth --logout both                      # Log out of all providers
auth --default-provider gemini          # Switch default provider
```

**Authentication Flow:**
1. Run `auth --login <provider>` to get an OAuth URL
2. Open the URL in your browser and authorize
3. Copy the callback URL (or authorization code)
4. Run `auth --login <provider> --code <URL>` to complete

### config

Manage search configuration preferences.

**Flags:**
| Flag | Argument | Description |
|------|----------|-------------|
| `--show` | none | Display all configuration with defaults and valid options |
| `--get` | key | Get specific config value |
| `--set` | key=value... | Set one or more config values |
| `--reset` | key or none | Reset specific key or all to defaults |

**Configurable Keys:**
| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultProvider` | `antigravity` or `gemini` | `antigravity` | Provider for searches |
| `defaultThinking` | `high`, `low`, `none` | `high` | Thinking level (currently inactive) |
| `includeThoughts` | boolean | `false` | Include thinking in response |
| `timeout` | 1000-300000 | `60000` | Request timeout in ms |
| `verbose` | boolean | `false` | Verbose output mode |

**Examples:**
```
config --show                                    # Show all settings
config --get defaultProvider                     # Get specific value
config --set defaultThinking=low timeout=30000  # Set multiple values
config --reset defaultThinking                   # Reset specific key
config --reset                                   # Reset all to defaults
```

## Authentication

Two authentication providers are supported:

### Antigravity (Recommended)

- Uses `gemini-2.5-flash` model via sandbox endpoint
- Default provider for new installations

### Gemini CLI

- Uses `gemini-2.5-flash` model via production endpoint
- Fallback when Antigravity is unavailable

**Both providers use Google OAuth.** Run `auth --login <provider>` and complete the browser-based authorization flow.

**Token Storage:**
Tokens are stored securely at:
- Linux: `~/.config/grounded-search-mcp/`
- macOS: `~/Library/Application Support/grounded-search-mcp/`
- Windows: `%APPDATA%\grounded-search-mcp\`

Tokens refresh automatically when expired.

## Why grounded_search?

| Feature | Claude WebSearch | grounded_search |
|---------|-----------------|-----------------|
| Search Engine | Brave Search | Google Search |
| Cost | $10/1000 searches + tokens | Your Gemini quota |
| Query Transparency | Hidden | Shown in response |
| Source Citations | Built-in cited_text | URLs with domains |
| Rate Limits | Anthropic limits | Gemini/Google limits |
| Index Size | Brave's index | Google's larger index |

**Key advantages:**
- Google typically indexes more content and more recent pages
- You see exactly what queries Gemini ran to find results
- Pre-summarized results may reduce Claude token usage
- No per-search pricing if you have Google One AI Pro

See [WebSearch Comparison](./docs/websearch-comparison.md) for detailed analysis.

## GSD Integration

For users of the [GSD (Get Shit Done) framework](https://github.com/anthropics/claude-code/tree/main/gsd) who want to use grounded_search in research agents.

The GSD framework uses explicit tool lists in agent frontmatter. To add grounded_search:

1. Copy the agent you want to modify to a project-level override
2. Add `mcp__grounded-search__grounded_search` to the tool list
3. Optionally add preference instructions

See [GSD Integration Guide](./docs/gsd-integration.md) for complete setup instructions.

## Architecture

For developers interested in how this MCP server works:

**Two-Stage Orchestration:**
1. Gemini receives query with `googleSearch` tool enabled
2. Gemini generates search queries, Google executes them
3. Gemini synthesizes results with grounding metadata
4. Claude receives pre-formatted markdown response

**Provider Fallback:**
If the default provider fails (rate limit, auth error), the server automatically tries the other authenticated provider.

**Token Management:**
- Proactive refresh 60 seconds before expiry
- Promise deduplication prevents refresh races
- Atomic writes for token storage

**Config Storage:**
XDG-compliant paths via `env-paths` library:
- Config: `~/.config/grounded-search-mcp/config.json`
- Tokens: `~/.config/grounded-search-mcp/tokens.json`

## Requirements

- **Node.js 18+** - Required for native fetch and modern ES modules
- **Google One AI Pro subscription** - Provides API quota for Gemini

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reload)
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format
npm run lint:fix
npm run format

# Type check
npm run typecheck

# Test with MCP Inspector
npm run inspector
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting (`npm test && npm run lint`)
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT - see [LICENSE](./LICENSE)
