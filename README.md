# bib

A bib file utility and citation gap analysis. Analyze your LaTeX bibliography, find missing references, and manage DOIs with ease.

## Installation

```bash
npm i -g bib-cli
```

## Examples

bib automatically finds your files:
- **Bibliography**: `refs.bib` or `references.bib`
- **LaTeX**: `main.tex`
- **Custom paths**: Use `-b file.bib` and `-t document.tex`

```bash
# Check which references you've used and haven't used yet
bib status --basic
bib used
bib unused
bib unused --sort-by-relevance

# Find and add missing DOIs to your bib file
bib dois
bib dois --update

# Check for gaps
basic status
bib gaps

# Export BibTeX of papers that have been cited at least 10 times by any paper in your bib file
bib gaps --include-unused --min-citations 10 -q -e > gaps.bib
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

bib also uses the CrossRef API.


## Acknowledgments

- [Semantic Scholar API](https://www.semanticscholar.org/product/api) for paper data
- [CrossRef API](https://www.crossref.org/services/api/) for DOI resolution
- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI interface
- Made with [Claude Code](https://www.anthropic.com/claude-code)