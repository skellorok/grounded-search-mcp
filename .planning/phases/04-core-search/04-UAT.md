---
status: diagnosed
phase: 04-core-search
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md]
started: 2026-02-03T23:00:00Z
updated: 2026-02-03T23:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Grounded Search Returns Results
expected: Calling `grounded_search` with a query returns a response with actual search results (not a mock). Response includes a text answer grounded in real web sources.
result: issue
reported: "API returns 400 Invalid JSON: Unknown name systemInstruction, contents, tools, generationConfig"
severity: blocker

### 2. Source Citations Included
expected: Search results include a "Sources" section with clickable URLs and page titles from the web sources used to generate the answer.
result: skipped
reason: Blocked by Test 1 - API request format error

### 3. Search Queries Transparency
expected: Search results include a "Search Queries Used" section showing what queries Google actually executed (transparency into the grounding process).
result: skipped
reason: Blocked by Test 1 - API request format error

### 4. Provider Fallback Works
expected: If default provider fails (e.g., not authenticated), the search falls back to the other authenticated provider and still returns results.
result: skipped
reason: Blocked by Test 1 - API request format error

### 5. Error Messages Are Actionable
expected: When search fails (e.g., no auth, rate limit), error message is clear markdown with troubleshooting steps (not cryptic errors).
result: skipped
reason: Blocked by Test 1 - API request format error

## Summary

total: 5
passed: 0
issues: 1
pending: 0
skipped: 4

## Gaps

- truth: "grounded_search returns real Gemini API results with web grounding"
  status: failed
  reason: "API returns 400 Invalid JSON: Unknown name systemInstruction, contents, tools, generationConfig - raw payload not accepted"
  severity: blocker
  test: 1
  root_cause: "Gemini CLI requests need wrapped format like Antigravity, not raw payload. Code at src/api/request.ts lines 157-159 returns unwrapped payload for Gemini CLI provider, but cloudcode-pa.googleapis.com API requires wrapped format: {project, model, userAgent, requestId, request: {...}}"
  artifacts:
    - path: "src/api/request.ts"
      issue: "wrapProviderRequest() returns raw payload for Gemini CLI instead of wrapped format"
    - path: "custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md"
      issue: "Lines 346-363 show ALL requests need wrapped format"
  missing:
    - "Update wrapProviderRequest() to wrap Gemini CLI requests same as Antigravity"
    - "May need project ID for Gemini CLI (try without first, or call loadCodeAssist)"
  debug_session: ""
