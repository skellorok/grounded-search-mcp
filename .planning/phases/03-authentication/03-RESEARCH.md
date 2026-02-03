# Phase 3: Authentication - Research

**Researched:** 2026-02-03
**Domain:** OAuth Device Code Flow, MCP Auth Patterns, Token Persistence
**Confidence:** HIGH

## Summary

This research covers implementing OAuth device code flow for both Gemini CLI and Antigravity providers within the MCP server context. Per CONTEXT.md decisions, we use device code flow exclusively (MCP servers cannot spawn loopback servers due to stdio transport). The auth module provides a single `auth` tool with flag-based interface supporting `--login`, `--status`, `--logout`, and `--default-provider` operations.

Key findings:
- Google's OAuth device code flow uses dedicated endpoints (`/device/code` for initiation, `/token` for polling) with PKCE support
- Gemini CLI uses a hybrid approach: shows URL with embedded code, user enters authorization code manually (NOT standard device code polling)
- Token storage at `~/.config/google-search-mcp/tokens.json` using `env-paths` for cross-platform support
- PKCE generation via `pkce-challenge` package (async API, returns `code_verifier` and `code_challenge`)
- MCP security best practices emphasize per-user token isolation and never passing tokens through to downstream APIs

**Primary recommendation:** Implement PKCE-based authorization code flow with manual code entry (Gemini CLI pattern), not standard device polling. This provides better UX since Google's codeassist redirect shows the code directly.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pkce-challenge | ^5.x | PKCE generation | Zero-dependency, async API, TypeScript types, well-maintained |
| env-paths | ^3.x | Cross-platform config paths | Standard for XDG Base Directory compliance, handles Linux/macOS/Windows |
| zod | ^3.25 | Schema validation | Already in project, use for token file validation |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs/promises | (Node built-in) | Async file operations | Token storage read/write |
| crypto | (Node built-in) | Random state generation | OAuth state parameter |
| readline/promises | (Node built-in) | User input | Manual code entry during auth |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pkce-challenge | Manual implementation | pkce-challenge is tiny (< 100 lines), well-tested, async |
| env-paths | xdg-basedir | env-paths is cross-platform, xdg-basedir Linux only |
| Manual fetch | google-auth-library | google-auth-library is heavy (many deps), we only need token exchange |

**Installation:**
```bash
npm install pkce-challenge env-paths
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── auth/
│   ├── index.ts           # Main exports: getTokens(), isAuthenticated(), etc.
│   ├── device-flow.ts     # OAuth device code flow implementation
│   ├── token-storage.ts   # File-based token persistence
│   ├── providers.ts       # Provider configurations (Gemini CLI, Antigravity)
│   └── types.ts           # Auth-specific types
├── tools/
│   └── auth.ts            # MCP auth tool with flag-based interface
└── types/
    └── index.ts           # Extended with provider types
```

### Pattern 1: PKCE Authorization Code Flow (Gemini CLI Style)

**What:** Generate PKCE challenge, show auth URL to user, user manually enters authorization code from Google's redirect page.

**When to use:** All authentication flows (this is not standard device polling, but manual code entry).

**Why:** Google's codeassist redirect (`https://codeassist.google.com/authcode`) displays the authorization code directly. User copies and pastes it. This works in all environments (SSH, containers, remote).

**Example:**
```typescript
// Source: Gemini CLI oauth2.js (lines 280-337)
import pkceChallenge from 'pkce-challenge';
import crypto from 'node:crypto';

interface AuthFlowResult {
  authUrl: string;
  codeVerifier: string;
  state: string;
}

async function startAuthFlow(provider: 'gemini' | 'antigravity'): Promise<AuthFlowResult> {
  const config = PROVIDER_CONFIGS[provider];
  const pkce = await pkceChallenge();
  const state = crypto.randomBytes(32).toString('hex');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,  // https://codeassist.google.com/authcode
    response_type: 'code',
    scope: config.scopes.join(' '),
    access_type: 'offline',
    code_challenge: pkce.code_challenge,
    code_challenge_method: 'S256',
    state,
    prompt: 'consent',  // Force refresh token
  });

  return {
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
    codeVerifier: pkce.code_verifier,
    state,
  };
}
```

### Pattern 2: Token Exchange

**What:** Exchange authorization code for access/refresh tokens using PKCE verifier.

**When to use:** After user enters authorization code.

