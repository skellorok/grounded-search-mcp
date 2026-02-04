# Phase 5: Configuration - Research

**Researched:** 2026-02-04
**Domain:** Configuration persistence, user preferences, response metadata
**Confidence:** HIGH

## Summary

Phase 5 adds user configuration persistence and response transparency to the existing working search system. The codebase already has established patterns for:
- XDG-compliant file storage via `env-paths` (used in `token-storage.ts`)
- Zod schema validation (used in `auth/types.ts`)
- Atomic writes with temp file + rename (used in `saveTokens()`)
- MCP tool registration with flag-based interfaces (used in `auth.ts`)

The phase involves creating a new `config/` module parallel to `auth/`, a new `config` tool parallel to the `auth` tool, and modifying `response.ts` to include request metadata.

**Primary recommendation:** Reuse existing patterns from `auth/token-storage.ts` and `auth/types.ts` for config storage and validation. Create `config.ts` tool following the flag-based pattern established in `auth.ts`.

## Standard Stack

The standard stack is already established in this project - no new libraries needed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| env-paths | ^4.0.0 | XDG-compliant paths | Already used in token-storage.ts |
| zod | ^3.25.30 | Schema validation | Already used for TokenFileSchema |
| fs/promises | Node built-in | File I/O | Already used in token-storage.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | ^1.25.3 | Tool registration | Already configured |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| env-paths | xdg-basedir | env-paths is cross-platform, already installed |
| JSON config | TOML/YAML | JSON simpler, human-editable, no new deps |
| Custom validation | convict/joi | Zod already in use, sufficient for needs |

**Installation:**
```bash
# No new dependencies needed - all libraries already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── config/                    # NEW: Config module (parallel to auth/)
│   ├── types.ts              # ConfigFile interface, Zod schema
│   ├── storage.ts            # Load/save functions (mirror token-storage.ts)
│   ├── defaults.ts           # Default values, validation constants
│   └── index.ts              # Public exports
├── tools/
│   ├── config.ts             # NEW: Config tool (parallel to auth.ts)
│   └── index.ts              # Add registerConfigTool
└── api/
    └── response.ts           # MODIFY: Add metadata formatting
```

### Pattern 1: Config Schema with Defaults (Zod)
**What:** Define config schema with defaults and fallback behavior
**When to use:** Config file validation
**Example:**
```typescript
// Source: Verified Zod pattern from Context7
import { z } from 'zod';

export const ConfigFileSchema = z.object({
  version: z.number().default(1),
  defaultProvider: z.enum(['antigravity', 'gemini']).default('antigravity'),
  defaultThinking: z.enum(['high', 'low', 'none']).default('high'),
  includeThoughts: z.boolean().default(false),
  timeout: z.number().min(1000).max(300000).default(60000),
  verbose: z.boolean().default(false),
});

export type ConfigFile = z.infer<typeof ConfigFileSchema>;

// Generate defaults without parsing input
export const DEFAULT_CONFIG: ConfigFile = ConfigFileSchema.parse({});
```

### Pattern 2: Safe Parse with Fallback (from auth/types.ts pattern)
**What:** Use safeParse to validate without throwing, fallback to defaults
**When to use:** Loading potentially invalid config files
**Example:**
```typescript
// Source: Existing pattern in token-storage.ts + Zod safeParse from Context7
export async function loadConfig(): Promise<ConfigFile> {
  const configPath = getConfigFilePath();

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = ConfigFileSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    // Invalid config: warn and fallback
    console.error('Config file invalid, using defaults:', result.error.message);
    return DEFAULT_CONFIG;
  } catch (error) {
    // File doesn't exist - normal for first run
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_CONFIG;
    }
    // Parse error - warn and fallback
    console.error('Config file parse error, using defaults:', error);
    return DEFAULT_CONFIG;
  }
}
```

