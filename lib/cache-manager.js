const fs = require('fs-extra');
const path = require('path');

class CacheManager {
  constructor(cacheDir = './cache') {
    this.cacheDir = cacheDir;
    this.ensureCacheDir();
    this.startHourlyFlush();
  }

  async ensureCacheDir() {
    await fs.ensureDir(this.cacheDir);
  }

  getCacheFilePath(key) {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.cacheDir, `${safeKey}.json`);
  }

  async get(key) {
    try {
      const filePath = this.getCacheFilePath(key);
      
      if (!(await fs.pathExists(filePath))) {
        return null;
      }

      const data = await fs.readJson(filePath);
      
      // Check if cache entry has expired
      if (data.expires && Date.now() > data.expires) {
        await this.delete(key);
        return null;
      }

      return data.value;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    try {
      const filePath = this.getCacheFilePath(key);
      const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : null;
      
      const data = {
        value,
        expires,
        created: Date.now()
      };

      await fs.writeJson(filePath, data);
      return true;
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      const filePath = this.getCacheFilePath(key);
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async clear() {
    try {
      await fs.emptyDir(this.cacheDir);
      return true;
    } catch (error) {
      console.error('Cache clear error:', error);
      return false;
    }
  }

  async flush() {
    try {
      const files = await fs.readdir(this.cacheDir);
      let flushedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          try {
            const data = await fs.readJson(filePath);
            
            // Remove expired entries
            if (data.expires && Date.now() > data.expires) {
              await fs.remove(filePath);
              flushedCount++;
            }
          } catch (_error) { // eslint-disable-line no-unused-vars
            // Remove corrupted cache files
            await fs.remove(filePath);
            flushedCount++;
          }
        }
      }

      console.log(`Cache flush completed. Removed ${flushedCount} expired entries.`);
      return flushedCount;
    } catch (error) {
      console.error('Cache flush error:', error);
      return 0;
    }
  }

  startHourlyFlush() {
    // Flush cache every hour
    setInterval(() => {
      this.flush();
    }, 60 * 60 * 1000); // 1 hour in milliseconds

    // Initial flush on startup
    setTimeout(() => {
      this.flush();
    }, 5000); // 5 seconds after startup
  }
}

module.exports = { CacheManager };