**Example:**
```typescript
// Source: Google OAuth2 documentation
interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  provider: 'gemini' | 'antigravity'
): Promise<TokenResponse> {
  const config = PROVIDER_CONFIGS[provider];

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Token exchange failed: ${error.error_description || error.error}`);
  }

  return response.json();
}
```

### Pattern 3: Token Storage with Validation

**What:** Persist tokens to JSON file with schema validation and atomic writes.

**When to use:** After successful authentication and token refresh.

**Example:**
```typescript
// Source: Node.js best practices, XDG Base Directory spec
import envPaths from 'env-paths';
import { z } from 'zod';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const paths = envPaths('google-search-mcp', { suffix: '' });
const TOKEN_FILE = path.join(paths.config, 'tokens.json');

const ProviderTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_at: z.number(),  // Unix timestamp
  email: z.string().email().optional(),
  project_id: z.string().optional(),
});

const TokenFileSchema = z.object({
  gemini: ProviderTokensSchema.optional(),
  antigravity: ProviderTokensSchema.optional(),
  default_provider: z.enum(['gemini', 'antigravity']).optional(),
});

type TokenFile = z.infer<typeof TokenFileSchema>;

async function saveTokens(tokens: TokenFile): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });

  // Atomic write via temp file
  const tempFile = `${TOKEN_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  await fs.rename(tempFile, TOKEN_FILE);
}

async function loadTokens(): Promise<TokenFile | null> {
  try {
    const content = await fs.readFile(TOKEN_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    return TokenFileSchema.parse(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    // Backup corrupt file
    await fs.rename(TOKEN_FILE, `${TOKEN_FILE}.bak`).catch(() => {});
    return null;
  }
}
```

### Pattern 4: Token Refresh with Retry

**What:** Proactively refresh tokens before expiry, with exponential backoff on failure.

**When to use:** Before API calls (proactive) or on 401 response (reactive).

**Example:**
```typescript
// Source: OpenCode token.js (lines 59-127)
const ACCESS_TOKEN_BUFFER_MS = 60_000;  // Refresh 60s before expiry
const MAX_REFRESH_RETRIES = 3;

async function refreshAccessToken(
  provider: 'gemini' | 'antigravity',
  refreshToken: string
): Promise<TokenResponse> {
  const config = PROVIDER_CONFIGS[provider];

  for (let attempt = 0; attempt < MAX_REFRESH_RETRIES; attempt++) {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.error === 'invalid_grant') {
          throw new Error('Token revoked or expired. Re-authentication required.');
        }
        throw new Error(`Refresh failed: ${error.error_description || error.error}`);
      }

      return response.json();
    } catch (error) {
      if (attempt === MAX_REFRESH_RETRIES - 1) throw error;
      await sleep(Math.pow(2, attempt) * 1000);  // Exponential backoff
    }
  }
  throw new Error('Max refresh retries exceeded');
}

function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - ACCESS_TOKEN_BUFFER_MS;
}
```

### Pattern 5: Email Masking for MCP Responses

**What:** Mask email addresses in MCP tool responses to protect privacy.

**When to use:** All MCP tool outputs that include user email (status, success messages).

**Example:**
```typescript
// Source: CONTEXT.md privacy decisions
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const [domainName, tld] = domain.split('.');

  const maskedLocal = local.slice(0, 2) + '***';
  const maskedDomain = domainName.slice(0, 2) + '***';

  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

// Example: "john.doe@gmail.com" -> "jo***@gm***.com"
```

### Anti-Patterns to Avoid

- **Token passthrough:** Never pass MCP-received tokens to downstream APIs. Use separately stored tokens from OAuth flow.
- **Storing tokens in localStorage/memory only:** Tokens must persist across MCP server restarts.
- **console.log() during auth:** Corrupts MCP stdio transport. Use console.error() for all auth logging.
- **Blocking auth at startup:** Server must start immediately. Check auth lazily on first tool call.
- **Exposing full email in MCP responses:** MCP output visible to Claude, mask PII.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PKCE generation | Manual crypto | pkce-challenge | Edge cases with base64url encoding, tested implementation |
| Config paths | Hardcoded ~/.config | env-paths | Cross-platform (Linux, macOS, Windows), XDG compliant |
| Token file schema | Manual validation | Zod schema | Type inference, error messages, handles corrupt files |
| OAuth state | Sequential counters | crypto.randomBytes | Must be cryptographically secure |
| Token expiry calculation | Manual Date math | Store absolute timestamp | Avoid clock drift issues |

**Key insight:** OAuth has many edge cases (revoked tokens, expired refresh tokens, state mismatch attacks). Use proven patterns from Gemini CLI and OpenCode.

