---
created: 2026-02-03T16:13
title: Add auth provider selection flag
area: config
files:
  - .planning/phases/01-research/01-01-PLAN.md
---

## Problem

User may have both Gemini CLI and Antigravity authentication configured. Currently no mechanism to:
1. Detect which auth providers are available
2. Let user choose preferred provider
3. Handle the case where both are configured

Research phase confirmed both approaches use identical grounding architecture (dedicated API call with only `googleSearch: {}` tool). The question is whether supporting both adds value or just complexity.

Key questions to resolve:
- Is there value in supporting both providers? (Different rate limits? Cost? Availability?)
- Should selection happen at config time (static) or per-request (dynamic)?
- What are the tradeoffs between Gemini CLI auth vs Antigravity auth?

## Solution

TBD - needs design decision during Phase 3 (Authentication) or Phase 5 (Configuration).

Options to consider:
1. **Single provider** - Pick one, simplify
2. **Config-time selection** - User sets preferred provider in MCP config
3. **Runtime flag** - Tool parameter `provider: "gemini" | "antigravity"`
4. **Auto-fallback** - Try primary, fall back to secondary if unavailable
