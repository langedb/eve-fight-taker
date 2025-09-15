const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs-extra');
const log = require('./logger');

class DatabaseManager {
  constructor(dbPath = './data/fleet-manager.db') {
    this.dbPath = dbPath;
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      await fs.ensureDir(dataDir);

      // Initialize database
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      // Create tables
      await this.createTables();

      this.initialized = true;
      log.info(`Database initialized at ${this.dbPath}`);
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw error;
    }
  }

  async createTables() {
    const tables = [
      // Character fittings storage
      `CREATE TABLE IF NOT EXISTS fittings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        ship_type_id INTEGER NOT NULL,
        ship_name TEXT NOT NULL,
        eft_format TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(character_id, name)
      )`,

      // Fleet compositions
      `CREATE TABLE IF NOT EXISTS fleets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(character_id, name)
      )`,

      // Fleet ship assignments
      `CREATE TABLE IF NOT EXISTS fleet_ships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fleet_id INTEGER NOT NULL,
        fitting_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        role TEXT DEFAULT 'line',
        notes TEXT,
        FOREIGN KEY (fleet_id) REFERENCES fleets (id) ON DELETE CASCADE,
        FOREIGN KEY (fitting_id) REFERENCES fittings (id) ON DELETE CASCADE
      )`,

      // Fleet vs Fleet battle scenarios
      `CREATE TABLE IF NOT EXISTS battle_scenarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        friendly_fleet_id INTEGER NOT NULL,
        enemy_fleet_id INTEGER NOT NULL,
        scenario_notes TEXT,
        last_analysis TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (friendly_fleet_id) REFERENCES fleets (id) ON DELETE CASCADE,
        FOREIGN KEY (enemy_fleet_id) REFERENCES fleets (id) ON DELETE CASCADE,
        UNIQUE(character_id, name)
      )`,

      // Fleet analysis results cache
      `CREATE TABLE IF NOT EXISTS fleet_analysis_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fleet_hash TEXT NOT NULL UNIQUE,
        analysis_data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )`
    ];

    for (const table of tables) {
      this.db.exec(table);
    }

    // Create indexes for performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_fittings_character ON fittings (character_id)',
      'CREATE INDEX IF NOT EXISTS idx_fleets_character ON fleets (character_id)',
      'CREATE INDEX IF NOT EXISTS idx_fleet_ships_fleet ON fleet_ships (fleet_id)',
      'CREATE INDEX IF NOT EXISTS idx_battle_scenarios_character ON battle_scenarios (character_id)',
      'CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires ON fleet_analysis_cache (expires_at)'
    ];

    for (const index of indexes) {
      this.db.exec(index);
    }

    log.info('Database tables and indexes created successfully');
  }

  // Prepared statement cache
  getStatement(sql) {
    if (!this.statements) {
      this.statements = new Map();
    }

    if (!this.statements.has(sql)) {
      this.statements.set(sql, this.db.prepare(sql));
    }

    return this.statements.get(sql);
  }

  // Transaction wrapper
  transaction(fn) {
    return this.db.transaction(fn);
  }

  // Clean up expired cache entries
  cleanupExpiredCache() {
    const stmt = this.getStatement('DELETE FROM fleet_analysis_cache WHERE expires_at < datetime("now")');
    const result = stmt.run();
    if (result.changes > 0) {
      log.debug(`Cleaned up ${result.changes} expired cache entries`);
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
      log.info('Database connection closed');
    }
  }
}

// Export singleton instance
const dbManager = new DatabaseManager();
module.exports = { DatabaseManager, dbManager };