## Common Pitfalls

### Pitfall 1: Using Standard Device Code Polling

**What goes wrong:** Implementing RFC 8628 device code polling (poll `/token` until authorized) instead of Gemini CLI's manual code entry pattern.

**Why it happens:** "Device code flow" can mean two things:
1. RFC 8628: Poll `/token` endpoint until user authorizes on browser
2. Gemini CLI: User manually enters code from redirect page

**How to avoid:** Use Gemini CLI pattern - generate auth URL with PKCE, user visits URL, copies code from codeassist.google.com/authcode, enters in MCP tool.

**Warning signs:** Building polling loop, handling `authorization_pending` errors.

### Pitfall 2: Not Requesting Refresh Token

**What goes wrong:** Tokens expire after 1 hour, user must re-authenticate constantly.

**Why it happens:** Missing `access_type: 'offline'` or `prompt: 'consent'` in auth URL.

**How to avoid:** Always include both parameters:
```typescript
params.set('access_type', 'offline');  // Request refresh token
params.set('prompt', 'consent');        // Force consent screen = new refresh token
```

**Warning signs:** No `refresh_token` in token response, tokens expire without refresh capability.

### Pitfall 3: Insecure Token File Permissions

**What goes wrong:** Other users/processes can read authentication tokens.

**Why it happens:** Default file permissions (0o644) are world-readable.

**How to avoid:**
```typescript
// Directory: 0o700 (owner only)
await fs.mkdir(tokenDir, { mode: 0o700, recursive: true });
// File: 0o600 (owner read/write only)
await fs.writeFile(tokenFile, content, { mode: 0o600 });
```

**Warning signs:** `ls -la` shows permissions like `-rw-r--r--` instead of `-rw-------`.

### Pitfall 4: Race Conditions in Token Refresh

**What goes wrong:** Multiple concurrent requests trigger multiple refresh attempts, one gets "invalid_grant".

**Why it happens:** No mutex/lock on refresh operation.

**How to avoid:** Use a refresh promise cache:
```typescript
let refreshPromise: Promise<TokenResponse> | null = null;

async function getValidToken(provider: string): Promise<string> {
  const tokens = await loadTokens();
  if (!isTokenExpired(tokens[provider].expires_at)) {
    return tokens[provider].access_token;
  }

  // Deduplicate concurrent refresh attempts
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(provider, tokens[provider].refresh_token)
      .finally(() => { refreshPromise = null; });
  }

  const newTokens = await refreshPromise;
  // ... save and return
}
```

**Warning signs:** Intermittent "invalid_grant" errors with concurrent requests.

### Pitfall 5: State Parameter Not Validated

**What goes wrong:** CSRF attacks can inject malicious authorization codes.

**Why it happens:** Forgetting to validate state matches or using predictable state values.

**How to avoid:**
```typescript
// Generate: crypto.randomBytes(32).toString('hex')
// Store in memory during auth flow
// Validate exact match when user enters code
if (userState !== expectedState) {
  throw new Error('State mismatch - possible CSRF attack');
}
```

**Warning signs:** Not storing state, not prompting user to verify state matches.

## Code Examples

### Provider Configuration

```typescript
// src/auth/providers.ts
// Source: Gemini CLI oauth2.js, OpenCode constants.js

export interface ProviderConfig {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  redirectUri: string;
  name: string;
}

export const PROVIDER_CONFIGS: Record<'gemini' | 'antigravity', ProviderConfig> = {
  gemini: {
    clientId: '681255809395-oo8ft2oprdrnp9e3aqf6av3hmdib135j.apps.googleusercontent.com',
    clientSecret: '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',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    redirectUri: 'https://codeassist.google.com/authcode',
    name: 'Gemini CLI',
  },
  antigravity: {
    clientId: '1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com',
    clientSecret: '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',
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs',
    ],
    redirectUri: 'https://codeassist.google.com/authcode',  // Same redirect for both
    name: 'Antigravity',
  },
};
```

### MCP Auth Tool Interface