### Pattern 3: Atomic Write (from token-storage.ts)
**What:** Write to temp file, then rename for atomicity
**When to use:** Saving config to prevent corruption on crash
**Example:**
```typescript
// Source: Existing pattern in token-storage.ts
export async function saveConfig(config: ConfigFile): Promise<void> {
  const configPath = getConfigFilePath();
  const configDir = dirname(configPath);
  const tempPath = `${configPath}.tmp`;

  await mkdir(configDir, { recursive: true, mode: 0o700 });

  // Pretty print for human editability (CONTEXT.md decision)
  const content = JSON.stringify(config, null, 2);
  await writeFile(tempPath, content, { mode: 0o600 });
  await rename(tempPath, configPath);
}
```

### Pattern 4: Flag-based Tool Interface (from auth.ts)
**What:** Tool with mutually exclusive flag parameters
**When to use:** Config tool CLI-like interface
**Example:**
```typescript
// Source: Existing pattern in tools/auth.ts
server.tool(
  'config',
  'Manage search configuration preferences',
  {
    set: z.string().optional().describe('Set config value: key=value'),
    get: z.string().optional().describe('Get config value by key'),
    reset: z.union([z.boolean(), z.string()]).optional()
      .describe('Reset all config (true) or specific key (string)'),
    show: z.boolean().optional().describe('Show all current settings'),
  },
  async (params) => { /* ... */ }
);
```

