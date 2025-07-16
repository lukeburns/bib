const fs = require('fs');

/**
 * Simple .tex file parser to extract used citations
 */
class TexParser {
  constructor(texFilePath) {
    this.texFilePath = texFilePath;
    this.usedCitations = new Set();
  }

  parse() {
    try {
      const content = fs.readFileSync(this.texFilePath, 'utf8');
      return this.extractCitations(content);
    } catch (error) {
      throw new Error(`Error reading .tex file: ${error.message}`);
    }
  }

  extractCitations(content) {
    const citations = new Set();
    
    // Match \cite{key1, key2, ...} patterns
    const citeRegex = /\\cite(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
    let match;

    while ((match = citeRegex.exec(content)) !== null) {
      const citationString = match[1];
      
      // Split by comma and clean up whitespace
      const keys = citationString
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
      
      keys.forEach(key => citations.add(key));
    }

    return citations;
  }

  getUsedCitations() {
    if (this.usedCitations.size === 0) {
      this.usedCitations = this.parse();
    }
    return Array.from(this.usedCitations);
  }

  isCitationUsed(key) {
    if (this.usedCitations.size === 0) {
      this.usedCitations = this.parse();
    }
    return this.usedCitations.has(key);
  }

  getCitationCount(key) {
    if (this.usedCitations.size === 0) {
      this.usedCitations = this.parse();
    }
    
    // For now, just return 1 if used, 0 if not
    // Could be enhanced to count actual occurrences
    return this.usedCitations.has(key) ? 1 : 0;
  }
}

module.exports = TexParser;