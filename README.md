# bib

<img src="baby-bib.png" alt="bib icon" width="120" align="right">

A bib file utility and citation gap analysis. Analyze your LaTeX bibliography, find missing references, and manage DOIs with ease.

## Installation

```bash
npm i -g @lukeburns/bib
```

or

```bash
git clone https://github.com/lukeburns/bib.git
npm install
npm link # to add bin/bib to PATH --- may require sudo npm link
```

## Examples

```bash
# Configure
bib config --set-bib refs.bib
bib config --set-tex main.tex
bib config --set-semantic-scholar-key your-api-key-here # optional

# Check which references you've used and haven't used yet
bib status --basic
bib used
bib unused
bib unused --sort-by-relevance

# Find and add missing DOIs to your bib file
bib dois
bib dois --update

# Check for gaps - papers cited by your refs
bib gaps

# Export BibTeX of papers that have been cited at least 10 times by any paper in your bib file
bib gaps --include-unused --min-citations 10 -q -e > gaps.bib

# List citations missing from intro, but used later in the paper
bib intro

# Find intellectual progeny - papers that cite multiple specified citations
bib progeny citation1 citation2 citation3
bib progeny citation1 citation2 -e > papers_citing_both.bib
```

## Acknowledgments

- [Semantic Scholar API](https://www.semanticscholar.org/product/api) for paper data
- [CrossRef API](https://www.crossref.org/services/api/) for DOI resolution
- Built with [Commander.js](https://github.com/tj/commander.js/) for CLI interface
- Bib icon created by [Chanut-is-Industries](https://www.flaticon.com/authors/chanut-is-industries)
- Made with [Claude Code](https://www.anthropic.com/claude-code)