const SemanticScholarAPI = require('./semantic-scholar');

/**
 * Analyzes citation gaps by examining references of cited papers
 */
class GapAnalyzer {
  constructor(citationAnalyzer, apiKey = null) {
    this.citationAnalyzer = citationAnalyzer;
    this.semanticScholar = new SemanticScholarAPI(apiKey);
    this.cache = new Map(); // Cache API results
  }

  /**
   * Get references for all used citations
   */
  async getReferencesForUsedCitations(limitPapers = null, quiet = false) {
    let usedCitations = this.citationAnalyzer.getUsedCitationsList();
    return this.getReferencesForCitations(usedCitations, limitPapers, quiet);
  }

  async getReferencesForAllCitations(limitPapers = null, quiet = false) {
    let allCitations = this.citationAnalyzer.getAllBibEntriesArray();
    return this.getReferencesForCitations(allCitations, limitPapers, quiet);
  }

  async getReferencesForCitations(citations, limitPapers = null, quiet = false) {
    if (limitPapers && limitPapers > 0) {
      citations = citations.slice(0, limitPapers);
      if (!quiet) {
        console.log(`Limited to first ${limitPapers} papers for testing.`);
      }
    }
    const referencesMap = new Map();
    let successCount = 0;
    let errorCount = 0;
    
    if (!quiet) {
      console.log(`Analyzing ${citations.length} papers (1 request per second)...`);
      console.log('This may take a few minutes due to rate limiting.\n');
    }
    
    // Process citations sequentially but with optimized caching
    // Semantic Scholar has a hard 1 RPS limit, so we must be sequential for API calls
    for (const [index, citation] of citations.entries()) {
      if (!quiet) {
        const progress = `[${index + 1}/${citations.length}]`;
        process.stdout.write(`${progress} Looking up: ${citation.key}...`);
      }
      
      try {
        const paper = await this.semanticScholar.findPaper(citation);
        if (paper && paper.references) {
          referencesMap.set(citation.key, {
            paper,
            references: paper.references
          });
          if (!quiet) {
            const cacheIndicator = paper.fromCache ? ' (cached)' : '';
            console.log(` ✓ Found ${paper.references.length} references${cacheIndicator}`);
          }
          successCount++;
        } else if (paper && paper.referenceCount && paper.referenceCount > 0) {
          if (!quiet) {
            const cacheIndicator = paper.fromCache ? ' (cached)' : '';
            console.log(` - References restricted by publisher (${paper.referenceCount} refs exist)${cacheIndicator}`);
          }
        } else {
          if (!quiet) {
            const cacheIndicator = paper && paper.fromCache ? ' (cached)' : '';
            console.log(` - No references found${cacheIndicator}`);
          }
        }
      } catch (error) {
        if (!quiet) {
          console.log(` ✗ Error: ${error.message}`);
        }
        errorCount++;
        
        // If we've had too many consecutive errors, suggest stopping
        if (errorCount > 5 && successCount === 0) {
          if (!quiet) {
            console.log('\nMany consecutive errors detected. The API might be temporarily unavailable.');
            console.log('You can try again later or continue with partial results.');
          }
          break;
        }
      }
    }
    
    if (!quiet) {
      console.log(`\nLookup complete: ${successCount} successful, ${errorCount} failed`);
      
      // Show cache statistics
      const cacheStats = this.semanticScholar.cache.getStats();
      console.log(`Cache: ${cacheStats.diskEntries} entries, ${cacheStats.totalSizeKB} KB`);
    }
    
    return referencesMap;
  }

  /**
   * Aggregate references and find frequently cited papers
   */
  analyzeGaps(referencesMap, minCitations = 2) {
    const referenceFrequency = new Map();
    
    // Get our existing bibliography for comparison
    const existingPapers = this.buildExistingPapersIndex();
    
    // Count how often each reference appears
    for (const [citationKey, data] of referencesMap) {
      for (const ref of data.references) {
        if (!ref.title) continue;
        
        // Skip if we already have this paper in our bibliography
        if (this.isPaperInBibliography(ref, existingPapers)) {
          continue;
        }
        
        const refKey = this.createReferenceKey(ref);
        
        if (!referenceFrequency.has(refKey)) {
          referenceFrequency.set(refKey, {
            count: 0,
            reference: ref,
            citedBy: []
          });
        }
        
        const refData = referenceFrequency.get(refKey);
        refData.count++;
        // Only add unique citation keys to avoid duplicates
        if (!refData.citedBy.includes(citationKey)) {
          refData.citedBy.push(citationKey);
        }
      }
    }
    
    // Filter by minimum citation count
    const gaps = [];
    for (const [refKey, data] of referenceFrequency) {
      if (data.count >= minCitations) {
        gaps.push(data);
      }
    }
    
    // Sort by frequency (most cited first)
    gaps.sort((a, b) => b.count - a.count);
    
    return gaps;
  }

