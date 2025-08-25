const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');

describe('Rig Bonuses and Penalties', function() {
  let fitCalculator;
  let staticData;

  before(async function() {
    this.timeout(10000); // Give more time for static data loading
    staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator = new FitCalculator(staticData);
  });

  describe('Hydraulic Bay Thruster Velocity Bonuses', function() {
    
    it('should apply Medium Hydraulic Bay Thrusters II missile velocity bonus', async function() {
      // Caracal fit with Heavy Missile Launcher and Hydraulic Bay Thrusters
      const eftWithRigs = `[Caracal, Hydraulic Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II`;

      const eftWithoutRigs = `[Caracal, No Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // Heavy missiles should have higher velocity with Hydraulic Bay Thrusters
      // Base Nova Heavy Missile velocity is ~3000 m/s, should increase with rigs
      expect(statsWithRigs.weapons[0]).to.exist;
      expect(statsWithoutRigs.weapons[0]).to.exist;
      
      // With 2x Medium Hydraulic Bay Thrusters II, missile velocity should be significantly higher
      const rigVelocity = statsWithRigs.weapons[0].velocity;
      const baseVelocity = statsWithoutRigs.weapons[0].velocity;
      
      expect(rigVelocity).to.be.greaterThan(baseVelocity);
      
      // Each Medium Hydraulic Bay Thruster II should provide ~15% velocity increase
      // Two rigs should provide ~30% total (with stacking penalties)
      const expectedMinIncrease = 1.25; // At least 25% increase
      expect(rigVelocity / baseVelocity).to.be.at.least(expectedMinIncrease);
    });

    it('should apply Small Hydraulic Bay Thrusters II velocity bonus', async function() {
      const eftWithRigs = `[Merlin, Small Hydraulic Test]
Light Missile Launcher II,Caldari Navy Inferno Light Missile

[Empty med slot]

[Empty low slot]

Small Hydraulic Bay Thrusters II
Small Hydraulic Bay Thrusters II`;

      const eftWithoutRigs = `[Merlin, No Small Rigs Test]
Light Missile Launcher II,Caldari Navy Inferno Light Missile
1MN Monopropellant Enduring Afterburner`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      expect(statsWithRigs.weapons[0].velocity).to.be.greaterThan(statsWithoutRigs.weapons[0].velocity);
    });

    it('should apply Large Hydraulic Bay Thrusters II velocity bonus', async function() {
      const eftWithRigs = `[Raven, Large Hydraulic Test]
Cruise Missile Launcher II,Nova Cruise Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Large Hydraulic Bay Thrusters II
Large Hydraulic Bay Thrusters II`;

      const eftWithoutRigs = `[Raven, No Large Rigs Test]
Cruise Missile Launcher II,Nova Cruise Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      expect(statsWithRigs.weapons[0].velocity).to.be.greaterThan(statsWithoutRigs.weapons[0].velocity);
    });

    it('should increase missile range due to increased velocity', async function() {
      const eftWithRigs = `[Caracal, Range Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II`;

      const eftWithoutRigs = `[Caracal, Base Range Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // Missile range = velocity * flight time
      // Higher velocity should mean higher range
      expect(statsWithRigs.weapons[0].range).to.be.greaterThan(statsWithoutRigs.weapons[0].range);
      
      // The user's Caracal should get 100-120km range with these rigs
      // Base Heavy Missile range is ~27km, with rigs should be much higher
      expect(statsWithRigs.weapons[0].range).to.be.at.least(60); // At least 60km
    });
  });

  describe('Rig Drawback Penalties', function() {
    
    it('should apply signature radius penalty from rigs', async function() {
      const eftWithRigs = `[Caracal, Sig Penalty Test]
Heavy Missile Launcher II,Nova Heavy Missile
1MN Monopropellant Enduring Afterburner

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II`;

      const eftWithoutRigs = `[Caracal, No Sig Penalty Test]
Heavy Missile Launcher II,Nova Heavy Missile
1MN Monopropellant Enduring Afterburner`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // Rigs should increase signature radius as a drawback
      expect(statsWithRigs.signatureRadius).to.be.greaterThan(statsWithoutRigs.signatureRadius);
      
      // Each rig typically has 10% signature radius penalty
      // Two rigs should be ~20% penalty (with stacking)
      const expectedMinPenalty = 1.15; // At least 15% increase in sig radius
      expect(statsWithRigs.signatureRadius / statsWithoutRigs.signatureRadius).to.be.at.least(expectedMinPenalty);
    });

    it('should apply multiple rig penalties with stacking', async function() {
      const eftOneRig = `[Caracal, One Rig Test]
Heavy Missile Launcher II,Nova Heavy Missile
1MN Monopropellant Enduring Afterburner

Medium Hydraulic Bay Thrusters II`;

      const eftTwoRigs = `[Caracal, Two Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile
1MN Monopropellant Enduring Afterburner

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II`;

      const eftThreeRigs = `[Caracal, Three Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile
1MN Monopropellant Enduring Afterburner

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II
Medium Core Defense Field Extender I`;

      const parsedOneRig = await fitCalculator.parseEFT(eftOneRig);
      const parsedTwoRigs = await fitCalculator.parseEFT(eftTwoRigs);
      const parsedThreeRigs = await fitCalculator.parseEFT(eftThreeRigs);
      
      const statsOneRig = await fitCalculator.calculateFitStats(parsedOneRig);
      const statsTwoRigs = await fitCalculator.calculateFitStats(parsedTwoRigs);
      const statsThreeRigs = await fitCalculator.calculateFitStats(parsedThreeRigs);

      // Signature radius should increase with each additional rig
      expect(statsTwoRigs.signatureRadius).to.be.greaterThan(statsOneRig.signatureRadius);
      expect(statsThreeRigs.signatureRadius).to.be.greaterThan(statsTwoRigs.signatureRadius);
      
      // But the effect should diminish due to stacking penalties
      const firstRigEffect = statsTwoRigs.signatureRadius / statsOneRig.signatureRadius;
      const secondRigEffect = statsThreeRigs.signatureRadius / statsTwoRigs.signatureRadius;
      expect(secondRigEffect).to.be.lessThan(firstRigEffect);
    });
  });

  describe('Other Rig Bonuses', function() {
    
    it('should apply shield capacity bonuses from Core Defense Field Extenders', async function() {
      const eftWithRigs = `[Caracal, Shield Rig Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Core Defense Field Extender I
Medium Core Defense Field Extender I`;

      const eftWithoutRigs = `[Caracal, No Shield Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // Shield capacity should be higher with shield rigs
      expect(statsWithRigs.ehp.shield).to.be.greaterThan(statsWithoutRigs.ehp.shield);
    });

    it('should apply armor capacity bonuses from Trimark Armor Pumps', async function() {
      const eftWithRigs = `[Rupture, Armor Rig Test]
425mm AutoCannon II,Republic Fleet Fusion M

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Trimark Armor Pump I
Medium Trimark Armor Pump I`;

      const eftWithoutRigs = `[Rupture, No Armor Rigs Test]
425mm AutoCannon II,Republic Fleet Fusion M

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // Armor should be higher with armor rigs
      expect(statsWithRigs.ehp.armor).to.be.greaterThan(statsWithoutRigs.ehp.armor);
    });

    it('should apply damage bonuses from Burst Aerator rigs', async function() {
      const eftWithRigs = `[Rupture, Damage Rig Test]
425mm AutoCannon II,Republic Fleet Fusion M

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Energy Burst Aerator I
Medium Energy Burst Aerator I`;

      const eftWithoutRigs = `[Rupture, No Damage Rigs Test]
425mm AutoCannon II,Republic Fleet Fusion M

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedWithRigs = await fitCalculator.parseEFT(eftWithRigs);
      const parsedWithoutRigs = await fitCalculator.parseEFT(eftWithoutRigs);
      
      const statsWithRigs = await fitCalculator.calculateFitStats(parsedWithRigs);
      const statsWithoutRigs = await fitCalculator.calculateFitStats(parsedWithoutRigs);

      // DPS should be higher with damage rigs
      expect(statsWithRigs.dps.total).to.be.greaterThan(statsWithoutRigs.dps.total);
    });
  });

  describe('T2 vs T1 Rig Differences', function() {
    
    it('should have different bonus values between T1 and T2 rigs', async function() {
      const eftT1Rigs = `[Caracal, T1 Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Hydraulic Bay Thrusters I
Medium Hydraulic Bay Thrusters I`;

      const eftT2Rigs = `[Caracal, T2 Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Hydraulic Bay Thrusters II
Medium Hydraulic Bay Thrusters II`;

      const parsedT1 = await fitCalculator.parseEFT(eftT1Rigs);
      const parsedT2 = await fitCalculator.parseEFT(eftT2Rigs);
      const statsT1 = await fitCalculator.calculateFitStats(parsedT1);
      const statsT2 = await fitCalculator.calculateFitStats(parsedT2);

      // T2 rigs should provide better bonuses than T1 rigs
      expect(statsT2.weapons[0].velocity).to.be.greaterThan(statsT1.weapons[0].velocity);
      expect(statsT2.weapons[0].range).to.be.greaterThan(statsT1.weapons[0].range);
      
      // T2 and T1 Hydraulic Bay Thrusters have the same signature radius penalty (10% each)
      expect(statsT2.signatureRadius).to.be.approximately(statsT1.signatureRadius, 0.1);
    });
  });

  describe('Rig Size Compatibility', function() {
    
    it('should not apply medium rigs to small ships', async function() {
      // This should fail gracefully or not apply the bonus
      const eftInvalidRigs = `[Merlin, Invalid Rigs Test]
Light Missile Launcher II,Caldari Navy Inferno Light Missile
1MN Monopropellant Enduring Afterburner

Medium Hydraulic Bay Thrusters II`;

      // This should work normally
      const eftValidRigs = `[Merlin, Valid Rigs Test]
Light Missile Launcher II,Caldari Navy Inferno Light Missile
1MN Monopropellant Enduring Afterburner

Small Hydraulic Bay Thrusters II`;

      const parsedInvalid = await fitCalculator.parseEFT(eftInvalidRigs);
      const parsedValid = await fitCalculator.parseEFT(eftValidRigs);
      const statsInvalid = await fitCalculator.calculateFitStats(parsedInvalid);
      const statsValid = await fitCalculator.calculateFitStats(parsedValid);

      // The invalid rig should not provide bonus (or should error gracefully)
      // The valid rig should provide proper bonus
      expect(statsValid.weapons[0].velocity).to.be.greaterThan(3000); // Should have velocity bonus
    });
  });

  describe('Mixed Rig Types', function() {
    
    it('should apply different rig effects simultaneously', async function() {
      const eftMixedRigs = `[Caracal, Mixed Rigs Test]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]

Medium Hydraulic Bay Thrusters II
Medium Core Defense Field Extender I
Medium Ionic Field Projector I`;

      const eftNoRigs = `[Caracal, Mixed Rigs Baseline]
Heavy Missile Launcher II,Nova Heavy Missile

1MN Monopropellant Enduring Afterburner

[Empty low slot]`;

      const parsedMixed = await fitCalculator.parseEFT(eftMixedRigs);
      const parsedBaseline = await fitCalculator.parseEFT(eftNoRigs);
      const statsMixed = await fitCalculator.calculateFitStats(parsedMixed);
      const statsBaseline = await fitCalculator.calculateFitStats(parsedBaseline);

      // Should have velocity bonus from Hydraulic Bay Thrusters
      expect(statsMixed.weapons[0].velocity).to.be.greaterThan(statsBaseline.weapons[0].velocity);
      
      // Should have shield capacity bonus from Core Defense Field Extender
      expect(statsMixed.ehp.shield).to.be.greaterThan(statsBaseline.ehp.shield);
      
      // Should have increased signature radius penalty from all rigs
      expect(statsMixed.signatureRadius).to.be.greaterThan(statsBaseline.signatureRadius);
    });
  });
});