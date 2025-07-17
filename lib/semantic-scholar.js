const https = require('https');
const APICache = require('./cache');
const Config = require('./config');

/**
 * Semantic Scholar API client with caching and rate limiting
 * Implements exponential backoff and local caching as promised to Semantic Scholar
 */
class SemanticScholarAPI {
  constructor(apiKey = null) {
    this.baseUrl = 'api.semanticscholar.org';
    this.rateLimitDelay = 1100; // 1.1 seconds between requests (safely under 1 req/sec limit)
    this.lastRequestTime = 0;
    this.maxRetries = 4; // Increased for better resilience
    this.cache = new APICache();
    this.quiet = false; // Flag to suppress debug output
    
    // Try different sources for API key (in order of priority)
    this.apiKey = apiKey || 
                 process.env.SEMANTIC_SCHOLAR_API_KEY || 
                 this.loadAPIKeyFromConfig() ||
                 this.loadAPIKeyFromFile();
    
    // More aggressive exponential backoff parameters
    this.baseBackoffTime = 3000; // Start with 3 seconds
    this.maxBackoffTime = 30000; // Cap at 30 seconds
    
    // Only log API key status if verbose mode is requested
    if (process.env.VERBOSE || process.argv.includes('--verbose')) {
      if (this.apiKey) {
        console.log(`Using Semantic Scholar API key for authenticated requests (key: ${this.apiKey.substring(0, 8)}...)`);
      } else {
        console.log('Using Semantic Scholar public API (no key provided)');
      }
    }
  }

  /**
   * Set quiet mode to suppress debug output
   */
  setQuiet(quiet) {
    this.quiet = quiet;
  }

  /**
   * Load API key from config file
   */
  loadAPIKeyFromConfig() {
    try {
      const config = new Config();
      return config.getSemanticScholarApiKey();
    } catch (error) {
      // Ignore errors, just return null
      return null;
    }
  }

  /**
   * Load API key from .env file
   */
  loadAPIKeyFromFile() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Try multiple possible locations for .env file
      const possiblePaths = [
        path.resolve('.env'),           // Current directory
        path.resolve('..', '.env'),     // Parent directory
        path.resolve('../..', '.env'),  // Grandparent directory
      ];
      