  /**
   * Build an index of existing papers in our bibliography for fast lookup
   */
  buildExistingPapersIndex() {
    const usedCitations = this.citationAnalyzer.getUsedCitationsList();
    const index = {
      byDOI: new Map(),
      byISBN: new Map(),
      byNormalizedTitle: new Map(),
      byTitleAndYear: new Map()
    };

    for (const citation of usedCitations) {
      const identifiers = this.semanticScholar.extractIdentifiers(citation);
      
      if (identifiers.doi) {
        index.byDOI.set(identifiers.doi.toLowerCase(), citation);
      }
      
      if (identifiers.isbn) {
        index.byISBN.set(identifiers.isbn, citation);
      }
      
      if (identifiers.normalizedTitle) {
        index.byNormalizedTitle.set(identifiers.normalizedTitle, citation);
        
        // Also index by title + year for better disambiguation
        if (identifiers.year) {
          const titleYear = `${identifiers.normalizedTitle}|${identifiers.year}`;
          index.byTitleAndYear.set(titleYear, citation);
        }
      }
    }

    return index;
  }

  /**
   * Check if a reference paper is already in our bibliography
   */
  isPaperInBibliography(ref, existingPapersIndex) {
    // Extract DOI from Semantic Scholar's externalIds format
    const refDOI = this.extractDOIFromSemanticScholar(ref);
    
    // First try DOI matching (most reliable)
    if (refDOI) {
      if (existingPapersIndex.byDOI.has(refDOI.toLowerCase())) {
        return true;
      }
    }

    // Try title + year matching (good for books and papers without DOIs)
    if (ref.title && ref.year) {
      const normalizedTitle = this.normalizeTitle(ref.title);
      const titleYear = `${normalizedTitle}|${ref.year}`;
      if (existingPapersIndex.byTitleAndYear.has(titleYear)) {
        return true;
      }
    }

    // Fallback to just normalized title (less reliable, could have false positives)
    if (ref.title) {
      const normalizedTitle = this.normalizeTitle(ref.title);
      if (existingPapersIndex.byNormalizedTitle.has(normalizedTitle)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract DOI from Semantic Scholar's externalIds format
   */
  extractDOIFromSemanticScholar(paper) {
    if (paper.externalIds && paper.externalIds.DOI) {
      return paper.externalIds.DOI;
    }
    return null;
  }

  /**
   * Create a unique key for a reference
   */
  createReferenceKey(ref) {
    // Use DOI if available (prefer direct DOI field, fallback to Semantic Scholar format)
    const doi = ref.doi || this.extractDOIFromSemanticScholar(ref);
    if (doi) {
      return `doi:${doi.toLowerCase()}`;
    }
    
    // Use normalized title + year
    if (ref.title && ref.year) {
      return `title_year:${this.normalizeTitle(ref.title)}|${ref.year}`;
    }
    
    // Fallback to just title
    if (ref.title) {
      return `title:${this.normalizeTitle(ref.title)}`;
    }
    
    return `unknown:${Math.random()}`;
  }

  /**
   * Normalize title for comparison (handle case, punctuation differences)
   */
  normalizeTitle(title) {
    if (!title) return '';
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  /**
   * Generate BibTeX entry for a reference
   */
  generateBibTeX(reference, suggestedKey, citedBy = null) {
    const year = reference.year || 'YEAR';
    const title = reference.title || 'TITLE';
    
    let authors = 'AUTHOR';
    if (reference.authors && reference.authors.length > 0) {
      authors = reference.authors.map(a => a.name).join(' and ');
    }
    
    let entry = `@article{${suggestedKey},\n`;
    entry += `  title={${title}},\n`;
    entry += `  author={${authors}},\n`;
    entry += `  year={${year}},\n`;
    
    if (reference.journal && reference.journal.name) {
      entry += `  journal={${reference.journal.name}},\n`;
    }
    
    if (reference.doi) {
      entry += `  doi={${reference.doi}},\n`;
    }
    
    // Build note with citation count and citing papers
    let noteText = `Citation count: ${reference.citationCount || 'N/A'}`;
    if (citedBy && citedBy.length > 0) {
      noteText += `; Referenced by: ${citedBy.join(', ')}`;
    }
    
    entry += `  note={${noteText}}\n`;
    entry += '}';
    
    return entry;
  }

  /**
   * Generate a suggested citation key from author and year
   */
  generateSuggestedKey(reference) {
    const year = reference.year || '';
    
    if (reference.authors && reference.authors.length > 0) {
      const firstAuthor = reference.authors[0].name;
      const lastName = firstAuthor.split(' ').pop().toLowerCase();
      return `${lastName}${year}`;
    }
    
    return `unknown${year}`;
  }

  /**
   * Main entry point for gap analysis
   */
  async findGaps(options = {}) {
    const minCitations = options.minCitations || 2;
    const limitPapers = options.limitPapers || null;
    const quiet = options.quiet || false;
    const includeUnused = options.includeUnused || false;
    
    if (!quiet) {
      console.log('Starting citation gap analysis...\n');
    }
    
    // Set quiet mode on semantic scholar instance
    this.semanticScholar.setQuiet(quiet);
    
    const referencesMap = includeUnused 
      ? await this.getReferencesForAllCitations(limitPapers, quiet)
      : await this.getReferencesForUsedCitations(limitPapers, quiet);
    const gaps = this.analyzeGaps(referencesMap, minCitations);
    
    return {
      gaps,
      totalAnalyzed: referencesMap.size,
      summary: {
        highPriority: gaps.filter(g => g.count >= 3).length,
        mediumPriority: gaps.filter(g => g.count === 2).length,
        totalGaps: gaps.length
      }
    };
  }
}

module.exports = GapAnalyzer;