# WebSearch vs grounded_search Comparison

A detailed comparison between Claude's built-in WebSearch tool and this MCP server's grounded_search tool.

## Overview

Both tools enable Claude to search the web, but they use different search providers and approaches:

- **WebSearch** uses Brave Search through Anthropic's infrastructure
- **grounded_search** uses Google Search through Gemini's grounding API

This document helps you decide which tool fits your use case.

## Technical Differences

| Aspect | Claude WebSearch | grounded_search |
|--------|-----------------|-----------------|
| Search Provider | Brave Search | Google Search |
| Cost Model | $10 per 1000 searches + tokens | Uses your Gemini API quota |
| Citation Format | Built-in `cited_text` blocks | Markdown with source URLs |
| Query Visibility | Hidden (Claude generates internally) | Shown in response |
| Rate Limits | Anthropic's rate limits | Google/Gemini rate limits |
| Authentication | Automatic (Anthropic handles) | User OAuth required |
| Index Coverage | Brave's independent index | Google's comprehensive index |

## Search Quality

### Google vs Brave Index

**Google's advantages:**
- Largest web index in existence
- More comprehensive coverage of recent content
- Better for academic, technical, and niche topics
- Stronger understanding of search intent

**Brave's advantages:**
- Independent index (not Google-dependent)
- May surface different perspectives
- Growing but still smaller index

### Search Result Synthesis

**WebSearch:**
1. Claude generates a search query based on your request
2. Brave executes the search
3. Claude receives raw results and synthesizes them
4. You get Claude's synthesis with `cited_text` citations

**grounded_search:**
1. Gemini generates search queries (may expand into multiple queries)
2. Google executes the searches
3. Gemini synthesizes results with grounding metadata
4. Claude receives pre-formatted summary
5. You see the actual queries Gemini used

The key difference: with grounded_search, you see exactly what searches were run.

## Token Usage Comparison

### WebSearch Token Flow

```
Your query (input tokens)
    ↓
Brave search results (input tokens - can be large)
    ↓
Claude synthesis (output tokens)
```

With WebSearch, Claude receives raw search results which can be token-heavy, especially for queries that return long articles or multiple detailed results.

### grounded_search Token Flow

```
Your query (MCP call)
    ↓
Gemini handles search + synthesis (uses Gemini quota)
    ↓
Pre-summarized markdown (input tokens - typically smaller)
    ↓
Claude uses the summary (minimal additional output)
```

With grounded_search, Gemini does the heavy lifting. Claude receives a pre-formatted summary, potentially reducing your Claude token usage for complex research queries.

## Cost Analysis

### WebSearch Pricing

- **Per-search cost:** ~$0.01 per search ($10 per 1000)
- **Token costs:** Standard Claude input/output rates
- **Best for:** Low-volume, occasional searches

### grounded_search Pricing

- **Per-search cost:** $0 (uses your Google One AI Pro quota)
- **Quota requirement:** Google One AI Pro subscription (~$20/month)
- **Best for:** High-volume research, extensive searching

**Break-even analysis:**
If you run more than ~2000 searches per month, grounded_search becomes more cost-effective (assuming you already have Google One AI Pro for other reasons).

## Query Transparency

One of grounded_search's unique features is showing the actual search queries:

```markdown
## Search Queries Used

1. "TypeScript 5.8 new features"
2. "TypeScript 5.8 release notes"
3. "TypeScript 2024 improvements"
```

This transparency helps you:
- Understand how your request was interpreted
- Identify if queries need refinement
- Learn better search strategies
- Debug unexpected results

WebSearch does not expose the queries Claude generates internally.

## Source Citation Comparison

### WebSearch Citations

```markdown
The answer is X [cited_text: "exact quote from source" source: example.com]
```

Citations are inline with exact quotes and source attribution.

### grounded_search Citations

```markdown
## Sources

1. **[Page Title]** - example.com
   https://example.com/full/path

2. **[Another Title]** - docs.example.org
   https://docs.example.org/article
```

Sources are collected at the end with titles, domains, and full URLs. Sources are deduplicated automatically.

## When to Use Which

### Use grounded_search when:

- You want Google Search quality and comprehensiveness
- You're doing extensive research (many searches)
- You want to see what queries are being run
- You have Google One AI Pro subscription
- You want to potentially reduce Claude token usage
- You're researching technical topics where Google excels

### Use WebSearch when:

- You need quick, occasional searches
- You prefer built-in citation format
- You don't have Google credentials configured
- You want zero setup (works out of the box)
- You're in an environment where MCP servers aren't available

### Use both when:

- You want the best results - run both and compare
- Different queries might benefit from different search engines
- You want redundancy if one service is rate-limited

## Limitations

### grounded_search Limitations

- **Setup required:** OAuth authentication needed
- **Dependency:** Relies on Gemini API availability
- **Two-model approach:** Query goes through Gemini before Claude
- **Quota sharing:** Uses same quota as other Gemini API usage

### WebSearch Limitations

- **Smaller index:** Brave's index is less comprehensive than Google's
- **Hidden queries:** No visibility into what searches Claude runs
- **Per-search cost:** Can add up with heavy usage
- **Rate limits:** Subject to Anthropic's rate limiting

## Performance Considerations

### Response Time

- **WebSearch:** Generally faster (single round-trip to Brave)
- **grounded_search:** May be slower (Gemini processing + Google search)

Actual performance depends on query complexity and current API load.

### Reliability

Both tools have their own failure modes:
- WebSearch: Anthropic rate limits, Brave API issues
- grounded_search: Gemini rate limits, Google Search restrictions, OAuth token expiry

grounded_search includes automatic provider fallback (Antigravity ↔ Gemini CLI) for improved reliability.

## Summary

| Factor | Winner |
|--------|--------|
| Search quality | grounded_search (Google index) |
| Setup simplicity | WebSearch (zero config) |
| Cost at scale | grounded_search (quota-based) |
| Query transparency | grounded_search (shows queries) |
| Citation format | Preference-dependent |
| Response speed | WebSearch (typically) |
| Reliability | Both have tradeoffs |

**Recommendation:** If you're doing significant research and have Google One AI Pro, grounded_search offers better search quality and cost efficiency. For occasional, simple queries, WebSearch's zero-configuration approach may be more convenient.
