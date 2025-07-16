const fs = require('fs');

/**
 * Simple .bib file parser to extract citation keys
 */
class BibParser {
  constructor(bibFilePath) {
    this.bibFilePath = bibFilePath;
    this.entries = new Map();
  }

  parse() {
    try {
      const content = fs.readFileSync(this.bibFilePath, 'utf8');
      return this.extractEntries(content);
    } catch (error) {
      throw new Error(`Error reading .bib file: ${error.message}`);
    }
  }

  extractEntries(content) {
    // Match @type{key, ...} patterns
    const entryRegex = /@(\w+)\s*\{\s*([^,\s}]+)/g;
    const entries = new Map();
    let match;

    while ((match = entryRegex.exec(content)) !== null) {
      const [, type, key] = match;
      
      // Extract title if available (simple extraction)
      const entryStart = match.index;
      const entryEnd = this.findEntryEnd(content, entryStart);
      const entryContent = content.slice(entryStart, entryEnd);
      
      const title = this.extractField(entryContent, 'title');
      const author = this.extractField(entryContent, 'author');
      const year = this.extractField(entryContent, 'year');
      const doi = this.extractField(entryContent, 'doi');
      const isbn = this.extractField(entryContent, 'isbn');
      const url = this.extractField(entryContent, 'url');

      entries.set(key, {
        type: type.toLowerCase(),
        key,
        title: title || '',
        author: author || '',
        year: year || '',
        doi: doi || '',
        isbn: isbn || '',
        url: url || ''
      });
    }

    return entries;
  }

  findEntryEnd(content, start) {
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = start; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    return content.length;
  }

  extractField(entryContent, fieldName) {
    // More robust field extraction that handles nested braces
    const fieldStartRegex = new RegExp(`${fieldName}\\s*=\\s*([{"'])`, 'i');
    const match = entryContent.match(fieldStartRegex);
    
    if (!match) return null;
    
    const startChar = match[1];
    const startIndex = match.index + match[0].length - 1;
    
    if (startChar === '"') {
      // Handle quoted strings
      const endIndex = this.findMatchingQuote(entryContent, startIndex);
      if (endIndex === -1) return null;
      return entryContent.slice(startIndex + 1, endIndex).trim();
    } else {
      // Handle braced strings
      const endIndex = this.findMatchingBrace(entryContent, startIndex);
      if (endIndex === -1) return null;
      return entryContent.slice(startIndex + 1, endIndex).trim();
    }
  }

  findMatchingQuote(content, startIndex) {
    let escapeNext = false;
    for (let i = startIndex + 1; i < content.length; i++) {
      const char = content[i];
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      if (char === '"') {
        return i;
      }
    }
    return -1;
  }

  findMatchingBrace(content, startIndex) {
    let braceCount = 1;
    let escapeNext = false;
    let inString = false;
    
    for (let i = startIndex + 1; i < content.length; i++) {
      const char = content[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            return i;
          }
        }
      }
    }
    return -1;
  }

  getAllKeys() {
    if (this.entries.size === 0) {
      this.entries = this.parse();
    }
    return Array.from(this.entries.keys());
  }

  getEntry(key) {
    if (this.entries.size === 0) {
      this.entries = this.parse();
    }
    return this.entries.get(key);
  }
}

module.exports = BibParser;