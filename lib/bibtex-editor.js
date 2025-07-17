const { parse } = require('@retorquere/bibtex-parser');
const fs = require('fs');

class BibTeXEditor {
  constructor(filePath) {
    this.filePath = filePath;
    this.content = fs.readFileSync(filePath, 'utf8');
    this.parsed = parse(this.content);
  }

  addDOI(entryKey, doi) {
    // Find the entry by key in the original content
    const entryRegex = new RegExp(`(@\\w+\\{${entryKey},[\\s\\S]*?)\\n\\}`, 'g');
    const match = entryRegex.exec(this.content);
    
    if (!match) {
      throw new Error(`Entry ${entryKey} not found`);
    }

    const entryContent = match[1];
    
    // Check if DOI already exists
    if (entryContent.includes('doi')) {
      return false; // DOI already exists
    }

    // Check if entry ends with comma, if not add one
    const needsComma = !entryContent.trim().endsWith(',');
    const comma = needsComma ? ',' : '';
    const updatedEntry = entryContent + `${comma}\n\tdoi = {${doi}}`;
    
    // Replace in content
    this.content = this.content.replace(match[0], updatedEntry + '\n}');
    return true; // DOI added
  }

  save() {
    fs.writeFileSync(this.filePath, this.content);
  }

  hasEntry(entryKey) {
    return this.parsed.entries.some(e => e.key === entryKey);
  }

  hasDOI(entryKey) {
    const entry = this.parsed.entries.find(e => e.key === entryKey);
    return entry && entry.fields.doi;
  }
}

module.exports = BibTeXEditor;