      for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const keyMatch = envContent.match(/SEMANTIC_SCHOLAR_API_KEY=(.+)/);
          if (keyMatch) {
            return keyMatch[1].trim();
          }
        }
      }
    } catch (error) {
      // Ignore errors, just return null
    }
    return null;
  }

  async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async makeRequest(path, retryCount = 0) {
    // Check cache first
    const cachedResult = this.cache.get(path);
    if (cachedResult !== null) {
      return { data: cachedResult, fromCache: true };
    }

    await this.rateLimit();
    
    return new Promise((resolve, reject) => {
      const headers = {
        'User-Agent': 'bibcli-tool/1.0.0'
      };
      
      // Add API key if available
      if (this.apiKey) {
        headers['x-api-key'] = this.apiKey;
      }
      
      // Track request count for debugging
      this.requestCount = (this.requestCount || 0) + 1;
      
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: headers
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', async () => {
          if (res.statusCode === 200) {
            try {
              const jsonData = JSON.parse(data);
              // Cache successful results
              this.cache.set(path, jsonData);
              resolve({ data: jsonData, fromCache: false });
            } catch (error) {
              reject(new Error(`Failed to parse JSON: ${error.message}`));
            }
          } else if (res.statusCode === 404) {
            // Cache 404 results to avoid repeat lookups
            this.cache.set(path, null);
            resolve({ data: null, fromCache: false }); // Paper not found
          } else if (res.statusCode === 429) {
            // Rate limit exceeded - implement proper exponential backoff
            if (retryCount < this.maxRetries) {
              const backoffTime = Math.min(
                this.baseBackoffTime * Math.pow(2, retryCount),
                this.maxBackoffTime
              );
              if (!this.quiet) {
                console.log(`    Rate limit hit, backing off for ${backoffTime/1000}s...`);
              }
              await new Promise(resolve => setTimeout(resolve, backoffTime));
              try {
                const result = await this.makeRequest(path, retryCount + 1);
                resolve(result);
              } catch (error) {
                reject(error);
              }
            } else {
              reject(new Error(`Rate limit exceeded after ${this.maxRetries} retries`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Search for a paper by title
   */
  async searchPaper(title, limit = 5) {
    const encodedTitle = encodeURIComponent(title);
    const path = `/graph/v1/paper/search?query=${encodedTitle}&limit=${limit}&fields=paperId,title,authors,year,citationCount,referenceCount,journal,externalIds`;
    
    try {
      const result = await this.makeRequest(path);
      return result && result.data ? result.data.data : [];
    } catch (error) {
      console.warn(`Search failed for "${title}": ${error.message}`);
      return [];
    }
  }

  /**
   * Get paper details by DOI
   */
  async getPaperByDOI(doi) {
    const path = `/graph/v1/paper/DOI:${doi}?fields=paperId,title,authors,year,citationCount,referenceCount,journal,externalIds,references,references.title,references.authors,references.year,references.citationCount,references.externalIds`;
    
    try {
      const result = await this.makeRequest(path);
      if (result && result.data) {
        const paper = { ...result.data, fromCache: result.fromCache };
        
        // If paper has reference count but no references, try fallback APIs
        if (paper.referenceCount > 0 && !paper.references) {
          // Try CrossRef API as fallback
          if (doi) {
            try {
              const crossrefRefs = await this.getCrossRefReferences(doi);
              if (crossrefRefs && crossrefRefs.length > 0) {
                paper.references = crossrefRefs;
                if (!this.quiet) {
                  // console.log(`    Retrieved ${crossrefRefs.length} references via CrossRef API`);
                }
              }
            } catch (crossrefError) {
              // Silent fail and continue
            }
          }
        }
        
        return paper;
      }
      return null;
    } catch (error) {
      console.warn(`DOI lookup failed for "${doi}": ${error.message}`);
      return null;
    }
  }

  /**
   * Get paper details by Semantic Scholar ID
   */
  async getPaperById(paperId) {
    const path = `/graph/v1/paper/${paperId}?fields=paperId,title,authors,year,citationCount,referenceCount,journal,externalIds,references,references.title,references.authors,references.year,references.citationCount,references.externalIds`;
    
    try {
      const result = await this.makeRequest(path);
      return result ? { ...result.data, fromCache: result.fromCache } : null;
    } catch (error) {
      console.warn(`Paper lookup failed for ID "${paperId}": ${error.message}`);
      return null;
    }
  }

  /**
   * Extract potential identifiers from a citation entry
   */
  extractIdentifiers(bibEntry) {
    const identifiers = {
      title: bibEntry.title,
      normalizedTitle: this.normalizeTitle(bibEntry.title),
      doi: null,
      arxiv: null,
      isbn: null,
      author: bibEntry.author,
      year: bibEntry.year,
      type: bibEntry.type
    };

    // Extract DOI
    if (bibEntry.doi) {
      identifiers.doi = bibEntry.doi;
    }
    
    // Look for DOI in URL
    if (bibEntry.url && bibEntry.url.includes('doi.org/')) {
      const doiMatch = bibEntry.url.match(/doi\.org\/(10\..+)/);
      if (doiMatch) {
        identifiers.doi = doiMatch[1];
      }
    }

    // Extract arXiv ID
    if (bibEntry.eprint) {
      identifiers.arxiv = bibEntry.eprint;
    }
    
    // Look for arXiv in URL
    if (bibEntry.url && bibEntry.url.includes('arxiv.org/')) {
      const arxivMatch = bibEntry.url.match(/arxiv\.org\/(?:abs\/)?(\d{4}\.\d{4,5})/);
      if (arxivMatch) {
        identifiers.arxiv = arxivMatch[1];
      }
    }

    // Extract ISBN for books
    if (bibEntry.isbn) {
      // Clean up ISBN (remove spaces, hyphens)
      identifiers.isbn = bibEntry.isbn.replace(/[\s-]/g, '');
    }

    return identifiers;
  }

  /**
   * Normalize title for comparison
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
   * Get references from CrossRef API as fallback
   */
  async getCrossRefReferences(doi) {
    return new Promise((resolve, reject) => {
      const https = require('https');
      
      const options = {
        hostname: 'api.crossref.org',
        path: `/works/${doi}`,
        headers: {
          'User-Agent': 'bibcli-tool/1.0.0 (mailto:contact@example.com)' // CrossRef requires User-Agent
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const crossrefData = JSON.parse(data);
              const work = crossrefData.message;
              
              if (work.reference && work.reference.length > 0) {
                // Convert CrossRef format to our format
                const references = work.reference.map(ref => {
                  // CrossRef can have different title fields
                  const title = ref['article-title'] || ref.title || ref['volume-title'] || ref['chapter-title'];
                  
                  // Parse authors more robustly
                  let authors = [];
                  if (ref.author && Array.isArray(ref.author)) {
                    authors = ref.author.map(a => ({
                      name: `${a.given || ''} ${a.family || ''}`.trim() || 'Unknown author'
                    }));
                  }
                  
                  // Parse year from various fields
                  let year = null;
                  if (ref.year) {
                    year = ref.year;
                  } else if (ref.issued && ref.issued['date-parts'] && ref.issued['date-parts'][0]) {
                    year = ref.issued['date-parts'][0][0];
                  }
                  
                  return {
                    title: title || null,
                    authors: authors,
                    year: year,
                    doi: ref.DOI || null,
                    journal: ref['journal-title'] ? { name: ref['journal-title'] } : null,
                    externalIds: ref.DOI ? { DOI: ref.DOI } : {},
                    citationCount: null // CrossRef doesn't provide citation counts
                  };
                }).filter(ref => ref.doi || (ref.title && ref.authors.length > 0)); // Keep if has DOI or sufficient metadata
                
                resolve(references);
              } else {
                resolve([]);
              }
            } catch (error) {
              reject(new Error(`Failed to parse CrossRef response: ${error.message}`));
            }
          } else {
            resolve([]); // No data available
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`CrossRef request failed: ${error.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('CrossRef request timeout'));
      });

      req.end();
    });
  }

  /**
   * Find a paper using multiple strategies
   */
  async findPaper(bibEntry) {
    const identifiers = this.extractIdentifiers(bibEntry);
    
    // Try DOI first (most reliable)
    if (identifiers.doi) {
      const paper = await this.getPaperByDOI(identifiers.doi);
      if (paper) return paper;
    }

    // Try arXiv ID
    if (identifiers.arxiv) {
      const path = `/graph/v1/paper/ARXIV:${identifiers.arxiv}?fields=paperId,title,authors,year,citationCount,referenceCount,journal,externalIds,references,references.title,references.authors,references.year,references.citationCount,references.externalIds`;
      try {
        const result = await this.makeRequest(path);
        if (result && result.data) return { ...result.data, fromCache: result.fromCache };
      } catch (error) {
        console.warn(`arXiv lookup failed: ${error.message}`);
      }
    }

    // Fallback to title search
    if (identifiers.title) {
      const searchResults = await this.searchPaper(identifiers.title, 1);
      if (searchResults.length > 0) {
        // Get full details for the first result
        return await this.getPaperById(searchResults[0].paperId);
      }
    }

    return null;
  }
}

module.exports = SemanticScholarAPI;