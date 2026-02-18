---
name: grounded-search:query
description: Perform a grounded search and save results to a file
---

# Grounded Search Query

Perform a Google-grounded search and save the results to a markdown file for later reference.

## Usage

```
/grounded-search:query "your search terms here"
```

## Behavior

1. **Validate input**: Query argument is REQUIRED. If missing, respond:
   > Error: Query argument required. Usage: `/grounded-search:query "your search terms"`

2. **Execute search**: Call `mcp__grounded-search__grounded_search` tool with the query.

3. **Generate filename**:
   - Directory: `./grounded-search-results/`
   - Format: `YYYY-MM-DD-HH-MM-{slug}.md`
   - Slug generation: Take first 30 chars of query, lowercase, replace non-alphanumeric with hyphens, trim trailing hyphens
   - Example: "TypeScript 5.8 new features" → `typescript-5-8-new-features`

4. **Create directory**: Create `./grounded-search-results/` if it doesn't exist.

5. **Write file**: Save the full search response (answer + sources + search queries + metadata) to the generated filename.

6. **Report success**: Show:
   - The filename created
   - Brief summary (first 100 chars of answer)
   - Number of sources found

## Example

Input:
```
/grounded-search:query "TypeScript 5.8 features"
```

Output:
```
Saved search results to: ./grounded-search-results/2026-02-05-14-30-typescript-5-8-features.md

Summary: TypeScript 5.8 introduces several new features including...
Sources: 5 citations saved
```

## Notes

- Results are saved with full formatting matching the tool output
- Files are timestamped to avoid conflicts
- Directory is created automatically on first use
