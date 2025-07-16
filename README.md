# bibcli

Bibliography management CLI tool with citation gap analysis and comprehensive reference exploration.

## Features

- **Citation Analysis**: Find used/unused citations in your LaTeX documents
- **Gap Detection**: Identify frequently cited papers missing from your bibliography
- **Reference Exploration**: Browse all references from your cited papers with advanced filtering
- **Semantic Scholar Integration**: Leverage academic database for citation analysis
- **Flexible Export**: Generate BibTeX files for seamless bibliography management
- **Smart Caching**: Local caching with 7-day expiration to minimize API calls

## Installation

```bash
cd bibcli
npm install
chmod +x bin/bibcli
```

## Quick Start

```bash
# Get citation statistics
./bin/bibcli status

# Find citation gaps (papers cited by multiple sources but missing from your bib)
./bin/bibcli gaps

# Export gaps as BibTeX
./bin/bibcli gaps --export-bibtex > new_refs.bib

# Explore all references with filtering
./bin/bibcli refs --exclude-existing --min-citations 50 --export > high_impact.bib
```

## Commands

### `status`
Show citation statistics for your bibliography.

```bash
./bin/bibcli status
```

### `used` / `unused`
List citations that are used or unused in your LaTeX document.

```bash
# List unused citations
./bin/bibcli unused

# Search unused citations
./bin/bibcli unused --search "quantum"

# Show only citation keys
./bin/bibcli unused --keys-only

# Verbose output with details
./bin/bibcli unused --verbose
```

### `gaps`
Identify citation gaps by analyzing references of your cited papers.

**Gap Criteria**: Papers cited by ≥2 of your sources but not in your bibliography.

```bash
# Find citation gaps
./bin/bibcli gaps

# Adjust minimum citation threshold
./bin/bibcli gaps --min-citations 3

# Export as BibTeX
./bin/bibcli gaps --export-bibtex

# Limit results
./bin/bibcli gaps --max-results 10
```

### `refs`
Comprehensive reference analysis with advanced filtering and sorting.

```bash
# Show all references from cited papers
./bin/bibcli refs

# Exclude papers already in bibliography (gap-like behavior)
./bin/bibcli refs --exclude-existing

# Filter by citation count
./bin/bibcli refs --min-citations 100

# Filter by year
./bin/bibcli refs --filter-year 2020

# Filter by title content
./bin/bibcli refs --filter-title "quantum measurement"

# Filter by author
./bin/bibcli refs --filter-author "Nielsen"

# Sort by different criteria
./bin/bibcli refs --sort year --order desc
./bin/bibcli refs --sort authors --order asc

# Export filtered results
./bin/bibcli refs --min-citations 50 --filter-year 2015 --export > modern_refs.bib
```

**Sorting Options**: `citations` (default), `year`, `title`, `authors`
**Sort Order**: `desc` (default), `asc`

### `validate`
Check which bibliography entries can be found in Semantic Scholar.

```bash
# Validate all bibliography entries
./bin/bibcli validate

# Validate only used citations
./bin/bibcli validate --used-only

# Show successfully found papers too
./bin/bibcli validate --show-found

# Test with limited entries
./bin/bibcli validate --max-test 5
```

### `cache`
Manage local API cache.

```bash
# Show cache statistics
./bin/bibcli cache

# Clean up expired entries
./bin/bibcli cache --cleanup

# Clear all cache
./bin/bibcli cache --clear
```

## Global Options

- `-b, --bib <file>` - Path to .bib file (default: refs.bib)
- `-t, --tex <file>` - Path to .tex file (default: main.tex)
- `--api-key <key>` - Semantic Scholar API key for authenticated requests

## API Key Setup

For better rate limits and reliability, set up a Semantic Scholar API key:

1. Get an API key from [Semantic Scholar](https://www.semanticscholar.org/product/api)
2. Set it via environment variable:
   ```bash
   export SEMANTIC_SCHOLAR_API_KEY="your_key_here"
   ```
3. Or create a `.env` file:
   ```
   SEMANTIC_SCHOLAR_API_KEY=your_key_here
   ```
4. Or pass it directly:
   ```bash
   ./bin/bibcli gaps --api-key your_key_here
   ```

## Examples

### Find Citation Gaps
```bash
# Basic gap analysis
./bin/bibcli gaps

# High-impact gaps only
./bin/bibcli gaps --min-citations 3

# Export gaps for manual review
./bin/bibcli gaps --export-bibtex > potential_refs.bib
```

### Build Custom Bibliography
```bash
# Recent high-impact papers not in bibliography
./bin/bibcli refs --exclude-existing --min-citations 100 --filter-year 2020 --export > recent_high_impact.bib

# Papers by specific author
./bin/bibcli refs --filter-author "Preskill" --export > preskill_refs.bib

# Quantum measurement papers
./bin/bibcli refs --filter-title "quantum measurement" --min-citations 50 --export > qm_refs.bib
```

### Validate Bibliography
```bash
# Check which papers can contribute to gap analysis
./bin/bibcli validate

# Focus on used citations only
./bin/bibcli validate --used-only
```

## Cache Indicators

Commands show cache status to help understand performance:
- `✓ Found (cached)` - Result from local cache
- `✓ Found` - Fresh API request
- `- No references found (cached)` - Cached negative result

## Troubleshooting

### Rate Limiting
- Use API key for better rate limits (1 req/sec vs shared public limits)
- Commands automatically implement exponential backoff
- Results are cached locally to minimize repeat requests

### Missing Papers
- Some papers (especially books) may not be in Semantic Scholar
- Use `bibcli validate` to check which papers can be analyzed
- Consider adding DOIs to .bib entries for better matching

### Performance
- Use `--limit-papers <N>` for testing with large bibliographies
- Cache persists between runs (7-day expiration)
- API requests run at ~1 per second with exponential backoff

## File Support

- **LaTeX**: Finds `\cite{key}`, `\citep{key}`, `\citet{key}`, etc.
- **BibTeX**: Parses all standard entry types with proper brace handling
- **Auto-discovery**: Automatically finds `refs.bib` and `main.tex` in current/parent directories