# Phase 3: Authentication - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

OAuth device code flows for both Gemini CLI and Antigravity providers with token persistence and error states. Users can authenticate with one or both providers, set a default, and override per-request. Authentication is explicit (user must call auth tool), not automatic.

**From Phase 1 Research:**
- MCP servers cannot spawn loopback servers (stdio transport) — device code flow only
- Gemini CLI credentials preferred (lower ban risk vs Antigravity IDE impersonation)
- Token storage at `~/.config/google-search-mcp/` (separate from Gemini CLI)
- Both providers use same API endpoint, different OAuth credentials

</domain>

<decisions>
## Implementation Decisions

### Provider Selection

- **Both providers supported**: Gemini CLI and Antigravity can be authenticated simultaneously
- **Selection hierarchy**: Config sets default → tool parameter overrides → menu if neither specified
- **Default provider**: Gemini CLI (recommended) if nothing configured
- **Provider names in UI**: Use technical names "Gemini CLI" / "Antigravity"
- **Risk warnings**: Document in docs only, don't clutter auth flow with risk commentary

### Auth Tool Design

Single `auth` tool with flag-based interface:

| Flag | Behavior |
|------|----------|
| `auth` (no flags) | Show help/usage |
| `auth --login` | Show provider selection menu |
| `auth --login gemini` | Start Gemini CLI auth flow |
| `auth --login antigravity` | Start Antigravity auth flow |
| `auth --status` | Show both providers' status + which is default |
| `auth --logout` | Show menu: Gemini CLI / Antigravity / Both |
| `auth --logout gemini` | Logout Gemini CLI only |
| `auth --default-provider` | Show menu to set default |
| `auth --default-provider gemini` | Set Gemini CLI as default |

- **Provider names**: Full names only (no shortcuts like "g" or "gem")
- **Already authenticated + login**: Confirm "Already authenticated. Re-authenticate?"

### Device Code Flow UX

- **URL format**: Full URL with code embedded (e.g., `https://codeassist.google.com/authcode?code=XXXX`)
- **Browser**: Don't auto-open, just display URL for user to copy/click
- **Timeout**: 5 minutes polling
- **Polling feedback**: Countdown timer showing remaining time
- **Cancel**: Support Ctrl+C to cancel auth wait
- **Timeout/cancel**: Offer retry with new code

### Auth Success/Status Display

- **Success message**: Show confirmation with details (masked email, expiry info)
- **Status check**: Separate from auth trigger — `auth --status` doesn't start auth
- **Multi-account hint**: None — let Google's account chooser handle it
- **Expiry time**: Don't show in status, just auth state

### Privacy (Email Masking)

**Critical: MCP tool outputs are visible to Claude and could appear in prompts/logs.**

| Context | Email Display |
|---------|---------------|
| MCP tool responses | Masked: `jo***@gm***.com` |
| Terminal during auth | Full email OK (not captured by Claude) |
| Local log files | Full email OK (user's machine) |

### Search Provider Selection

- **Config default**: Determines which provider is used for searches
- **Per-request override**: Search tool accepts optional provider parameter
- **Command to change default**: `auth --default-provider`
- **Fallback behavior**: If preferred provider fails, fall back to secondary with notification + suggest re-auth for failed provider
- **Both fail**: Return error with re-auth instructions (don't auto-trigger auth)
- **Fallback indicator**: Brief note in response like "(via Antigravity)"

### Token Storage

- **Location**: `~/.config/google-search-mcp/tokens.json`
- **Format**: Single JSON file with both providers: `{gemini: {...}, antigravity: {...}}`
- **Security**: Never committed to git, never leaves disk, created only during auth
- **Corrupt file**: Backup to `tokens.json.bak`, then treat as unauthenticated

### Token Refresh

- **Timing**: Both proactive (before expiry) and reactive (on 401)
- **Retries**: 3 attempts with exponential backoff
- **Refresh fail**: Suggest possible causes ("token may be revoked or expired")

### Error Handling

- **Not authenticated**: Search fails with instructions (explicit auth required)
- **OAuth rejection**: Pass through Google's error directly
- **403 responses**: Parse error details — different handling for quota vs banned
- **Network errors**: Show technical details (e.g., `ETIMEDOUT connecting to...`)
- **Rate limits (429)**: Show wait time if API provides it
- **Invalid parameters**: List valid options
- **Error format**: Plain text messages, no structured error codes
- **Debug mode**: Via config setting for verbose output

### Logging

- **Local log file**: Full error details including API responses
- **Full email in logs**: OK (local machine, useful for debugging)

### Claude's Discretion

- URL styling in terminal (OSC 8 hyperlinks vs plain text)
- Token file permissions (likely 600)
- Exact format of "not authenticated" message
- When to include action suggestions in error messages

</decisions>

<specifics>
## Specific Ideas

- Auth tool feels like a CLI with flags, not multiple separate MCP tools
- Provider names match source projects (Gemini CLI, Antigravity) for technical users
- Privacy-first approach: assume MCP output could be logged, mask PII

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-authentication*
*Context gathered: 2026-02-03*
