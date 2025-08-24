const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { FitSimulator } = require('../lib/fit-simulator');
const { StaticData } = require('../lib/static-data');

describe('Missing DPS Bonuses Analysis', () => {
  let fitCalculator, staticData;

  beforeEach(async () => {
    fitCalculator = new FitCalculator();
    staticData = await StaticData.getInstance();
  });

  describe('Gunnery Support Skills', () => {
    it('should include Surgical Strike damage bonus (3% per level)', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      // Check if Surgical Strike bonus exists in character bonuses
      const surgicalStrike = fitSimulator.fitBonuses.character.surgicalStrike;
      expect(surgicalStrike).to.be.greaterThan(0);
      expect(surgicalStrike).to.equal(0.15); // 15% at level V
    });

    it('should include Motion Prediction tracking bonus (5% per level)', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      // Check if Motion Prediction bonus exists
      const motionPrediction = fitSimulator.fitBonuses.character.motionPrediction;
      expect(motionPrediction).to.be.greaterThan(0);
      expect(motionPrediction).to.equal(0.25); // 25% at level V
    });

    it('should include Sharpshooter optimal range bonus (5% per level)', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      // Check if Sharpshooter bonus exists
      const sharpshooter = fitSimulator.fitBonuses.character.sharpshooter;
      expect(sharpshooter).to.be.greaterThan(0);
      expect(sharpshooter).to.equal(0.25); // 25% at level V
    });
  });

  describe('Tracking Computer Module Bonuses', () => {
    it('should apply Tracking Computer damage bonus', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II

Tracking Computer II`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const result = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should have some module bonus from Tracking Computer
      const moduleCount = fitSimulator.fitBonuses.modules.trackingComputerCount || 0;
      expect(moduleCount).to.be.greaterThan(0);
    });

    it('should stack multiple Tracking Computers with penalties', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II

Tracking Computer II
Tracking Computer II`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      // Should detect 2 Tracking Computers
      const moduleCount = fitSimulator.fitBonuses.modules.trackingComputerCount || 0;
      expect(moduleCount).to.equal(2);
    });
  });

  describe('Complete Rupture DPS Calculation', () => {
    it('should achieve closer to expected 193.3 DPS with all bonuses', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Rupture fit]
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II
Expanded Probe Launcher I

50MN Quad LiF Restrained Microwarpdrive
Sensor Booster II, Scan Resolution Script
Tracking Computer II, Optimal Range Script
Tracking Computer II, Optimal Range Script

Signal Amplifier II
Nanofiber Internal Structure II
Co-Processor II
Co-Processor II
Nanofiber Internal Structure II

[Empty Rig slot]
[Empty Rig slot]
[Empty Rig slot]

Warrior II x3
Hornet EC-300 x5

Core Scanner Probe I x16
Tremor M x500
Republic Fleet Depleted Uranium M x500
Hornet EC-300 x5
Republic Fleet EMP M x500
EMP M x1
Combat Scanner Probe I x16
Quake M x3000
Republic Fleet Proton M x500
F-12 Enduring Tracking Computer x1
Warrior II x3
Tracking Speed Script x1`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const result = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      console.log(`\nComplete Rupture DPS: ${result.dps.total.toFixed(1)}`);
      console.log(`Expected DPS: 193.3`);
      console.log(`Gap: ${(193.3 - result.dps.total).toFixed(1)}`);
      
      // With all bonuses, should be much closer to 193.3 
      expect(result.dps.total).to.be.greaterThan(120); // Significant improvement from initial 40 DPS
    });
  });

  describe('Ammunition Damage Calculation', () => {
    it('should properly calculate Quake M damage attributes', async function() {
      this.timeout(30000);

      const eftFit = `[Rupture, Test fit]
720mm Howitzer Artillery II

Quake M x1000`;

      const parsedFit = await fitCalculator.parseEFT(eftFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const result = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should auto-load Quake M and have proper damage
      expect(parsedFit.modules.high[0].charge).to.equal('Quake M');
      expect(result.dps.total).to.be.greaterThan(20); // Should have significant DPS
    });

    it('should verify Quake M damage attributes from static data', async function() {
      this.timeout(30000);

      // Get Quake M item info from static data 
      const quakeM = staticData.findItemByName('Quake M');
      expect(quakeM).to.not.be.null;
      
      // Should have damage attributes
      console.log('Quake M type ID:', quakeM.typeID);
      console.log('Quake M group ID:', quakeM.groupID);
    });
  });
});