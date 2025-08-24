const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { FitSimulator } = require('../lib/fit-simulator');

describe('EHP Calculation', () => {
  let staticData, fitCalculator;

  before(async () => {
    staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator = new FitCalculator(staticData);
  });

  describe('Resistance to EHP Conversion', () => {
    it('should calculate positive EHP values, not negative', async () => {
      // Test with a simple shield-tanked ship
      const testFit = `[Caracal, EHP Test]
Ballistic Control System II

Large Shield Extender II
Adaptive Invulnerability Field II

Light Missile Launcher II

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // EHP should always be positive
      expect(stats.ehp.shield).to.be.greaterThan(0);
      expect(stats.ehp.armor).to.be.greaterThan(0);
      expect(stats.ehp.hull).to.be.greaterThan(0);
      expect(stats.ehp.total).to.be.greaterThan(0);

      // Total EHP should be sum of all layers
      expect(stats.ehp.total).to.be.approximately(
        stats.ehp.shield + stats.ehp.armor + stats.ehp.hull, 1
      );
    });

    it('should handle high resistance values correctly', async () => {
      // Test with a heavily tanked ship
      const testFit = `[Dominix, Heavy Tank]
Damage Control II
Reactive Armor Hardener

Large Shield Extender II
Adaptive Invulnerability Field II
EM Ward Field II

Heavy Neutron Blaster II

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Even with high resistances, EHP should be positive and reasonable
      expect(stats.ehp.shield).to.be.greaterThan(0);
      expect(stats.ehp.armor).to.be.greaterThan(0);
      expect(stats.ehp.hull).to.be.greaterThan(0);
      expect(stats.ehp.total).to.be.greaterThan(0);

      // EHP should be significantly higher than raw HP due to resistances
      expect(stats.ehp.total).to.be.greaterThan(10000); // Should be much higher than base HP
    });

    it('should never return NaN or Infinity for EHP', async () => {
      const testFit = `[Punisher, Resistance Test]
Damage Control II

1MN Afterburner II

Small Focused Pulse Laser II

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Check for invalid values
      expect(stats.ehp.shield).to.be.a('number').and.not.NaN;
      expect(stats.ehp.armor).to.be.a('number').and.not.NaN;
      expect(stats.ehp.hull).to.be.a('number').and.not.NaN;
      expect(stats.ehp.total).to.be.a('number').and.not.NaN;

      expect(stats.ehp.shield).to.be.finite;
      expect(stats.ehp.armor).to.be.finite;
      expect(stats.ehp.hull).to.be.finite;
      expect(stats.ehp.total).to.be.finite;
    });
  });

  describe('Resistance Calculation Logic', () => {
    it('should correctly convert resonance values to resistance percentages', async () => {
      const testFit = `[Merlin, Shield Resistance Test]
Damage Control II

Medium Shield Extender II
EM Ward Field II

Light Electron Blaster II

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Resistance percentages should be between 0 and 100
      expect(stats.shieldResistances.em).to.be.within(0, 100);
      expect(stats.shieldResistances.thermal).to.be.within(0, 100);
      expect(stats.shieldResistances.kinetic).to.be.within(0, 100);
      expect(stats.shieldResistances.explosive).to.be.within(0, 100);

      expect(stats.armorResistances.em).to.be.within(0, 100);
      expect(stats.armorResistances.thermal).to.be.within(0, 100);
      expect(stats.armorResistances.kinetic).to.be.within(0, 100);
      expect(stats.armorResistances.explosive).to.be.within(0, 100);

      expect(stats.hullResistances.em).to.be.within(0, 100);
      expect(stats.hullResistances.thermal).to.be.within(0, 100);
      expect(stats.hullResistances.kinetic).to.be.within(0, 100);
      expect(stats.hullResistances.explosive).to.be.within(0, 100);
    });

    it('should calculate higher EHP for ships with resistance modules', async () => {
      // Test without resistance modules
      const noResistanceFit = `[Caracal, No Resistance]
Ballistic Control System II

Large Shield Extender II

Light Missile Launcher II

`;

      // Test with resistance modules - use modules that exist in static data
      const withResistanceFit = `[Caracal, With Resistance]
Ballistic Control System II
Damage Control II

Large Shield Extender II

Light Missile Launcher II

`;

      const parsedNoRes = await fitCalculator.parseEFT(noResistanceFit);
      const fitSimulatorNoRes = new FitSimulator(parsedNoRes, staticData);
      await fitSimulatorNoRes.applyEffects();
      const statsNoRes = await fitCalculator.calculateShipStats(parsedNoRes, fitSimulatorNoRes);

      const parsedWithRes = await fitCalculator.parseEFT(withResistanceFit);
      const fitSimulatorWithRes = new FitSimulator(parsedWithRes, staticData);
      await fitSimulatorWithRes.applyEffects();
      const statsWithRes = await fitCalculator.calculateShipStats(parsedWithRes, fitSimulatorWithRes);

      // Ship with resistance modules should have higher EHP
      expect(statsWithRes.ehp.total).to.be.greaterThan(statsNoRes.ehp.total);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero HP values gracefully', async () => {
      // Create a mock fit with potential zero values
      const testFit = `[Ibis, Minimal Fit]

Small Shield Extender I

Civilian Light Electron Blaster

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should handle gracefully without negative values
      expect(stats.ehp.shield).to.be.at.least(0);
      expect(stats.ehp.armor).to.be.at.least(0);
      expect(stats.ehp.hull).to.be.at.least(0);
      expect(stats.ehp.total).to.be.at.least(0);
    });

    it('should handle extreme resistance values', async () => {
      // This tests the mathematical limits of the EHP calculation
      const testFit = `[Rattlesnake, Extreme Resistance]
Damage Control II
Adaptive Armor Hardener
Reactive Armor Hardener

Pith X-Type Large Shield Booster
Adaptive Invulnerability Field II
EM Ward Field II
Thermal Dissipation Field II

Cruise Missile Launcher II

`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Even with extreme fits, should produce reasonable values
      expect(stats.ehp.total).to.be.greaterThan(0);
      expect(stats.ehp.total).to.be.lessThan(1000000); // Reasonable upper bound
      expect(stats.ehp.total).to.be.finite;
    });
  });

  describe('Regression Tests for Bug #636944', () => {
    it('should never produce the specific negative EHP value that was reported', async () => {
      // Test multiple ship types to ensure the bug doesn't reoccur
      const testFits = [
        `[Alligator, Test Fit]
Damage Control II

Large Shield Extender II
Adaptive Invulnerability Field II

Medium Pulse Laser II

`,
        `[Hurricane, Test Fit]
Gyrostabilizer II

10MN Afterburner II
Large Shield Extender II

720mm Howitzer Artillery II

`,
        `[Dominix, Test Fit]
Damage Control II

Large Armor Repairer II
Adaptive Armor Hardener

Heavy Neutron Blaster II

`
      ];

      for (const testFit of testFits) {
        const parsedFit = await fitCalculator.parseEFT(testFit);
        const fitSimulator = new FitSimulator(parsedFit, staticData);
        await fitSimulator.applyEffects();
        const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

        // Should never produce the reported bug value or any negative EHP
        expect(stats.ehp.total).to.not.equal(-636944);
        expect(stats.ehp.total).to.be.greaterThan(0);
        expect(stats.ehp.shield).to.be.greaterThan(0);
        expect(stats.ehp.armor).to.be.greaterThan(0);
        expect(stats.ehp.hull).to.be.greaterThan(0);
      }
    });
  });
});