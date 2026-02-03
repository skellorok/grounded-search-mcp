# Feature Research: Google Grounded Search MCP Server

**Domain:** MCP Server for Search/Grounding Tools
**Researched:** 2026-02-03
**Confidence:** HIGH (verified against official MCP documentation, existing implementations, and API research)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single search tool** | Core purpose of the server | MEDIUM | Must expose `grounded_search` tool with clear schema |
| **Source citations with URLs** | 65.9% of users say citations boost trust; standard in search tools | LOW | Parse `groundingMetadata.groundingChunks` for URLs/titles |
| **Real-time results** | Primary differentiator vs LLM training data; users expect current info | LOW | API provides this natively via Google Search |
| **Clear error messages** | MCP best practice; LLMs need actionable errors to recover | LOW | Return errors in result object, not protocol level |
| **Authentication persistence** | Users expect to auth once, not every session | MEDIUM | Store tokens in `~/.config/` or similar, auto-refresh |
| **Input validation** | Security baseline; prevents injection and malformed requests | LOW | Use Zod schemas, validate query strings |
| **Query parameter** | Fundamental input; every search tool has this | LOW | Single required string parameter |

### Differentiators (Competitive Advantage)

Features that set this product apart from Claude Code's WebSearch and other MCP search tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Google Search infrastructure** | Better relevance than DuckDuckGo/Brave; Google's index is most comprehensive | LOW | Core value prop - uses actual Google Search |
| **Structured citation metadata** | Returns `groundingChunks` with indices mapping claims to sources; enables inline citations | LOW | API provides this natively; format for consumption |
| **Search queries transparency** | Shows what queries Google actually used (`webSearchQueries`); builds trust | LOW | Available in `groundingMetadata`; pass through to user |
| **Model selection parameter** | Users can choose gemini-3-flash (fast) vs gemini-3-pro (quality) | LOW | Simple parameter routing to different models |
| **Thinking level configuration** | Control reasoning depth (high/low/minimal); trade speed for quality | LOW | Maps to API's `thinkingConfig.thinkingLevel` |
| **URL context analysis** | Analyze specific URLs alongside search; useful for fact-checking | MEDIUM | Uses `urlContext` tool in API; separate from search |
| **Confidence scores** | API returns confidence scores for grounding supports (0-1) | LOW | Available in response; pass through |
| **Multiple auth methods** | Device code (CLI-friendly) AND loopback OAuth (desktop-friendly) | HIGH | Requires implementing both OAuth flows |
| **Grounding supports with indices** | Map exact text segments to source indices; enables precise attribution | LOW | Parse `groundingSupports.segment` with start/end indices |

### Anti-Features (Deliberately NOT Building)

Features that seem good but create problems. Explicitly scoped out.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Chat/conversation mode** | "Natural" interaction | MCP tools are single-shot by design; Claude handles conversation. Adding chat state complicates everything and duplicates Claude's job | Single-shot search tool; Claude maintains context |
| **Multi-account rotation** | Avoid rate limits | Complexity explosion; account management nightmare; violates ToS in most cases | Use sandbox endpoint (not rate-limited); defer to v2 if needed |
| **API wrapper one-on-one** | "More tools = more capable" | Anti-pattern: inflates tool count, drops task completion rate. One polymorphic tool is better | Single `grounded_search` tool with optional parameters |
| **Real-time streaming results** | "Progressive loading feels faster" | MCP tool results are atomic; streaming partial search results confuses LLMs. 300-800ms latency is acceptable for search | Return complete results; API call is fast enough |
| **Caching search results** | "Save API calls" | Search results are time-sensitive; caching defeats real-time value prop. LLM can cache if needed | No caching; always fresh results |
| **Kitchen sink server** | "One server for everything" | Security nightmare; bundling too many capabilities increases attack surface | Single-purpose: search only. Other tools = separate servers |
| **Claude models via Antigravity** | API supports them | Out of scope for MVP; focus on Google's search grounding (the differentiator) | Document possibility; defer to v2 |
| **Automatic GSD integration** | "Just work with GSD" | Modifying GSD agents is risky; MCP tools are standard interface | Document integration; let users configure |
| **Custom search result ranking** | "Personalize results" | Complexity for minimal value; Google's ranking is already optimized | Use Google's native ranking |

## Feature Dependencies

```
Authentication
    └──requires──> Token Storage
                       └──enables──> Token Refresh
                                         └──enables──> Persistent Sessions

grounded_search tool
    └──requires──> Authentication
    └──requires──> API Integration
    └──enables──> Source Citations
    └──enables──> Search Query Transparency

Model Selection
    └──requires──> grounded_search tool
    └──enhances──> grounded_search (optional parameter)

Thinking Level
    └──requires──> grounded_search tool
    └──enhances──> grounded_search (optional parameter)

URL Context Analysis
    └──requires──> Authentication
    └──requires──> API Integration
    └──conflicts with──> googleSearch in same request (API limitation)
    └──implementation note──> Must be separate API call or separate tool
```

### Dependency Notes

- **grounded_search requires Authentication:** Can't call API without valid OAuth token
- **Authentication requires Token Storage:** Tokens must persist across restarts
- **Token Refresh enables Persistent Sessions:** Without refresh, users re-auth constantly
- **URL Context conflicts with googleSearch:** API limitation - cannot mix grounding tools with function declarations in same request. Either separate tool or orchestrated separately.