```typescript
// src/tools/auth.ts
// Source: CONTEXT.md auth tool design decisions

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerAuthTool(server: McpServer): void {
  server.registerTool(
    'auth',
    {
      title: 'Authentication',
      description: 'Manage authentication for Google Search grounding',
      inputSchema: {
        login: z.enum(['gemini', 'antigravity']).optional()
          .describe('Provider to authenticate with. Omit to show provider selection.'),
        status: z.boolean().optional()
          .describe('Show authentication status for all providers'),
        logout: z.enum(['gemini', 'antigravity', 'both']).optional()
          .describe('Provider to log out. Omit to show provider selection.'),
        default_provider: z.enum(['gemini', 'antigravity']).optional()
          .describe('Set the default provider for searches'),
      },
    },
    async (args) => {
      // Determine which action based on flags
      if (args.status) {
        return handleStatus();
      }
      if (args.logout !== undefined) {
        return handleLogout(args.logout);
      }
      if (args.default_provider !== undefined) {
        return handleSetDefault(args.default_provider);
      }
      if (args.login !== undefined) {
        return handleLogin(args.login);
      }
      // No flags = show help
      return showHelp();
    },
  );
}
```

### Fetch User Info After Auth

```typescript
// src/auth/device-flow.ts
// Source: Google OAuth2 userinfo endpoint

interface UserInfo {
  email: string;
  name?: string;
  picture?: string;
}

async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user info');
  }

  return response.json();
}
```

### Complete Login Flow Message

```typescript
// MCP tool response during login flow
function formatLoginPrompt(authUrl: string, provider: string): string {
  return `## Authentication Required

To authenticate with ${provider}, please:

1. Open this URL in your browser:
   ${authUrl}

2. Sign in with your Google account and authorize the application

3. Copy the authorization code shown on the page

4. Reply with the authorization code

**Note:** The authorization code will look like a long string of characters.
This process will time out in 5 minutes.`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loopback server for OAuth | Device code / manual entry | MCP adoption | MCP servers use stdio, cannot spawn HTTP servers |
| Store tokens in memory | File-based persistence | Always for CLI tools | Tokens survive process restarts |
| Platform-specific paths | env-paths package | 2020s | Cross-platform XDG compliance |
| Manual PKCE | pkce-challenge package | 2020s | Reliable base64url encoding |

**Deprecated/outdated:**
- **Loopback OAuth in MCP:** MCP servers communicate via stdio, cannot spawn HTTP servers for OAuth callbacks
- **Token passthrough:** Explicitly forbidden by MCP security spec - use separately obtained tokens

## Open Questions

1. **Antigravity project ID resolution**
   - What we know: OpenCode fetches project ID from `/v1internal:loadCodeAssist` endpoint
   - What's unclear: Is this needed for Gemini CLI credentials? Phase 1 research suggests same endpoint
   - Recommendation: Implement fetchProjectID() for Antigravity, test if Gemini CLI needs it

2. **Token file encryption**
   - What we know: File permissions (0o600) protect from other users
   - What's unclear: Whether to add encryption layer for sensitive tokens
   - Recommendation: Use secure file permissions for v1, consider encryption in v2 if requested

3. **Concurrent auth flows**
   - What we know: MCP tool could be called multiple times during auth
   - What's unclear: How to handle user starting auth, then starting again before completing
   - Recommendation: Track active auth flow in memory, reject concurrent attempts with helpful message

## Sources

### Primary (HIGH confidence)
- Gemini CLI source code: `~/.nvm/versions/node/v20.20.0/lib/node_modules/@google/gemini-cli/node_modules/@google/gemini-cli-core/dist/src/code_assist/oauth2.js` - OAuth flow implementation
- OpenCode antigravity-auth: `~/.cache/opencode/node_modules/opencode-antigravity-auth/dist/src/` - Token refresh, PKCE patterns
- [Google OAuth 2.0 Device Flow](https://developers.google.com/identity/protocols/oauth2/limited-input-device) - Official endpoint documentation
- Phase 1 Research: `/home/skello/projects/gemini-search-mcp/.planning/phases/01-research/01-RESEARCH.md` - OAuth credentials, scopes, endpoint analysis

### Secondary (MEDIUM confidence)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices) - Token passthrough prohibition, OAuth guidance
- [pkce-challenge GitHub](https://github.com/crouchcd/pkce-challenge) - PKCE generation API
- [env-paths GitHub](https://github.com/sindresorhus/env-paths) - Cross-platform config paths API

### Tertiary (LOW confidence)
- WebSearch results on Node.js token storage best practices - General guidance, needs verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Based on Gemini CLI source code, official Google docs
- Architecture patterns: HIGH - Adapted from working implementations (Gemini CLI, OpenCode)
- Don't hand-roll: HIGH - Libraries verified via official GitHub repos
- Pitfalls: HIGH - Observed in real implementations and documented in MCP security spec

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - OAuth endpoints stable, credentials may change)

---
*Phase: 03-authentication*
*Research completed: 2026-02-03*
