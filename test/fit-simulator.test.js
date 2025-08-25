const { expect } = require('chai');
const { FitSimulator } = require('../lib/fit-simulator');
const { StaticData } = require('../lib/static-data');

describe('FitSimulator', () => {
  let staticData;
  let fitSimulator;

  before(async () => {
    staticData = await StaticData.getInstance();
  });

  beforeEach(() => {
    const testFit = {
      shipName: 'Rifter',
      modules: {
        high: [
          { name: 'Light Missile Launcher II', charge: 'Mjolnir Light Missile' }
        ],
        med: [
          { name: 'Medium Shield Extender II' }
        ],
        low: [
          { name: 'Ballistic Control System II' }
        ],
        rig: [],
        subsystem: []
      },
      drones: [],
      cargo: []
    };
    
    fitSimulator = new FitSimulator(testFit, staticData);
  });

  describe('constructor', () => {
    it('should initialize with fit and static data', () => {
      expect(fitSimulator.fit).to.be.an('object');
      expect(fitSimulator.staticData).to.equal(staticData);
      expect(fitSimulator.shipAttributes).to.be.null;
      expect(fitSimulator.moduleAttributes).to.be.a('map');
      expect(fitSimulator.chargeAttributes).to.be.a('map');
    });
  });

  describe('applyEffects()', () => {
    it('should apply effects without throwing errors', async () => {
      await fitSimulator.applyEffects();
      // Should complete without throwing
      expect(true).to.be.true;
    });

    it('should create attribute stores for ship', async () => {
      await fitSimulator.applyEffects();
      expect(fitSimulator.shipAttributes).to.not.be.null;
    });

    it('should create attribute stores for modules', async () => {
      await fitSimulator.applyEffects();
      const hasLauncher = Array.from(fitSimulator.moduleAttributes.keys()).some(k => k.startsWith('Light Missile Launcher II'));
      const hasShieldExtender = Array.from(fitSimulator.moduleAttributes.keys()).some(k => k.startsWith('Medium Shield Extender II'));
      const hasBCS = Array.from(fitSimulator.moduleAttributes.keys()).some(k => k.startsWith('Ballistic Control System II'));
      expect(hasLauncher).to.be.true;
      expect(hasShieldExtender).to.be.true;
      expect(hasBCS).to.be.true;
    });

    it('should create attribute stores for charges', async () => {
      await fitSimulator.applyEffects();
      expect(fitSimulator.chargeAttributes.has('Mjolnir Light Missile')).to.be.true;
    });

    it('should apply BCS bonuses to missile weapons', async () => {
      await fitSimulator.applyEffects();
      
      const launcherDamageMultiplier = await fitSimulator.getModifiedAttribute('Light Missile Launcher II', 64);
      expect(launcherDamageMultiplier).to.be.greaterThan(1.0); // Should have BCS bonus
    });
  });

  describe('getModifiedAttribute()', () => {
    beforeEach(async () => {
      await fitSimulator.applyEffects();
    });

    it('should return modified ship attributes', async () => {
      const shieldCapacity = await fitSimulator.getModifiedAttribute('Rifter', 263);
      expect(shieldCapacity).to.be.a('number');
      expect(shieldCapacity).to.be.greaterThan(0);
    });

    it('should return modified module attributes', async () => {
      const damageMultiplier = await fitSimulator.getModifiedAttribute('Light Missile Launcher II', 64);
      expect(damageMultiplier).to.be.a('number');
      expect(damageMultiplier).to.be.greaterThan(1.0); // Should have bonuses applied
    });

    it('should return modified charge attributes', async () => {
      const emDamage = await fitSimulator.getModifiedAttribute('Mjolnir Light Missile', 114);
      expect(emDamage).to.be.a('number');
      expect(emDamage).to.be.greaterThan(0);
    });

    it('should return 0 for unknown attributes', async () => {
      const unknownAttr = await fitSimulator.getModifiedAttribute('Rifter', 99999);
      expect(unknownAttr).to.equal(0);
    });

    it('should handle non-existent items gracefully', async () => {
      const unknownItem = await fitSimulator.getModifiedAttribute('NonExistentItem', 64);
      expect(unknownItem).to.equal(0);
    });
  });

  describe('missile weapon detection', () => {
    it('should identify missile weapons correctly', async () => {
      const launcherInfo = await staticData.searchItemByName('Light Missile Launcher II');
      expect(fitSimulator.isMissileWeapon(launcherInfo)).to.be.true;
    });

    it('should not identify non-missile weapons as missile weapons', async () => {
      const turretInfo = await staticData.searchItemByName('Small Pulse Laser II');
      if (turretInfo) {
        expect(fitSimulator.isMissileWeapon(turretInfo)).to.be.false;
      }
    });
  });

  describe('gunnery weapon detection', () => {
    it('should identify gunnery weapons correctly', async () => {
      const turretInfo = await staticData.searchItemByName('Small Pulse Laser II');
      if (turretInfo) {
        expect(fitSimulator.isGunneryWeapon(turretInfo)).to.be.true;
      }
    });

    it('should not identify missile weapons as gunnery weapons', async () => {
      const launcherInfo = await staticData.searchItemByName('Light Missile Launcher II');
      expect(fitSimulator.isGunneryWeapon(launcherInfo)).to.be.false;
    });
  });

  describe('ship classification', () => {
    it('should identify Caldari ships', () => {
      expect(fitSimulator.isCaldariShip('caracal')).to.be.true;
      expect(fitSimulator.isCaldariShip('raven')).to.be.true;
      expect(fitSimulator.isCaldariShip('rifter')).to.be.false;
    });

    it('should identify cruisers', () => {
      expect(fitSimulator.isCruiser('caracal')).to.be.true;
      expect(fitSimulator.isCruiser('osprey')).to.be.true;
      expect(fitSimulator.isCruiser('rifter')).to.be.false;
    });
  });

  describe('skill level helpers', () => {
    it('should return skill level 5 for all skills', () => {
      expect(fitSimulator.getSkillLevel()).to.equal(5);
      expect(fitSimulator.getSkillLevel('Gunnery')).to.equal(5);
      expect(fitSimulator.getSkillLevel('Missile Launcher Operation')).to.equal(5);
    });
  });

  describe('complex fits', () => {
    it('should handle fits with multiple weapon types', async () => {
      const complexFit = {
        shipName: 'Drake',
        modules: {
          high: [
            { name: 'Heavy Missile Launcher II', charge: 'Scourge Heavy Missile' },
            { name: 'Heavy Missile Launcher II', charge: 'Scourge Heavy Missile' },
            { name: 'Heavy Missile Launcher II', charge: 'Scourge Heavy Missile' }
          ],
          med: [
            { name: 'Large Shield Extender II' },
            { name: 'Large Shield Extender II' }
          ],
          low: [
            { name: 'Ballistic Control System II' },
            { name: 'Ballistic Control System II' }
          ],
          rig: [],
          subsystem: []
        },
        drones: [],
        cargo: []
      };

      const complexSimulator = new FitSimulator(complexFit, staticData);
      await complexSimulator.applyEffects();

      // Should have applied bonuses to all launchers
      const launcher1DamageMultiplier = await complexSimulator.getModifiedAttribute('Heavy Missile Launcher II', 64);
      expect(launcher1DamageMultiplier).to.be.greaterThan(1.0);
    });

    it('should handle fits with no weapons', async () => {
      const supportFit = {
        shipName: 'Osprey',
        modules: {
          high: [
            { name: 'Small Remote Shield Booster II' }
          ],
          med: [
            { name: 'Large Shield Extender II' }
          ],
          low: [
            { name: 'Power Diagnostic System II' }
          ],
          rig: [],
          subsystem: []
        },
        drones: [],
        cargo: []
      };

      const supportSimulator = new FitSimulator(supportFit, staticData);
      await supportSimulator.applyEffects();

      // Should complete without errors even with no weapons
      expect(true).to.be.true;
    });
  });

  describe('error handling', () => {
    it('should handle unknown ship names gracefully', async () => {
      const badFit = {
        shipName: 'NonExistentShip',
        modules: { high: [], med: [], low: [], rig: [], subsystem: [] },
        drones: [],
        cargo: []
      };

      const badSimulator = new FitSimulator(badFit, staticData);
      await badSimulator.applyEffects();
      
      // Should not crash
      expect(true).to.be.true;
    });

    it('should handle unknown module names gracefully', async () => {
      const badFit = {
        shipName: 'Rifter',
        modules: {
          high: [{ name: 'NonExistentModule' }],
          med: [],
          low: [],
          rig: [],
          subsystem: []
        },
        drones: [],
        cargo: []
      };

      const badSimulator = new FitSimulator(badFit, staticData);
      await badSimulator.applyEffects();
      
      // Should not crash
      expect(true).to.be.true;
    });
  });
});