## MVP Definition

### Launch With (v1)

Minimum viable product - what's needed to validate the concept works better than WebSearch.

- [x] **grounded_search tool** - Core value prop; single tool with query parameter
- [x] **Source citations** - URLs and titles from groundingChunks
- [x] **Search queries returned** - Transparency on what Google searched
- [x] **Authentication (one method)** - Either device code OR loopback, not both initially
- [x] **Token persistence** - Save to disk, refresh automatically
- [x] **Clear error handling** - Unauthenticated state, API errors as actionable messages
- [x] **Model selection parameter** - gemini-3-flash default, allow override

### Add After Validation (v1.x)

Features to add once core is working and validated.

- [ ] **Second auth method** - If started with device code, add loopback (or vice versa)
- [ ] **Thinking level parameter** - Let users trade speed for quality
- [ ] **Confidence scores in output** - Surface API's grounding confidence
- [ ] **URL context tool** - Separate tool for analyzing specific URLs

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multi-account support** - If rate limiting becomes issue (unlikely with sandbox)
- [ ] **Claude models via Antigravity** - Supported by API but not search-focused
- [ ] **Streaming results** - If latency becomes user complaint
- [ ] **Result filtering parameters** - Freshness, domain filters, etc.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| grounded_search tool | HIGH | MEDIUM | P1 |
| Source citations | HIGH | LOW | P1 |
| Search queries transparency | MEDIUM | LOW | P1 |
| Authentication (device code) | HIGH | MEDIUM | P1 |
| Token persistence | HIGH | LOW | P1 |
| Error handling | HIGH | LOW | P1 |
| Model selection | MEDIUM | LOW | P1 |
| Authentication (loopback) | MEDIUM | HIGH | P2 |
| Thinking level | LOW | LOW | P2 |
| Confidence scores | LOW | LOW | P2 |
| URL context tool | MEDIUM | MEDIUM | P2 |
| Re-auth command/prompt | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch - validates core value proposition
- P2: Should have, add when possible - enhances but not required
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Claude WebSearch | Brave MCP | Perplexity | Google Grounded (This) |
|---------|------------------|-----------|------------|------------------------|
| **Real-time search** | Yes | Yes | Yes | Yes |
| **Source citations** | Limited | Yes (via summary) | Yes (strong) | Yes (structured) |
| **Citation mapping** | No | No | Inline references | Segment-level indices |
| **Search infrastructure** | Unknown | Brave | Multiple | Google |
| **Model selection** | No | N/A | Yes | Yes |
| **Local/business search** | No | Yes | No | No |
| **Image search** | No | Yes | No | No |
| **News search** | No | Yes | No | Via grounding |
| **Latency** | Unknown | ~200ms | ~200ms | ~500ms |
| **Cost** | Included | API key (free tier) | Per-token | Google One ($20/mo) |

### Our Approach

Focus on **structured citation quality** and **Google's search relevance** as differentiators:

1. **Brave MCP** has more modalities (image, video, news, local) - we won't compete there
2. **Perplexity** has speed and citation density - we match on citations, accept latency tradeoff
3. **WebSearch** has convenience (built-in) - we offer better grounding and transparency
4. **Our edge**: Google's search index quality + segment-level citation mapping + free with existing Google One subscription

## Sources

### MCP Best Practices & Patterns
- [MCP Best Practices Guide](https://modelcontextprotocol.info/docs/best-practices/)
- [MCP Tools Documentation](https://modelcontextprotocol.info/docs/concepts/tools/)
- [15 Best Practices for Building MCP Servers](https://thenewstack.io/15-best-practices-for-building-mcp-servers-in-production/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Error Handling Best Practices](https://mcpcat.io/guides/error-handling-custom-mcp-servers/)

### Search MCP Implementations
- [Brave Search MCP Server](https://github.com/brave/brave-search-mcp-server)
- [Integrating MCP Servers for Web Search with Claude Code](https://intuitionlabs.ai/articles/mcp-servers-claude-code-internet-search)

### Google Grounding API
- [Grounding with Google Search](https://ai.google.dev/gemini-api/docs/google-search)
- [Google Cloud Grounding Documentation](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/grounding/grounding-with-google-search)

### User Expectations Research
- [AI Search Engines Report 2026](https://www.allaboutai.com/resources/ai-statistics/ai-search-engines/)
- [AI Citation Problem - Columbia Journalism Review](https://www.cjr.org/tow_center/we-compared-eight-ai-search-engines-theyre-all-bad-at-citing-news.php)

### Anti-Patterns & Security
- [MCP Patterns & Anti-Patterns](https://medium.com/@thirugnanamk/mcp-patterns-anti-patterns-for-implementing-enterprise-ai-d9c91c8afbb3)
- [MCP Security Best Practices](https://modelcontextprotocol.io/specification/draft/basic/security_best_practices)
- [MCP Implementation Failure Modes](https://natesnewsletter.substack.com/p/the-mcp-implementation-guide-solving)

### Prior Project Research
- `custom_research/2026-02-03-antigravity-api-mcp-integration-deep-dive.md` (API capabilities)
- `custom_research/2026-02-03-research-tools-handoff.md` (Authentication patterns)

---
*Feature research for: Google Grounded Search MCP Server*
*Researched: 2026-02-03*
