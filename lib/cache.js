const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Local cache for Semantic Scholar API results
 * Implements disk persistence to avoid repeat lookups
 */
class APICache {
  constructor(cacheDir = '.bibcli-cache') {
    this.cacheDir = path.resolve(cacheDir);
    this.memoryCache = new Map();
    this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    
    this.ensureCacheDir();
    this.loadCacheIndex();
  }

  ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Generate a cache key from a request path
   */
  generateCacheKey(requestPath) {
    return crypto.createHash('md5').update(requestPath).digest('hex');
  }

  /**
   * Get cache file path for a given key
   */
  getCacheFilePath(key) {
    return path.join(this.cacheDir, `${key}.json`);
  }

  /**
   * Load cache index to memory for faster lookups
   */
  loadCacheIndex() {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      if (fs.existsSync(indexPath)) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        this.cacheIndex = new Map(Object.entries(indexData));
      } else {
        this.cacheIndex = new Map();
      }
    } catch (error) {
      console.warn('Failed to load cache index:', error.message);
      this.cacheIndex = new Map();
    }
  }

  /**
   * Save cache index to disk
   */
  saveCacheIndex() {
    try {
      const indexPath = path.join(this.cacheDir, 'index.json');
      const indexData = Object.fromEntries(this.cacheIndex);
      fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.warn('Failed to save cache index:', error.message);
    }
  }

  /**
   * Check if a cache entry is still valid
   */
  isValid(timestamp) {
    return (Date.now() - timestamp) < this.maxAge;
  }

  /**
   * Get cached result for a request path
   */
  get(requestPath) {
    const key = this.generateCacheKey(requestPath);
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const cached = this.memoryCache.get(key);
      if (this.isValid(cached.timestamp)) {
        return cached.data;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    if (this.cacheIndex.has(key)) {
      const cacheInfo = this.cacheIndex.get(key);
      if (this.isValid(cacheInfo.timestamp)) {
        try {
          const filePath = this.getCacheFilePath(key);
          const fileData = fs.readFileSync(filePath, 'utf8');
          const cached = JSON.parse(fileData);
          
          // Load into memory cache for faster future access
          this.memoryCache.set(key, cached);
          return cached.data;
        } catch (error) {
          // File corrupted or missing, remove from index
          this.cacheIndex.delete(key);
          this.saveCacheIndex();
        }
      } else {
        // Expired, remove from index and delete file
        this.cacheIndex.delete(key);
        try {
          fs.unlinkSync(this.getCacheFilePath(key));
        } catch (error) {
          // File already deleted, ignore
        }
        this.saveCacheIndex();
      }
    }

    return null;
  }

  /**
   * Store result in cache
   */
  set(requestPath, data) {
    const key = this.generateCacheKey(requestPath);
    const timestamp = Date.now();
    const cacheEntry = { data, timestamp, requestPath };

    // Store in memory cache
    this.memoryCache.set(key, cacheEntry);

    // Store in disk cache
    try {
      const filePath = this.getCacheFilePath(key);
      fs.writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2));
      
      // Update index
      this.cacheIndex.set(key, { timestamp, requestPath });
      this.saveCacheIndex();
    } catch (error) {
      console.warn('Failed to write cache file:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const memorySize = this.memoryCache.size;
    const diskSize = this.cacheIndex.size;
    let totalSizeBytes = 0;
    
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          const stats = fs.statSync(filePath);
          totalSizeBytes += stats.size;
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return {
      memoryEntries: memorySize,
      diskEntries: diskSize,
      totalSizeKB: Math.round(totalSizeBytes / 1024),
      cacheDir: this.cacheDir
    };
  }

  /**
   * Clean expired entries from cache
   */
  cleanup() {
    let removedCount = 0;
    
    // Clean memory cache
    for (const [key, cached] of this.memoryCache) {
      if (!this.isValid(cached.timestamp)) {
        this.memoryCache.delete(key);
        removedCount++;
      }
    }

    // Clean disk cache
    for (const [key, cacheInfo] of this.cacheIndex) {
      if (!this.isValid(cacheInfo.timestamp)) {
        this.cacheIndex.delete(key);
        try {
          fs.unlinkSync(this.getCacheFilePath(key));
        } catch (error) {
          // File already deleted, ignore
        }
        removedCount++;
      }
    }

    if (removedCount > 0) {
      this.saveCacheIndex();
    }

    return removedCount;
  }

  /**
   * Clear all cache
   */
  clear() {
    this.memoryCache.clear();
    
    try {
      // Remove all cache files
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
      
      this.cacheIndex.clear();
      this.saveCacheIndex();
    } catch (error) {
      console.warn('Failed to clear cache:', error.message);
    }
  }
}

module.exports = APICache;