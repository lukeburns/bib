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

  extractCitationsBySection(content) {
    const citationsBySection = {};
    const sections = [];
    
    // Match \section{...} commands
    const sectionRegex = /\\section\{([^}]+)\}/g;
    let sectionMatch;
    let currentSectionIndex = 0;
    
    // First, find all section positions
    while ((sectionMatch = sectionRegex.exec(content)) !== null) {
      sections.push({
        index: ++currentSectionIndex,
        title: sectionMatch[1],
        startPos: sectionMatch.index,
        endPos: content.length // Will be updated
      });
    }
    
    // Update end positions
    for (let i = 0; i < sections.length - 1; i++) {
      sections[i].endPos = sections[i + 1].startPos;
    }
    
    // Extract citations from content before first section (if any)
    if (sections.length > 0 && sections[0].startPos > 0) {
      const preambleCitations = this.extractCitationsFromText(content.substring(0, sections[0].startPos));
      if (preambleCitations.size > 0) {
        citationsBySection[0] = {
          title: 'Preamble',
          citations: preambleCitations
        };
      }
    }
    
    // Extract citations from each section
    sections.forEach(section => {
      const sectionContent = content.substring(section.startPos, section.endPos);
      const citations = this.extractCitationsFromText(sectionContent);
      
      citationsBySection[section.index] = {
        title: section.title,
        citations: citations
      };
    });
    
    return citationsBySection;
  }
  
  extractCitationsFromText(text) {
    const citations = new Set();
    const citeRegex = /\\cite(?:\[[^\]]*\])?\s*\{([^}]+)\}/g;
    let match;

    while ((match = citeRegex.exec(text)) !== null) {
      const citationString = match[1];
      const keys = citationString
        .split(',')
        .map(key => key.trim())
        .filter(key => key.length > 0);
      
      keys.forEach(key => citations.add(key));
    }

    return citations;
  }
  
  checkIntroductionCitations() {
    try {
      const content = fs.readFileSync(this.texFilePath, 'utf8');
      const citationsBySection = this.extractCitationsBySection(content);
      
      // Get citations from section 1 (introduction)
      const introCitations = citationsBySection[1]?.citations || new Set();
      
      // Find citations used in later sections but not in introduction
      const missingFromIntro = new Set();
      
      Object.entries(citationsBySection).forEach(([sectionNum, sectionData]) => {
        const num = parseInt(sectionNum);
        if (num > 1) {
          sectionData.citations.forEach(citation => {
            if (!introCitations.has(citation)) {
              missingFromIntro.add(citation);
            }
          });
        }
      });
      
      return {
        citationsBySection,
        introCitations: Array.from(introCitations),
        missingFromIntro: Array.from(missingFromIntro)
      };
    } catch (error) {
      throw new Error(`Error parsing .tex file: ${error.message}`);
    }
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