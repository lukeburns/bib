# bib

A bib file utility and citation gap analysis. Analyze your LaTeX bibliography, find missing references, and manage DOIs with ease.

## Installation

```bash
npm i -g bib-cli
```

## Quick Start

```bash
# Check with references you've used and haven't used yet
bib used
bib unused

# Find and add missing DOIs to your bib file
bib dois
bib dois --update

# Show citation statistics
bib status

# Find citation gaps (papers you should consider citing)
bib gaps

# Export gaps as BibTeX for easy addition to your bibliography
bib gaps -e -q > gaps.bib

# Explore all references from your cited papers
bib references -n 20
```

## Commands

### `bib status`
Show citation statistics and gap analysis summary.

```bash
bib status                    # Quick overview
bib status --fresh            # Force fresh API lookups
bib status --basic            # Basic stats only (no API calls)
```

### `bib gaps`
Find citation gaps by analyzing references of your cited papers.

```bash
bib gaps                      # Show potential gaps
bib gaps -e                   # Export as BibTeX
bib gaps -e -q > gaps.bib     # Export BibTeX to file
bib gaps -m 5 -n 10           # Min 5 citations, show 10 results
```

**Options:**
- `-e, --export` - Export as BibTeX entries
- `-n, --number <N>` - Maximum results to show (default: 20)
- `-m, --min-citations <N>` - Minimum citations to show (default: 2)
- `-q, --quiet` - Suppress progress output (useful for piping)

### `bib references`
Explore all references from your cited papers with sorting and filtering.

```bash
bib references                       # List all references
bib references -e > all_refs.bib     # Export to BibTeX
bib references --sort year --order asc  # Sort by year ascending
bib references --filter-year 2020    # Only papers from 2020+
bib references --exclude-existing    # Exclude papers already in your bib
```

**Options:**
- `-e, --export` - Export as BibTeX format
- `-n, --number <N>` - Maximum results (default: 50)
- `--sort <field>` - Sort by: citations, year, title, authors
- `--order <dir>` - Sort order: desc, asc
- `--filter-year <year>` - Show papers from this year or later
- `--filter-title <text>` - Filter by title text
- `--filter-author <text>` - Filter by author name
- `--exclude-existing` - Exclude papers already in bibliography

### `bib dois`
Find and manage missing DOIs in your bibliography.

```bash
bib dois                      # Find missing DOIs
bib dois --update             # Automatically add found DOIs
bib dois -n 5                 # Check only first 5 entries
bib dois --used-only          # Check only papers used in LaTeX
```

**Options:**
- `--update` - Automatically add found DOIs to .bib file
- `-n, --number <N>` - Limit to first N papers for testing
- `--used-only` - Only check citations used in .tex file

### `bib used` / `bib unused`
List used or unused citations from your bibliography.

```bash
bib used                      # List all used citations
bib used -v                   # Verbose output with details
bib used -k                   # Keys only
bib unused -s "quantum"       # Search unused citations
```

### `bib validate`
Validate bibliography entries against Semantic Scholar.

```bash
bib validate                  # Validate all entries
bib validate --used-only      # Validate only used citations
bib validate --show-found     # Show successfully found papers
```

### `bib cache`
Manage local API cache.

```bash
bib cache                     # Show cache statistics
bib cache --cleanup           # Remove expired entries
bib cache --clear             # Clear all cache
```

## Configuration

### API Keys

For higher rate limits and better reliability, add your Semantic Scholar API key:

1. Get a free API key from [Semantic Scholar](https://www.semanticscholar.org/product/api)
2. Create a `.env` file in your project directory:
   ```
   SEMANTIC_SCHOLAR_API_KEY=your_api_key_here
   ```
3. Or pass it directly: `bib gaps --api-key your_key`

### File Discovery

bib automatically finds your files:
- **Bibliography**: `refs.bib` or `references.bib`
- **LaTeX**: `main.tex`
- **Custom paths**: Use `-b file.bib` and `-t document.tex`

## Workflow Examples

### 1. Complete Bibliography Analysis
```bash
# Get overview
bib status

# Find and add missing DOIs
bib dois --update

# Find and export citation gaps
bib gaps -e -q > gaps.bib

# Validate everything worked
bib validate --used-only
```

### 2. Paper Discovery
```bash
# Find highly-cited recent papers in your field
bib references --filter-year 2020 --sort citations -n 20

# Export promising references
bib references --filter-year 2022 --min-citations 50 -e -q > recent_refs.bib
```

### 3. Bibliography Maintenance
```bash
# Check which citations are unused
bib unused

# Find papers missing DOIs
bib dois
```

## Output Formats

### Human-Readable
Default output shows papers with DOI links first, titles, authors, and citation context:

```
[1] https://doi.org/10.1038/s41586-019-1666-5
    "Quantum advantage with shallow circuits"
    Authors: E. Farhi, D. Gamarnik, S. Gutmann
    Year: 2019
    Citations: 234
    Referenced by 3 of your papers: farhi2014, preskill2018, harrow2009
```

### BibTeX Export
Clean BibTeX entries with citation metadata in notes:

```bibtex
@article{farhi2019,
  title={Quantum advantage with shallow circuits},
  author={E. Farhi and D. Gamarnik and S. Gutmann},
  year={2019},
  doi={10.1038/s41586-019-1666-5},
  note={Citation count: 234; Referenced by: farhi2014, preskill2018, harrow2009}
}
```

## Technical Details

- **Rate Limiting**: Respects API limits with exponential backoff
- **Caching**: 7-day local cache for API responses
- **Paper Matching**: DOI-first matching with title fallback
- **Deduplication**: Smart reference deduplication across papers
- **APIs**: Semantic Scholar (primary) + CrossRef (fallback)

## Troubleshooting

### Common Issues

**"No .bib file found"**
- Place `refs.bib` in your directory, or use `-b path/to/file.bib`

**"Rate limit errors"**
- Add your Semantic Scholar API key to `.env`
- Subsequent runs use cache for faster results

**"Many papers not found"**
- Add DOIs to your bibliography entries when available
- Some older papers may not be in Semantic Scholar

### Getting Help

```bash
bib --help                # General help
bib gaps --help           # Command-specific help
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Semantic Scholar API](https://www.semanticscholar.org/product/api) for paper data
- [CrossRef API](https://www.crossref.org/services/api/) for DOI resolution
- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI interface