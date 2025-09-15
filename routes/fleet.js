const express = require('express');
const crypto = require('crypto');
const { FleetManager } = require('../lib/fleet-manager');
const { FleetAnalyzer } = require('../lib/fleet-analyzer');
const { FitCalculator } = require('../lib/fit-calculator');
const log = require('../lib/logger');

const router = express.Router();

// Initialize services
const fleetManager = new FleetManager();
const fleetAnalyzer = new FleetAnalyzer(process.env.GOOGLE_API_KEY);
const fitCalculator = new FitCalculator();

// Initialize on startup
(async () => {
  await fleetManager.initialize();
  await fleetAnalyzer.initialize();
  log.info('Fleet management services initialized');
})();

// Middleware to check authentication
function requireAuth(req, res, next) {
  log.debug('requireAuth check - session:', {
    hasSession: !!req.session,
    hasCharacter: !!req.session?.character,
    character: req.session?.character
  });

  if (!req.session.character) {
    log.error('Authentication failed - no character in session');
    return res.status(401).json({ error: 'Authentication required' });
  }

  log.debug('Authentication successful - character_id:', req.session.character.id);
  next();
}

// ========== FITTING MANAGEMENT ==========

// Save a fitting
router.post('/fittings', requireAuth, async (req, res) => {
  try {
    const { name, shipTypeId, shipName, eftFormat } = req.body;
    const characterId = req.session.character.id;

    if (!name || !shipTypeId || !shipName || !eftFormat) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const fittingId = await fleetManager.saveFitting(characterId, name, shipTypeId, shipName, eftFormat);

    res.json({
      success: true,
      fittingId,
      message: `Fitting '${name}' saved successfully`
    });
  } catch (error) {
    log.error('Save fitting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's fittings
router.get('/fittings', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search;

    let fittings;
    if (search) {
      fittings = await fleetManager.searchFittings(characterId, search);
    } else {
      fittings = await fleetManager.getFittings(characterId, limit, offset);
    }

    res.json({ fittings });
  } catch (error) {
    log.error('Get fittings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific fitting
router.get('/fittings/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const fittingId = parseInt(req.params.id);

    const fitting = await fleetManager.getFitting(characterId, fittingId);
    if (!fitting) {
      return res.status(404).json({ error: 'Fitting not found' });
    }

    res.json({ fitting });
  } catch (error) {
    log.error('Get fitting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete fitting
router.delete('/fittings/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const fittingId = parseInt(req.params.id);

    const deleted = await fleetManager.deleteFitting(characterId, fittingId);
    if (!deleted) {
      return res.status(404).json({ error: 'Fitting not found' });
    }

    res.json({ success: true, message: 'Fitting deleted successfully' });
  } catch (error) {
    log.error('Delete fitting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Parse EFT string
router.post('/fittings/parse', requireAuth, async (req, res) => {
  try {
    const { eftFormat } = req.body;
    if (!eftFormat) {
      return res.status(400).json({ error: 'EFT format is required' });
    }

    const parsedFit = await fitCalculator.parseEFT(eftFormat);

    // Get ship type ID
    const shipInfo = await fitCalculator.getItemByName(parsedFit.shipType);
    if (shipInfo) {
      parsedFit.shipTypeId = shipInfo.type_id;
    }

    // Enrich modules with icon IDs
    for (const slotType of Object.keys(parsedFit.modules)) {
      for (const module of parsedFit.modules[slotType]) {
        const itemInfo = await fitCalculator.getItemByName(module.name);
        if (itemInfo) {
          module.type_id = itemInfo.type_id;
          module.icon_id = itemInfo.icon_id;
        }
      }
    }

    res.json({ parsedFit });
  } catch (error) {
    log.error('Parse EFT error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== FLEET MANAGEMENT ==========

// Create fleet
router.post('/fleets', requireAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const characterId = req.session.character.id;

    if (!name) {
      return res.status(400).json({ error: 'Fleet name is required' });
    }

    const fleetId = await fleetManager.createFleet(characterId, name, description);

    res.json({
      success: true,
      fleetId,
      message: `Fleet '${name}' created successfully`
    });
  } catch (error) {
    log.error('Create fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's fleets
router.get('/fleets', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const fleets = await fleetManager.getFleets(characterId, limit, offset);

    res.json({ fleets });
  } catch (error) {
    log.error('Get fleets error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific fleet with composition
router.get('/fleets/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const fleetId = parseInt(req.params.id);

    const fleet = await fleetManager.getFleet(characterId, fleetId);
    if (!fleet) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    const composition = await fleetManager.getFleetComposition(fleetId);
    const stats = await fleetManager.getFleetStatsSummary(fleetId);

    res.json({
      fleet,
      composition,
      stats
    });
  } catch (error) {
    log.error('Get fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update fleet
router.put('/fleets/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const fleetId = parseInt(req.params.id);
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Fleet name is required' });
    }

    const updated = await fleetManager.updateFleet(characterId, fleetId, name, description);
    if (!updated) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json({ success: true, message: 'Fleet updated successfully' });
  } catch (error) {
    log.error('Update fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete fleet
router.delete('/fleets/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const fleetId = parseInt(req.params.id);

    const deleted = await fleetManager.deleteFleet(characterId, fleetId);
    if (!deleted) {
      return res.status(404).json({ error: 'Fleet not found' });
    }

    res.json({ success: true, message: 'Fleet deleted successfully' });
  } catch (error) {
    log.error('Delete fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== FLEET SHIP MANAGEMENT ==========

// Add ship to fleet
router.post('/fleets/:id/ships', requireAuth, async (req, res) => {
  try {
    const fleetId = parseInt(req.params.id);
    const { fittingId, quantity, role, notes } = req.body;

    if (!fittingId) {
      return res.status(400).json({ error: 'Fitting ID is required' });
    }

    const shipId = await fleetManager.addShipToFleet(
      fleetId,
      fittingId,
      quantity || 1,
      role || 'line',
      notes || ''
    );

    res.json({
      success: true,
      shipId,
      message: 'Ship added to fleet successfully'
    });
  } catch (error) {
    log.error('Add ship to fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update fleet ship
router.put('/fleet-ships/:id', requireAuth, async (req, res) => {
  try {
    const shipId = parseInt(req.params.id);
    const { quantity, role, notes } = req.body;

    const updated = await fleetManager.updateFleetShip(shipId, quantity, role, notes);
    if (!updated) {
      return res.status(404).json({ error: 'Fleet ship not found' });
    }

    res.json({ success: true, message: 'Fleet ship updated successfully' });
  } catch (error) {
    log.error('Update fleet ship error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove ship from fleet
router.delete('/fleet-ships/:id', requireAuth, async (req, res) => {
  try {
    const shipId = parseInt(req.params.id);

    const deleted = await fleetManager.removeShipFromFleet(shipId);
    if (!deleted) {
      return res.status(404).json({ error: 'Fleet ship not found' });
    }

    res.json({ success: true, message: 'Ship removed from fleet successfully' });
  } catch (error) {
    log.error('Remove ship from fleet error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== BATTLE SCENARIO MANAGEMENT ==========

// Create battle scenario
router.post('/scenarios', requireAuth, async (req, res) => {
  try {
    const { name, friendlyFleetId, enemyFleetId, scenarioNotes } = req.body;
    const characterId = req.session.character.id;

    if (!name || !friendlyFleetId || !enemyFleetId) {
      return res.status(400).json({ error: 'Name, friendly fleet, and enemy fleet are required' });
    }

    const scenarioId = await fleetManager.createBattleScenario(
      characterId,
      name,
      friendlyFleetId,
      enemyFleetId,
      scenarioNotes
    );

    res.json({
      success: true,
      scenarioId,
      message: `Battle scenario '${name}' created successfully`
    });
  } catch (error) {
    log.error('Create battle scenario error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get battle scenarios
router.get('/scenarios', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const scenarios = await fleetManager.getBattleScenarios(characterId, limit, offset);

    res.json({ scenarios });
  } catch (error) {
    log.error('Get battle scenarios error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific battle scenario
router.get('/scenarios/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const scenarioId = parseInt(req.params.id);

    const scenario = await fleetManager.getBattleScenario(characterId, scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Battle scenario not found' });
    }

    res.json({ scenario });
  } catch (error) {
    log.error('Get battle scenario error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete battle scenario
router.delete('/scenarios/:id', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const scenarioId = parseInt(req.params.id);

    const deleted = await fleetManager.deleteBattleScenario(characterId, scenarioId);
    if (!deleted) {
      return res.status(404).json({ error: 'Battle scenario not found' });
    }

    res.json({ success: true, message: 'Battle scenario deleted successfully' });
  } catch (error) {
    log.error('Delete battle scenario error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== FLEET VS FLEET ANALYSIS ==========

// Analyze fleet vs fleet battle
router.post('/analyze/:scenarioId', requireAuth, async (req, res) => {
  try {
    const characterId = req.session.character.id;
    const scenarioId = parseInt(req.params.scenarioId);

    // Get scenario details
    const scenario = await fleetManager.getBattleScenario(characterId, scenarioId);
    if (!scenario) {
      return res.status(404).json({ error: 'Battle scenario not found' });
    }

    // Get fleet compositions
    const friendlyComposition = await fleetManager.getFleetComposition(scenario.friendly_fleet_id);
    const enemyComposition = await fleetManager.getFleetComposition(scenario.enemy_fleet_id);

    if (friendlyComposition.length === 0 || enemyComposition.length === 0) {
      return res.status(400).json({ error: 'Both fleets must have ships to analyze' });
    }

    // Check cache first, unless explicitly bypassed
    const noCache = req.query['no-cache'] === 'true';
    const friendlyHash = fleetManager.generateFleetHash(friendlyComposition);
    const enemyHash = fleetManager.generateFleetHash(enemyComposition);
    const combinedHash = crypto.createHash('sha256').update(friendlyHash + enemyHash).digest('hex');

    if (!noCache) {
      let cachedResult = await fleetManager.getCachedAnalysis(combinedHash);
      if (cachedResult) {
        log.debug(`Using cached fleet analysis for scenario ${scenarioId}`);
        return res.json({ analysis: cachedResult, cached: true });
      }
    }

    // Perform analysis
    const friendlyFleet = {
      name: scenario.friendly_fleet_name,
      composition: friendlyComposition
    };

    const enemyFleet = {
      name: scenario.enemy_fleet_name,
      composition: enemyComposition
    };

    const analysis = await fleetAnalyzer.analyzeFleetVsFleet(friendlyFleet, enemyFleet, {
      notes: scenario.scenario_notes
    });

    // Cache the result for 1 hour
    await fleetManager.setCachedAnalysis(combinedHash, analysis, 1);

    res.json({ analysis, cached: false });
  } catch (error) {
    log.error('Fleet analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Quick fleet comparison (without saving scenario)
router.post('/compare', requireAuth, async (req, res) => {
  try {
    const { friendlyFleetId, enemyFleetId, notes } = req.body;
    const characterId = req.session.character.id;

    if (!friendlyFleetId || !enemyFleetId) {
      return res.status(400).json({ error: 'Both fleet IDs are required' });
    }

    // Verify fleet ownership
    const friendlyFleet = await fleetManager.getFleet(characterId, friendlyFleetId);
    const enemyFleet = await fleetManager.getFleet(characterId, enemyFleetId);

    if (!friendlyFleet || !enemyFleet) {
      return res.status(404).json({ error: 'One or both fleets not found' });
    }

    // Get compositions
    const friendlyComposition = await fleetManager.getFleetComposition(friendlyFleetId);
    const enemyComposition = await fleetManager.getFleetComposition(enemyFleetId);

    if (friendlyComposition.length === 0 || enemyComposition.length === 0) {
      return res.status(400).json({ error: 'Both fleets must have ships to analyze' });
    }

    const analysis = await fleetAnalyzer.analyzeFleetVsFleet(
      { name: friendlyFleet.name, composition: friendlyComposition },
      { name: enemyFleet.name, composition: enemyComposition },
      { notes }
    );

    res.json({ analysis });
  } catch (error) {
    log.error('Fleet comparison error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;