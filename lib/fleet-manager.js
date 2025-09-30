const { dbManager } = require('./database');
const log = require('./logger');
const crypto = require('crypto');
const { FitCalculator } = require('./fit-calculator');

class FleetManager {
  constructor() {
    this.db = dbManager;
    this.fitCalculator = new FitCalculator();
  }

  async initialize() {
    await this.db.initialize();
  }

  // ========== FITTING MANAGEMENT ==========

  async saveFitting(characterId, name, shipTypeId, shipName, eftFormat) {
    const stmt = this.db.getStatement(`
      INSERT OR REPLACE INTO fittings (character_id, name, ship_type_id, ship_name, eft_format, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `);

    try {
      const result = stmt.run(characterId, name, shipTypeId, shipName, eftFormat);
      log.debug(`Saved fitting '${name}' for character ${characterId}`);
      return result.lastInsertRowid;
    } catch (error) {
      log.error(`Failed to save fitting '${name}':`, error);
      throw new Error(`Failed to save fitting: ${error.message}`);
    }
  }

  async getFitting(characterId, fittingId) {
    const stmt = this.db.getStatement(`
      SELECT * FROM fittings
      WHERE character_id = ? AND id = ?
    `);

    return stmt.get(characterId, fittingId);
  }

  async getFittings(characterId, limit = 100, offset = 0) {
    const stmt = this.db.getStatement(`
      SELECT * FROM fittings
      WHERE character_id = ?
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(characterId, limit, offset);
  }

  async searchFittings(characterId, query) {
    const stmt = this.db.getStatement(`
      SELECT * FROM fittings
      WHERE character_id = ?
        AND (name LIKE ? OR ship_name LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 50
    `);

    const searchTerm = `%${query}%`;
    return stmt.all(characterId, searchTerm, searchTerm);
  }

  async updateFitting(characterId, fittingId, name, shipTypeId, shipName, eftFormat) {
    const stmt = this.db.getStatement(`
      UPDATE fittings
      SET name = ?, ship_type_id = ?, ship_name = ?, eft_format = ?, updated_at = datetime('now')
      WHERE character_id = ? AND id = ?
    `);

    try {
      const result = stmt.run(name, shipTypeId, shipName, eftFormat, characterId, fittingId);
      if (result.changes > 0) {
        log.debug(`Updated fitting ${fittingId} for character ${characterId}`);
        return true;
      }
      return false;
    } catch (error) {
      log.error(`Failed to update fitting ${fittingId}:`, error);
      throw new Error(`Failed to update fitting: ${error.message}`);
    }
  }

  async deleteFitting(characterId, fittingId) {
    const stmt = this.db.getStatement(`
      DELETE FROM fittings
      WHERE character_id = ? AND id = ?
    `);

    const result = stmt.run(characterId, fittingId);
    return result.changes > 0;
  }

  // ========== FLEET MANAGEMENT ==========

  async createFleet(characterId, name, description = '') {
    const stmt = this.db.getStatement(`
      INSERT INTO fleets (character_id, name, description)
      VALUES (?, ?, ?)
    `);

    try {
      const result = stmt.run(characterId, name, description);
      log.debug(`Created fleet '${name}' for character ${characterId}`);
      return result.lastInsertRowid;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Fleet '${name}' already exists`);
      }
      log.error(`Failed to create fleet '${name}':`, error);
      throw new Error(`Failed to create fleet: ${error.message}`);
    }
  }

  async getFleet(characterId, fleetId) {
    const stmt = this.db.getStatement(`
      SELECT f.*,
        COUNT(fs.id) as ship_count,
        SUM(fs.quantity) as total_ships
      FROM fleets f
      LEFT JOIN fleet_ships fs ON f.id = fs.fleet_id
      WHERE f.character_id = ? AND f.id = ?
      GROUP BY f.id
    `);

    return stmt.get(characterId, fleetId);
  }

  async getFleets(characterId, limit = 50, offset = 0) {
    const stmt = this.db.getStatement(`
      SELECT f.*,
        COUNT(fs.id) as ship_count,
        SUM(fs.quantity) as total_ships
      FROM fleets f
      LEFT JOIN fleet_ships fs ON f.id = fs.fleet_id
      WHERE f.character_id = ?
      GROUP BY f.id
      ORDER BY f.updated_at DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(characterId, limit, offset);
  }

  async updateFleet(characterId, fleetId, name, description) {
    const stmt = this.db.getStatement(`
      UPDATE fleets
      SET name = ?, description = ?, updated_at = datetime('now')
      WHERE character_id = ? AND id = ?
    `);

    const result = stmt.run(name, description, characterId, fleetId);
    return result.changes > 0;
  }

  async deleteFleet(characterId, fleetId) {
    const stmt = this.db.getStatement(`
      DELETE FROM fleets
      WHERE character_id = ? AND id = ?
    `);

    const result = stmt.run(characterId, fleetId);
    return result.changes > 0;
  }

  // ========== FLEET SHIP MANAGEMENT ==========

  async addShipToFleet(fleetId, fittingId, quantity = 1, role = 'line', notes = '') {
    // Verify fleet and fitting exist and belong to same character
    const verifyStmt = this.db.getStatement(`
      SELECT f.character_id as fleet_char, fit.character_id as fitting_char
      FROM fleets f, fittings fit
      WHERE f.id = ? AND fit.id = ?
    `);

    const verification = verifyStmt.get(fleetId, fittingId);
    if (!verification) {
      throw new Error('Fleet or fitting not found');
    }
    if (verification.fleet_char !== verification.fitting_char) {
      throw new Error('Fleet and fitting must belong to same character');
    }

    const stmt = this.db.getStatement(`
      INSERT INTO fleet_ships (fleet_id, fitting_id, quantity, role, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(fleetId, fittingId, quantity, role, notes);
      log.debug(`Added ${quantity} ships to fleet ${fleetId}`);
      return result.lastInsertRowid;
    } catch (error) {
      log.error('Failed to add ship to fleet:', error);
      throw new Error(`Failed to add ship to fleet: ${error.message}`);
    }
  }

  async getFleetComposition(fleetId) {
    const stmt = this.db.getStatement(`
      SELECT fs.*,
        fit.name as fitting_name,
        fit.ship_name,
        fit.ship_type_id,
        fit.eft_format
      FROM fleet_ships fs
      JOIN fittings fit ON fs.fitting_id = fit.id
      WHERE fs.fleet_id = ?
      ORDER BY fs.role, fit.ship_name, fit.name
    `);

    return stmt.all(fleetId);
  }

  async updateFleetShip(fleetShipId, quantity, role, notes) {
    const stmt = this.db.getStatement(`
      UPDATE fleet_ships
      SET quantity = ?, role = ?, notes = ?
      WHERE id = ?
    `);

    const result = stmt.run(quantity, role, notes, fleetShipId);
    return result.changes > 0;
  }

  async removeShipFromFleet(fleetShipId) {
    const stmt = this.db.getStatement(`
      DELETE FROM fleet_ships
      WHERE id = ?
    `);

    const result = stmt.run(fleetShipId);
    return result.changes > 0;
  }

  // ========== BATTLE SCENARIO MANAGEMENT ==========

  async createBattleScenario(characterId, name, friendlyFleetId, enemyFleetId, scenarioNotes = '') {
    const stmt = this.db.getStatement(`
      INSERT INTO battle_scenarios (character_id, name, friendly_fleet_id, enemy_fleet_id, scenario_notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      const result = stmt.run(characterId, name, friendlyFleetId, enemyFleetId, scenarioNotes);
      log.debug(`Created battle scenario '${name}' for character ${characterId}`);
      return result.lastInsertRowid;
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Battle scenario '${name}' already exists`);
      }
      log.error(`Failed to create battle scenario '${name}':`, error);
      throw new Error(`Failed to create battle scenario: ${error.message}`);
    }
  }

  async getBattleScenario(characterId, scenarioId) {
    const stmt = this.db.getStatement(`
      SELECT bs.*,
        ff.name as friendly_fleet_name,
        ef.name as enemy_fleet_name
      FROM battle_scenarios bs
      JOIN fleets ff ON bs.friendly_fleet_id = ff.id
      JOIN fleets ef ON bs.enemy_fleet_id = ef.id
      WHERE bs.character_id = ? AND bs.id = ?
    `);

    return stmt.get(characterId, scenarioId);
  }

  async getBattleScenarios(characterId, limit = 50, offset = 0) {
    const stmt = this.db.getStatement(`
      SELECT bs.*,
        ff.name as friendly_fleet_name,
        ef.name as enemy_fleet_name
      FROM battle_scenarios bs
      JOIN fleets ff ON bs.friendly_fleet_id = ff.id
      JOIN fleets ef ON bs.enemy_fleet_id = ef.id
      WHERE bs.character_id = ?
      ORDER BY bs.updated_at DESC
      LIMIT ? OFFSET ?
    `);

    return stmt.all(characterId, limit, offset);
  }

  async updateBattleScenario(characterId, scenarioId, updates) {
    const { name, friendlyFleetId, enemyFleetId, scenarioNotes } = updates;

    const stmt = this.db.getStatement(`
      UPDATE battle_scenarios
      SET name = ?, friendly_fleet_id = ?, enemy_fleet_id = ?, scenario_notes = ?, updated_at = datetime('now')
      WHERE character_id = ? AND id = ?
    `);

    const result = stmt.run(name, friendlyFleetId, enemyFleetId, scenarioNotes, characterId, scenarioId);
    return result.changes > 0;
  }

  async deleteBattleScenario(characterId, scenarioId) {
    const stmt = this.db.getStatement(`
      DELETE FROM battle_scenarios
      WHERE character_id = ? AND id = ?
    `);

    const result = stmt.run(characterId, scenarioId);
    return result.changes > 0;
  }

  // ========== FLEET ANALYSIS CACHE ==========

  generateFleetHash(fleetComposition) {
    // Create deterministic hash based on fleet composition
    const sortedComp = fleetComposition
      .map(ship => `${ship.fitting_id}:${ship.quantity}:${ship.role}`)
      .sort()
      .join('|');

    return crypto.createHash('sha256').update(sortedComp).digest('hex');
  }

  async getCachedAnalysis(fleetHash) {
    const stmt = this.db.getStatement(`
      SELECT analysis_data
      FROM fleet_analysis_cache
      WHERE fleet_hash = ? AND expires_at > datetime('now')
    `);

    const result = stmt.get(fleetHash);
    return result ? JSON.parse(result.analysis_data) : null;
  }

  async setCachedAnalysis(fleetHash, analysisData, ttlHours = 24) {
    const stmt = this.db.getStatement(`
      INSERT OR REPLACE INTO fleet_analysis_cache (fleet_hash, analysis_data, expires_at)
      VALUES (?, ?, datetime('now', '+${ttlHours} hours'))
    `);

    stmt.run(fleetHash, JSON.stringify(analysisData));
  }

  // ========== UTILITY METHODS ==========

  async getFleetStatsSummary(fleetId) {
    const composition = await this.getFleetComposition(fleetId);

    if (composition.length === 0) {
      return {
        total_ships: 0,
        ship_types: 0,
        roleBreakdown: {},
        shipClasses: {},
        total_dps: 0,
        total_ehp: 0
      };
    }

    const totalShips = composition.reduce((sum, ship) => sum + ship.quantity, 0);
    const shipTypes = composition.length;

    const roleBreakdown = {};
    const shipClasses = {};
    let totalDps = 0;
    let totalEhp = 0;

    // Calculate DPS and EHP for each ship type in the fleet
    for (const ship of composition) {
      // Count by role
      roleBreakdown[ship.role] = (roleBreakdown[ship.role] || 0) + ship.quantity;

      // Count by ship class (extracted from ship name)
      const shipClass = this.extractShipClass(ship.ship_name);
      shipClasses[shipClass] = (shipClasses[shipClass] || 0) + ship.quantity;

      // Calculate ship stats if EFT format is available
      if (ship.eft_format) {
        try {
          // First parse the EFT format
          const parsedFit = await this.fitCalculator.parseEFT(ship.eft_format);
          if (parsedFit) {
            // Then calculate the stats
            const shipStats = await this.fitCalculator.calculateFitStats(parsedFit);
            if (shipStats) {
              // Add DPS and EHP multiplied by quantity
              totalDps += (shipStats.dps?.total || 0) * ship.quantity;
              totalEhp += (shipStats.ehp?.total || 0) * ship.quantity;
            }
          }
        } catch (error) {
          log.warn(`Failed to calculate stats for ship ${ship.fitting_name}:`, error.message);
        }
      }
    }

    return {
      total_ships: totalShips,
      ship_types: shipTypes,
      roleBreakdown,
      shipClasses,
      composition,
      total_dps: Math.round(totalDps),
      total_ehp: Math.round(totalEhp)
    };
  }

  extractShipClass(shipName) {
    const frigates = ['rifter', 'punisher', 'merlin', 'incursus', 'slasher', 'tormentor', 'kestrel', 'atron'];
    const destroyers = ['thrasher', 'coercer', 'cormorant', 'catalyst', 'talwar', 'dragoon', 'corax', 'algos'];
    const cruisers = ['stabber', 'omen', 'caracal', 'thorax', 'rupture', 'maller', 'osprey', 'vexor'];
    const battlecruisers = ['hurricane', 'harbinger', 'ferox', 'brutix', 'cyclone', 'prophecy', 'drake', 'myrmidon'];
    const battleships = ['tempest', 'apocalypse', 'rokh', 'megathron', 'typhoon', 'armageddon', 'scorpion', 'dominix'];

    const lowerName = shipName.toLowerCase();

    if (frigates.some(frig => lowerName.includes(frig))) return 'Frigate';
    if (destroyers.some(dest => lowerName.includes(dest))) return 'Destroyer';
    if (cruisers.some(crui => lowerName.includes(crui))) return 'Cruiser';
    if (battlecruisers.some(bc => lowerName.includes(bc))) return 'Battlecruiser';
    if (battleships.some(bs => lowerName.includes(bs))) return 'Battleship';

    return 'Other';
  }

  // Cleanup method to be called periodically
  async cleanup() {
    this.db.cleanupExpiredCache();
  }
}

module.exports = { FleetManager };