### Anti-Patterns to Avoid
- **Direct JSON.parse without validation:** Always use Zod safeParse for user-editable files
- **Throwing on invalid config:** Warn + fallback to defaults (don't break search)
- **Mixing config with tokens:** Separate files (security, different update frequency)
- **Non-atomic writes:** Always temp file + rename to prevent corruption
- **Modifying existing types:** Create new types in config/types.ts, don't modify auth/types.ts

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XDG paths | Custom path logic | env-paths (already used) | Cross-platform edge cases |
| Schema validation | Manual checks | Zod safeParse | Type inference, clear errors |
| Defaults merging | Object.assign | Zod .default() | Nested defaults, type safety |
| Atomic writes | Direct writeFile | temp file + rename | Already pattern in token-storage |

**Key insight:** All needed patterns exist in this codebase. Mirror them rather than inventing new approaches.

## Common Pitfalls

### Pitfall 1: Config-Token Coupling
**What goes wrong:** Modifying token file to include config, or sharing storage functions
**Why it happens:** Seems simpler than separate files
**How to avoid:** Separate `config.json` from `tokens.json` (per CONTEXT.md decision)
**Warning signs:** Wanting to add fields to TokenFileSchema

### Pitfall 2: Throwing on Invalid Config
**What goes wrong:** Search fails completely when config file is manually corrupted
**Why it happens:** Using .parse() instead of .safeParse()
**How to avoid:** Always safeParse, warn to stderr, return defaults
**Warning signs:** try/catch around parse that rethrows

### Pitfall 3: Forgetting Schema Version
**What goes wrong:** Future migrations break because no version field
**Why it happens:** Seems unnecessary for v1
**How to avoid:** Include `version: 1` from the start (per CONTEXT.md)
**Warning signs:** ConfigFileSchema without version field

### Pitfall 4: Response Metadata Breaking Parsing
**What goes wrong:** Adding metadata changes response format in breaking way
**Why it happens:** Not thinking about how consumers parse responses
**How to avoid:** Add new sections after existing content (Sources, then Request Details)
**Warning signs:** Moving or renaming existing sections

### Pitfall 5: Multiple --set in Single Call
**What goes wrong:** Only processing first --set flag
**Why it happens:** Schema accepts single string instead of array
**How to avoid:** Accept string array for set parameter OR document single key=value per call
**Warning signs:** User can only set one value at a time

## Code Examples

Verified patterns from project codebase and official documentation:

### Config File Path (mirror token-storage.ts)
```typescript
// Source: Existing pattern in src/auth/token-storage.ts
import { join } from 'node:path';
import envPaths from 'env-paths';

const paths = envPaths('google-search-mcp', { suffix: '' });

export function getConfigFilePath(): string {
  return join(paths.config, 'config.json');
}
```

### Config Schema with Validation Messages
```typescript
// Source: Zod Context7 documentation
import { z } from 'zod';

export const ConfigFileSchema = z.object({
  version: z.number().int().positive().default(1),
  defaultProvider: z.enum(['antigravity', 'gemini'], {
    errorMap: () => ({ message: "Must be 'antigravity' or 'gemini'" }),
  }).default('antigravity'),
  defaultThinking: z.enum(['high', 'low', 'none'], {
    errorMap: () => ({ message: "Must be 'high', 'low', or 'none'" }),
  }).default('high'),
  includeThoughts: z.boolean().default(false),
  timeout: z.number().int().min(1000).max(300000).default(60000),
  verbose: z.boolean().default(false),
});
```

### Response Metadata Section (extend response.ts)
```typescript
// Source: CONTEXT.md decision - after Sources, before Search Queries Used
// Add to formatSearchResult in src/api/response.ts

interface RequestMetadata {
  provider: ProviderName;
  model: string;
  responseTime?: number; // Only when verbose=true
  fallbackUsed?: boolean;
  thinkingLevel?: string;
  thinkingSupported?: boolean;
}

function formatRequestDetails(metadata: RequestMetadata): string {
  const lines: string[] = ['### Request Details', ''];
  lines.push(`- **Provider:** ${metadata.provider === 'antigravity' ? 'Antigravity' : 'Gemini CLI'}`);
  lines.push(`- **Model:** ${metadata.model}`);

  if (metadata.fallbackUsed) {
    lines.push('- **Note:** Fallback provider used');
  }
  if (metadata.responseTime !== undefined) {
    lines.push(`- **Response time:** ${metadata.responseTime}ms`);
  }

  return lines.join('\n');
}
```

### Schema Migration Pattern
```typescript
// Source: Best practice for config evolution
export async function migrateConfigIfNeeded(configPath: string): Promise<void> {
  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Check version and migrate
    if (!parsed.version || parsed.version < CURRENT_CONFIG_VERSION) {
      // Backup before migration
      const backupPath = `${configPath}.bak`;
      await copyFile(configPath, backupPath);

      // Apply migrations
      const migrated = applyMigrations(parsed);
      await saveConfig(migrated);
    }
  } catch {
    // No config or parse error - will be created with defaults
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON.parse + manual validation | Zod schema with safeParse | 2023 | Type-safe, better errors |
| Direct file writes | Atomic temp + rename | Always | Prevents corruption |
| Platform-specific paths | env-paths library | 2020+ | Cross-platform |

**Deprecated/outdated:**
- xdg-basedir: Only for Linux, use env-paths for cross-platform
- Manual default merging: Zod .default() handles this

## Open Questions

None - all questions resolved by CONTEXT.md decisions:

1. **Config file atomicity** - Claude's discretion, recommend reusing token-storage pattern (atomic)
2. **Validation error messages** - Claude's discretion, Zod provides good defaults
3. **Response Details formatting** - CONTEXT.md specifies bullet list format

## Sources

### Primary (HIGH confidence)
- `/colinhacks/zod` via Context7 - safeParse, defaults, optional fields
- `/modelcontextprotocol/typescript-sdk` via Context7 - tool registration pattern
- Project source code - existing patterns in token-storage.ts, auth.ts, response.ts

### Secondary (MEDIUM confidence)
- [xdg-basedir GitHub](https://github.com/sindresorhus/xdg-basedir) - Confirms env-paths recommended for cross-platform
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices) - Config validation patterns

### Tertiary (LOW confidence)
- None - all findings verified with primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Already established in project, no new dependencies
- Architecture: HIGH - Mirrors existing patterns (auth/, token-storage.ts)
- Pitfalls: HIGH - Based on existing codebase patterns and Zod documentation

**Research date:** 2026-02-04
**Valid until:** 2026-03-04 (stable domain, patterns well-established)
