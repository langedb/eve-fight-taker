const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const { CacheManager } = require('../lib/cache-manager');

describe('CacheManager', () => {
  let cacheManager;
  let testCacheDir;

  beforeEach(async () => {
    // Use a unique test cache directory
    testCacheDir = path.join(__dirname, '../test-cache-' + Date.now());
    cacheManager = new CacheManager(testCacheDir);
    await cacheManager.ensureCacheDir();
  });

  afterEach(async () => {
    // Clean up test cache directory
    if (await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('constructor', () => {
    it('should create cache directory if it does not exist', async () => {
      const exists = await fs.pathExists(testCacheDir);
      expect(exists).to.be.true;
    });

    it('should use default cache directory if none provided', () => {
      const defaultCache = new CacheManager();
      expect(defaultCache.cacheDir).to.equal('./cache');
    });
  });

  describe('getCacheFilePath()', () => {
    it('should generate safe file paths', () => {
      const safePath = cacheManager.getCacheFilePath('simple-key');
      expect(safePath).to.include('simple-key.json');
    });

    it('should sanitize unsafe characters', () => {
      const safePath = cacheManager.getCacheFilePath('unsafe/key:with*chars');
      expect(safePath).to.include('unsafe_key_with_chars.json');
      expect(safePath).to.not.include('/');
      expect(safePath).to.not.include(':');
      expect(safePath).to.not.include('*');
    });
  });

  describe('set() and get()', () => {
    it('should store and retrieve simple values', async () => {
      await cacheManager.set('test-key', 'test-value');
      const value = await cacheManager.get('test-key');
      expect(value).to.equal('test-value');
    });

    it('should store and retrieve complex objects', async () => {
      const complexObj = {
        name: 'Rifter',
        attributes: [
          { id: 1, value: 100 },
          { id: 2, value: 200 }
        ],
        nested: {
          deep: true
        }
      };
      
      await cacheManager.set('complex-key', complexObj);
      const retrieved = await cacheManager.get('complex-key');
      expect(retrieved).to.deep.equal(complexObj);
    });

    it('should store and retrieve arrays', async () => {
      const testArray = [1, 2, 3, 'four', { five: 5 }];
      await cacheManager.set('array-key', testArray);
      const retrieved = await cacheManager.get('array-key');
      expect(retrieved).to.deep.equal(testArray);
    });

    it('should return null for non-existent keys', async () => {
      const value = await cacheManager.get('non-existent-key');
      expect(value).to.be.null;
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should respect TTL and expire entries', async () => {
      // Set with 1 second TTL
      await cacheManager.set('ttl-key', 'ttl-value', 1);
      
      // Should be retrievable immediately
      let value = await cacheManager.get('ttl-key');
      expect(value).to.equal('ttl-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should be expired now
      value = await cacheManager.get('ttl-key');
      expect(value).to.be.null;
    });

    it('should handle entries without TTL', async () => {
      await cacheManager.set('no-ttl-key', 'no-ttl-value', null);
      const value = await cacheManager.get('no-ttl-key');
      expect(value).to.equal('no-ttl-value');
    });

    it('should use default TTL when not specified', async () => {
      await cacheManager.set('default-ttl-key', 'default-ttl-value');
      const value = await cacheManager.get('default-ttl-key');
      expect(value).to.equal('default-ttl-value');
      
      // Check that file was created with expiration
      const filePath = cacheManager.getCacheFilePath('default-ttl-key');
      const fileData = await fs.readJson(filePath);
      expect(fileData.expires).to.be.a('number');
      expect(fileData.expires).to.be.greaterThan(Date.now());
    });
  });

  describe('delete()', () => {
    it('should delete existing cache entries', async () => {
      await cacheManager.set('delete-key', 'delete-value');
      
      // Verify it exists
      let value = await cacheManager.get('delete-key');
      expect(value).to.equal('delete-value');
      
      // Delete it
      await cacheManager.delete('delete-key');
      
      // Should be gone
      value = await cacheManager.get('delete-key');
      expect(value).to.be.null;
    });

    it('should handle deletion of non-existent keys gracefully', async () => {
      // Should not throw error
      await cacheManager.delete('non-existent-key');
      expect(true).to.be.true; // Test passes if no error thrown
    });
  });

  describe('clear()', () => {
    it('should clear all cache entries', async () => {
      // Add multiple entries
      await cacheManager.set('key1', 'value1');
      await cacheManager.set('key2', 'value2');
      await cacheManager.set('key3', 'value3');
      
      // Verify they exist
      expect(await cacheManager.get('key1')).to.equal('value1');
      expect(await cacheManager.get('key2')).to.equal('value2');
      expect(await cacheManager.get('key3')).to.equal('value3');
      
      // Clear all
      await cacheManager.clear();
      
      // Should all be gone
      expect(await cacheManager.get('key1')).to.be.null;
      expect(await cacheManager.get('key2')).to.be.null;
      expect(await cacheManager.get('key3')).to.be.null;
    });

    it('should handle clearing empty cache gracefully', async () => {
      await cacheManager.clear();
      expect(true).to.be.true; // Test passes if no error thrown
    });
  });

  describe('error handling', () => {
    it('should handle read errors gracefully', async () => {
      // Create a cache entry
      await cacheManager.set('corrupt-key', 'test-value');
      
      // Corrupt the file by writing invalid JSON
      const filePath = cacheManager.getCacheFilePath('corrupt-key');
      await fs.writeFile(filePath, 'invalid json content');
      
      // Should return null instead of throwing
      const value = await cacheManager.get('corrupt-key');
      expect(value).to.be.null;
    });

    it('should handle permission errors gracefully', async () => {
      // This test might not work on all systems, but demonstrates error handling
      const restrictedCache = new CacheManager('/root/restricted-cache');
      
      // Should not throw errors, but handle gracefully
      await restrictedCache.set('test-key', 'test-value');
      const value = await restrictedCache.get('test-key');
      
      // May succeed or fail depending on permissions, but should not throw
      expect(true).to.be.true;
    });
  });

  describe('cleanup functionality', () => {
    it('should clean up expired entries during get operations', async () => {
      // Set an entry with very short TTL
      await cacheManager.set('cleanup-key', 'cleanup-value', 1);
      
      // Verify file exists
      const filePath = cacheManager.getCacheFilePath('cleanup-key');
      expect(await fs.pathExists(filePath)).to.be.true;
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Try to get - should trigger cleanup
      const value = await cacheManager.get('cleanup-key');
      expect(value).to.be.null;
      
      // File should be deleted
      expect(await fs.pathExists(filePath)).to.be.false;
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple simultaneous operations', async () => {
      const promises = [];
      
      // Start multiple set operations simultaneously
      for (let i = 0; i < 10; i++) {
        promises.push(cacheManager.set(`concurrent-key-${i}`, `value-${i}`));
      }
      
      await Promise.all(promises);
      
      // Verify all values were set correctly
      for (let i = 0; i < 10; i++) {
        const value = await cacheManager.get(`concurrent-key-${i}`);
        expect(value).to.equal(`value-${i}`);
      }
    });
  });
});