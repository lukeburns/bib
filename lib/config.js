const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Configuration manager for bib-cli
 * Handles storing and retrieving user configuration like API keys
 */
class Config {
  constructor() {
    // Use a standard config directory based on OS
    this.configDir = this.getConfigDir();
    this.configFile = path.join(this.configDir, 'config.json');
    this.ensureConfigDir();
  }

  /**
   * Get the appropriate config directory for the OS
   */
  getConfigDir() {
    const homeDir = os.homedir();
    
    // Follow platform conventions
    switch (process.platform) {
      case 'win32':
        return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'bib-cli');
      case 'darwin':
        return path.join(homeDir, 'Library', 'Application Support', 'bib-cli');
      default:
        return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'bib-cli');
    }
  }

  /**
   * Ensure the config directory exists
   */
  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * Load configuration from file
   */
  load() {
    try {
      if (fs.existsSync(this.configFile)) {
        const data = fs.readFileSync(this.configFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      // If config is corrupted, start fresh
      console.warn(`Warning: Config file corrupted, creating new one: ${error.message}`);
    }
    return {};
  }

  /**
   * Save configuration to file
   */
  save(config) {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      return true;
    } catch (error) {
      throw new Error(`Failed to save config: ${error.message}`);
    }
  }

  /**
   * Get a configuration value
   */
  get(key) {
    const config = this.load();
    return config[key];
  }

  /**
   * Set a configuration value
   */
  set(key, value) {
    const config = this.load();
    config[key] = value;
    this.save(config);
  }

  /**
   * Remove a configuration value
   */
  remove(key) {
    const config = this.load();
    delete config[key];
    this.save(config);
  }

  /**
   * Get all configuration
   */
  getAll() {
    return this.load();
  }

  /**
   * Get Semantic Scholar API key from config
   */
  getSemanticScholarApiKey() {
    return this.get('semanticScholarApiKey');
  }

  /**
   * Set Semantic Scholar API key
   */
  setSemanticScholarApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      throw new Error('API key must be a non-empty string');
    }
    this.set('semanticScholarApiKey', apiKey);
  }

  /**
   * Remove Semantic Scholar API key
   */
  removeSemanticScholarApiKey() {
    this.remove('semanticScholarApiKey');
  }

  /**
   * Get the config file path for display
   */
  getConfigPath() {
    return this.configFile;
  }
}

module.exports = Config;