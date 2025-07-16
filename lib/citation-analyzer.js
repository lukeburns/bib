const BibParser = require('./bib-parser');
const TexParser = require('./tex-parser');

/**
 * Analyzes citations between .bib and .tex files
 */
class CitationAnalyzer {
  
  /**
   * Clean up BibTeX formatting from text (remove protective braces)
   */
  cleanBibTexFormatting(text) {
    if (!text) return text;
    
    // Remove protective braces but keep the content
    // This handles cases like {DNA}, {Schrödinger}, {AI}, etc.
    return text
      .replace(/\{([^{}]*)\}/g, '$1')  // Remove single-level braces
      .replace(/\{([^{}]*)\}/g, '$1')  // Run twice to catch nested cases
      .trim();
  }
  constructor(bibFilePath, texFilePath) {
    this.bibParser = new BibParser(bibFilePath);
    this.texParser = new TexParser(texFilePath);
    this._bibEntries = null;
    this._usedCitations = null;
  }

  getBibEntries() {
    if (!this._bibEntries) {
      this._bibEntries = this.bibParser.parse();
    }
    return this._bibEntries;
  }

  getAllBibEntriesArray() {
    const entries = this.getBibEntries();
    return Array.from(entries.values());
  }

  getUsedCitations() {
    if (!this._usedCitations) {
      this._usedCitations = new Set(this.texParser.getUsedCitations());
    }
    return this._usedCitations;
  }

  getUnusedCitations() {
    const bibEntries = this.getBibEntries();
    const usedCitations = this.getUsedCitations();
    
    const unused = [];
    
    for (const [key, entry] of bibEntries) {
      if (!usedCitations.has(key)) {
        unused.push({
          key,
          ...entry,
          title: this.cleanBibTexFormatting(entry.title),
          author: this.cleanBibTexFormatting(entry.author)
        });
      }
    }
    
    return unused;
  }

  getUsedCitationsList() {
    const bibEntries = this.getBibEntries();
    const usedCitations = this.getUsedCitations();
    
    const used = [];
    
    for (const key of usedCitations) {
      const entry = bibEntries.get(key);
      if (entry) {
        used.push({
          key,
          ...entry,
          title: this.cleanBibTexFormatting(entry.title),
          author: this.cleanBibTexFormatting(entry.author)
        });
      } else {
        // Citation used but not found in .bib file
        used.push({
          key,
          type: 'missing',
          title: '[NOT FOUND IN .BIB FILE]',
          author: '',
          year: ''
        });
      }
    }
    
    return used;
  }

  getStats() {
    const bibEntries = this.getBibEntries();
    const usedCitations = this.getUsedCitations();
    
    return {
      totalInBib: bibEntries.size,
      totalUsed: usedCitations.size,
      totalUnused: bibEntries.size - usedCitations.size,
      missingFromBib: Array.from(usedCitations).filter(key => !bibEntries.has(key)).length
    };
  }

  searchUnused(query) {
    const unused = this.getUnusedCitations();
    const lowerQuery = query.toLowerCase();
    
    return unused.filter(entry => {
      return entry.key.toLowerCase().includes(lowerQuery) ||
             entry.title.toLowerCase().includes(lowerQuery) ||
             entry.author.toLowerCase().includes(lowerQuery);
    });
  }
}

module.exports = CitationAnalyzer;