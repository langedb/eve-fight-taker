const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { FitSimulator } = require('../lib/fit-simulator');
const { CacheManager } = require('../lib/cache-manager');
const { AIAnalyzer } = require('../lib/ai-analyzer');
const path = require('path');
const fs = require('fs-extra');

describe('Integration Tests', () => {
  let staticData;
  let fitCalculator;
  let cacheManager;
  let testCacheDir;

  before(async () => {
    // Initialize static data once for all integration tests
    staticData = new StaticData();
    await staticData.loadStaticData();
    
    fitCalculator = new FitCalculator();
    fitCalculator.staticData = staticData;
    
    // Setup test cache
    testCacheDir = path.join(__dirname, '../test-integration-cache-' + Date.now());
    cacheManager = new CacheManager(testCacheDir);
  });

  after(async () => {
    // Clean up test cache
    if (await fs.pathExists(testCacheDir)) {
      await fs.remove(testCacheDir);
    }
  });

  describe('Complete EFT Processing Pipeline', () => {
    it('should process a complete EFT fit from parsing to DPS calculation', async () => {
      const eftString = `[Rifter, Test Rifter]
Light Missile Launcher II,Scourge Light Missile
[Empty High slot]
[Empty High slot]

Small Shield Extender II
1MN Afterburner II
Warp Scrambler II

Ballistic Control System II
Small Armor Repairer II
Adaptive Nano Plating II

Small Core Defense Field Extender I
Small Anti-EM Screen Reinforcer I
[Empty Rig slot]

Warrior II x3
Hobgoblin II x2

Scourge Light Missile x1000
Warrior II x5`;

      // Step 1: Parse EFT
      const fit = fitCalculator.parseEFT(eftString);
      expect(fit).to.be.an('object');
      expect(fit.shipName).to.equal('Rifter');
      expect(fit.fitName).to.equal('Test Rifter');
      
      // Step 2: Create fit simulator
      const fitSimulator = new FitSimulator(fit, staticData);
      await fitSimulator.applyEffects();
      
      // Step 3: Calculate ship statistics
      const stats = await fitCalculator.calculateShipStats(fit, fitSimulator);
      
      // Verify comprehensive statistics
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats.ehp.total).to.be.greaterThan(0);
      expect(stats.speed).to.be.greaterThan(0);
      expect(stats.signatureRadius).to.be.greaterThan(0);
      
      // Verify weapon stats
      expect(stats.dps.total).to.be.greaterThan(50); // Should have some meaningful DPS
      
      // Verify drone stats are included
      expect(stats.droneDPS).to.be.greaterThan(0); // Has drones fitted
      
      // Verify EHP calculation
      expect(stats.ehp.hull).to.be.greaterThan(0);
      expect(stats.ehp.armor).to.be.greaterThan(0);
      expect(stats.ehp.shield).to.be.greaterThan(0);
    });

    it('should handle missile boats with proper skill bonuses', async () => {
      const caracalEft = `[Caracal, Missile Caracal]
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile

Large Shield Extender II
Large Shield Extender II
Adaptive Invulnerability Field II
10MN Afterburner II

Ballistic Control System II
Ballistic Control System II
Ballistic Control System II
Power Diagnostic System II

Medium Core Defense Field Extender I
Medium Core Defense Field Extender I
[Empty Rig slot]`;

      const fit = fitCalculator.parseEFT(caracalEft);
      const fitSimulator = new FitSimulator(fit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(fit, fitSimulator);
      
      // Should have substantial DPS with 5 launchers and 3 BCS
      expect(stats.dps.total).to.be.greaterThan(200);
      
      // Should have good tank with shield extenders
      expect(stats.ehp.total).to.be.greaterThan(15000);
      
      // Verify damage multipliers are applied correctly
      const launcherDamageMultiplier = await fitSimulator.getModifiedAttribute('Heavy Missile Launcher II', 64);
      expect(launcherDamageMultiplier).to.be.greaterThan(1.5); // Should have significant bonuses
    });
  });

  describe('Static Data Integration', () => {
    it('should find and use weapon and ammo compatibility data', async () => {
      // Test that weapon/ammo compatibility works end-to-end
      const launcher = await staticData.searchItemByName('Light Missile Launcher II');
      const missile = await staticData.searchItemByName('Scourge Light Missile');
      
      expect(launcher).to.not.be.null;
      expect(missile).to.not.be.null;
      
      // Should have damage attributes
      const damageAttrs = missile.attributes.filter(attr => 
        [114, 116, 117, 118].includes(attr.attributeID)
      );
      expect(damageAttrs.length).to.be.greaterThan(0);
      
      // Should be able to create a fit with them
      const testFit = {
        shipName: 'Rifter',
        modules: {
          high: [{ name: 'Light Missile Launcher II', charge: 'Scourge Light Missile' }],
          med: [],
          low: [],
          rig: [],
          subsystem: []
        },
        drones: [],
        cargo: []
      };
      
      const fitSimulator = new FitSimulator(testFit, staticData);
      await fitSimulator.applyEffects();
      
      const missileDamage = await fitSimulator.getModifiedAttribute('Scourge Light Missile', 114);
      expect(missileDamage).to.be.greaterThan(0);
    });
  });

  describe('Cache Integration', () => {
    it('should cache and retrieve fit calculations', async () => {
      const fitKey = 'test-fit-rifter-basic';
      const eftString = `[Rifter, Basic Rifter]
Light Missile Launcher II,Scourge Light Missile

1MN Afterburner II

Ballistic Control System II

Small Anti-EM Screen Reinforcer I`;

      // First calculation - should not be cached
      const fit = fitCalculator.parseEFT(eftString);
      const fitSimulator = new FitSimulator(fit, staticData);
      await fitSimulator.applyEffects();
      const stats1 = await fitCalculator.calculateShipStats(fit, fitSimulator);
      
      // Cache the results
      await cacheManager.set(fitKey, stats1, 3600);
      
      // Retrieve from cache
      const cachedStats = await cacheManager.get(fitKey);
      expect(cachedStats).to.deep.equal(stats1);
      
      // Verify cache hit returns same data
      expect(cachedStats.dps.total).to.equal(stats1.dps.total);
      expect(cachedStats.ehp.total).to.equal(stats1.ehp.total);
    });

    it('should handle cache misses gracefully', async () => {
      const nonExistentStats = await cacheManager.get('non-existent-fit');
      expect(nonExistentStats).to.be.null;
      
      // Should continue to work normally
      const fit = fitCalculator.parseEFT('[Rifter, Test]\nLight Missile Launcher II,Scourge Light Missile');
      expect(fit.shipName).to.equal('Rifter');
    });
  });

  describe('AI Analysis Integration', () => {
    it('should generate fallback analysis when AI is unavailable', () => {
      // Use fake API key to test fallback
      const aiAnalyzer = new AIAnalyzer('fake-key-for-testing');
      
      const currentStats = {
        dps: { total: 200, em: 100, thermal: 100, kinetic: 0, explosive: 0 },
        ehp: { total: 10000, hull: 1000, armor: 4000, shield: 5000 },
        speed: 1200,
        signatureRadius: 40
      };
      
      const targetStats = {
        dps: { total: 150, em: 0, thermal: 150, kinetic: 0, explosive: 0 },
        ehp: { total: 8000, hull: 1000, armor: 3000, shield: 4000 },
        speed: 800,
        signatureRadius: 120
      };
      
      const analysis = aiAnalyzer.getFallbackAnalysis(currentStats, targetStats);
      
      expect(analysis.winChance).to.be.a('string');
      expect(analysis.timeToKill).to.be.a('string');
      expect(analysis.majorAdvantages).to.be.an('array');
      expect(analysis.majorDisadvantages).to.be.an('array');
      expect(analysis.summary).to.include('Mathematical analysis');
    });

    it('should parse and format AI responses correctly', () => {
      const aiAnalyzer = new AIAnalyzer('fake-key');
      
      const markdownText = "**Strong** advantage with *good* range using `afterburner`";
      const html = aiAnalyzer.markdownToHtml(markdownText);
      
      expect(html).to.include('<strong>Strong</strong>');
      expect(html).to.include('<em>good</em>');
      expect(html).to.include('<code>afterburner</code>');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed EFT strings gracefully', async () => {
      const malformedEft = `This is not a valid EFT string at all`;
      
      try {
        const fit = fitCalculator.parseEFT(malformedEft);
        // If parsing succeeds, should still have basic structure
        expect(fit).to.have.property('modules');
      } catch (error) {
        // If parsing fails, error should be meaningful
        expect(error.message).to.be.a('string');
      }
    });

    it('should handle unknown ship types', async () => {
      const unknownShipFit = {
        shipName: 'Unknown Ship Type',
        modules: {
          high: [{ name: 'Light Missile Launcher II', charge: 'Scourge Light Missile' }],
          med: [],
          low: [],
          rig: [],
          subsystem: []
        },
        drones: [],
        cargo: []
      };
      
      const fitSimulator = new FitSimulator(unknownShipFit, staticData);
      await fitSimulator.applyEffects();
      
      // Should not crash, even with unknown ship
      const stats = await fitCalculator.calculateShipStats(unknownShipFit, fitSimulator);
      expect(stats).to.be.an('object');
    });

    it('should handle fits with no weapons', async () => {
      const supportFit = fitCalculator.parseEFT(`[Osprey, Support Osprey]
Remote Shield Booster II
Remote Shield Booster II

Large Shield Extender II
Adaptive Invulnerability Field II

Power Diagnostic System II`);
      
      const fitSimulator = new FitSimulator(supportFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(supportFit, fitSimulator);
      
      // Should have 0 DPS but still calculate other stats
      expect(stats.dps.total).to.equal(0);
      expect(stats.ehp.total).to.be.greaterThan(0);
      expect(stats.speed).to.be.greaterThan(0);
    });
  });

  describe('Performance Integration', () => {
    it('should process multiple fits efficiently', async () => {
      const fits = [
        '[Rifter, Test1]\nLight Missile Launcher II,Scourge Light Missile\n1MN Afterburner II\nBallistic Control System II',
        '[Merlin, Test2]\nLight Blaster II,Antimatter Charge S\n1MN Afterburner II\nMagnetic Field Stabilizer II',
        '[Punisher, Test3]\nPulse Laser II,Multifrequency S\n1MN Afterburner II\nHeat Sink II',
        '[Incursus, Test4]\nLight Blaster II,Void S\n1MN Afterburner II\nMagnetic Field Stabilizer II',
        '[Tormentor, Test5]\nPulse Laser II,Scorch S\n1MN Afterburner II\nHeat Sink II'
      ];
      
      const start = Date.now();
      
      const results = await Promise.all(fits.map(async eftString => {
        const fit = fitCalculator.parseEFT(eftString);
        const fitSimulator = new FitSimulator(fit, staticData);
        await fitSimulator.applyEffects();
        return fitCalculator.calculateShipStats(fit, fitSimulator);
      }));
      
      const elapsed = Date.now() - start;
      
      // Should process all fits in reasonable time (less than 5 seconds)
      expect(elapsed).to.be.lessThan(5000);
      
      // All fits should have been processed successfully
      expect(results.length).to.equal(5);
      results.forEach(stats => {
        expect(stats.dps.total).to.be.greaterThan(0);
        expect(stats.ehp.total).to.be.greaterThan(0);
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent results across multiple calculations', async () => {
      const eftString = `[Caracal, Consistency Test]
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile
Heavy Missile Launcher II,Scourge Heavy Missile

Large Shield Extender II
10MN Afterburner II

Ballistic Control System II
Ballistic Control System II`;
      
      // Calculate same fit multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const fit = fitCalculator.parseEFT(eftString);
        const fitSimulator = new FitSimulator(fit, staticData);
        await fitSimulator.applyEffects();
        const stats = await fitCalculator.calculateShipStats(fit, fitSimulator);
        results.push(stats);
      }
      
      // Results should be identical
      expect(results[0].dps.total).to.equal(results[1].dps.total);
      expect(results[1].dps.total).to.equal(results[2].dps.total);
      expect(results[0].ehp.total).to.equal(results[1].ehp.total);
      expect(results[1].ehp.total).to.equal(results[2].ehp.total);
    });
  });
});