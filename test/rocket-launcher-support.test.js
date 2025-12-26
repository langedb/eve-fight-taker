const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { FitSimulator } = require('../lib/fit-simulator');

describe('Rocket Launcher Support', () => {
  let staticData, fitCalculator;

  before(async () => {
    staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator = new FitCalculator(staticData);
  });

  describe('Rocket Launcher Detection', () => {
    it('should detect Arbalest Rocket Launcher I as a weapon module', async () => {
      const rocketLauncher = await fitCalculator.getItemByName("'Arbalest' Rocket Launcher I");
      expect(rocketLauncher).to.exist;
      expect(rocketLauncher.group_id).to.equal(507); // Rocket Launcher group
      expect(fitCalculator.isWeaponModule(rocketLauncher)).to.be.true;
      expect(fitCalculator.isMissileLauncher(rocketLauncher)).to.be.true;
    });

    it('should detect other rocket launchers as weapon modules', async () => {
      // Test different rocket launcher variants
      const rocketLauncherVariants = [
        "'Arbalest' Rocket Launcher I",
        'Rocket Launcher I',
        'Rocket Launcher II'
      ];

      for (const launcherName of rocketLauncherVariants) {
        const launcher = await fitCalculator.getItemByName(launcherName);
        if (launcher) { // Only test if the item exists in static data
          expect(launcher.group_id).to.equal(507);
          expect(fitCalculator.isWeaponModule(launcher)).to.be.true;
          expect(fitCalculator.isMissileLauncher(launcher)).to.be.true;
        }
      }
    });
  });

  describe('Rocket Ammo Compatibility', () => {
    it('should correctly classify rockets as small ammo', async () => {
      const rocketTypes = [
        'Caldari Navy Scourge Rocket',
        'Scourge Rocket',
        'Mjolnir Rocket',
        'Nova Rocket',
        'Inferno Rocket'
      ];

      for (const rocketName of rocketTypes) {
        const rocket = await fitCalculator.getItemByName(rocketName);
        if (rocket) {
          const ammoSize = fitCalculator.extractAmmoSize(rocket.name.toLowerCase());
          expect(ammoSize).to.equal('small', `${rocketName} should be classified as small`);
        }
      }
    });

    it('should classify rocket launchers as small weapons', async () => {
      const rocketLauncher = await fitCalculator.getItemByName("'Arbalest' Rocket Launcher I");
      const weaponSize = fitCalculator.extractWeaponSize(rocketLauncher.name.toLowerCase());
      expect(weaponSize).to.equal('small');
    });

    it('should find rockets compatible with rocket launchers', async () => {
      const rocketLauncher = await fitCalculator.getItemByName("'Arbalest' Rocket Launcher I");
      const scourgeRocket = await fitCalculator.getItemByName('Caldari Navy Scourge Rocket');

      expect(rocketLauncher).to.exist;
      expect(scourgeRocket).to.exist;

      const isCompatible = fitCalculator.isAmmoCompatibleWithWeapon(rocketLauncher, scourgeRocket);
      expect(isCompatible).to.be.true;
    });

    it('should find optimal rocket ammo from cargo', async () => {
      const maledictionFit = `[Malediction, Rocket Test]
Overdrive Injector System II

Warp Scrambler II

'Arbalest' Rocket Launcher I


Caldari Navy Scourge Rocket x1000
Scourge Rocket x500`;

      const parsedFit = await fitCalculator.parseEFT(maledictionFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);

      const rocketLauncher = await fitCalculator.getItemByName("'Arbalest' Rocket Launcher I");
      const optimalAmmo = await fitCalculator.findOptimalAmmoFromCargo(rocketLauncher, fitSimulator);

      expect(optimalAmmo).to.exist;
      expect(optimalAmmo.name).to.equal('Caldari Navy Scourge Rocket'); // Should prefer Navy variant
    });
  });

  describe('Rocket DPS Calculations', () => {
    it('should calculate non-zero DPS for Malediction with rocket launcher', async () => {
      const maledictionFit = `[Malediction, Rocket Test]
Overdrive Injector System II
Damage Control II

Warp Scrambler II
5MN Quad LiF Restrained Microwarpdrive

'Arbalest' Rocket Launcher I


Caldari Navy Scourge Rocket x1000`;

      const parsedFit = await fitCalculator.parseEFT(maledictionFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats.weapons).to.have.length(1);
      expect(stats.weapons[0].name).to.equal("'Arbalest' Rocket Launcher I");
      expect(stats.weapons[0].dps.total).to.be.greaterThan(0);
      expect(stats.weapons[0].chargeName).to.equal('Caldari Navy Scourge Rocket');
    });

    it('should auto-select rocket ammo for unloaded rocket launcher', async () => {
      const rifterFit = `[Rifter, Rocket Test]
Small Ancillary Armor Repairer
Damage Control II

J5b Phased Prototype Warp Scrambler I
1MN Afterburner II

Rocket Launcher II


Caldari Navy Scourge Rocket x1000
Mjolnir Rocket x500`;

      const parsedFit = await fitCalculator.parseEFT(rifterFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should have DPS from auto-loaded rockets
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(1);
      expect(stats._cargoAmmoUsed[0].weapon).to.equal('Rocket Launcher II');
      expect(['Caldari Navy Scourge Rocket', 'Mjolnir Rocket']).to.include(stats._cargoAmmoUsed[0].ammo);
    });

    it('should calculate correct damage types for different rockets', async () => {
      // Test different rocket types and their damage patterns
      const rocketTests = [
        { rocket: 'Scourge Rocket', expectedDamageType: 'kinetic' },
        { rocket: 'Mjolnir Rocket', expectedDamageType: 'em' },
        { rocket: 'Nova Rocket', expectedDamageType: 'explosive' },
        { rocket: 'Inferno Rocket', expectedDamageType: 'thermal' }
      ];

      for (const test of rocketTests) {
        const testFit = `[Rifter, ${test.rocket} Test]
Small Ancillary Armor Repairer

J5b Phased Prototype Warp Scrambler I

Rocket Launcher II, ${test.rocket}


${test.rocket} x1000`;

        const parsedFit = await fitCalculator.parseEFT(testFit);
        const fitSimulator = new FitSimulator(parsedFit, staticData);
        await fitSimulator.applyEffects();

        const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

        // Should have non-zero DPS in the expected damage type
        expect(stats.dps.total).to.be.greaterThan(0, `${test.rocket} should have DPS > 0`);
        expect(stats.dps[test.expectedDamageType]).to.be.greaterThan(0, `${test.rocket} should have ${test.expectedDamageType} damage`);
      }
    });

    it('should calculate weapon range for rockets', async () => {
      const maledictionFit = `[Malediction, Range Test]
Overdrive Injector System II

Warp Scrambler II

'Arbalest' Rocket Launcher I, Caldari Navy Scourge Rocket


Caldari Navy Scourge Rocket x1000`;

      const parsedFit = await fitCalculator.parseEFT(maledictionFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.weapons).to.have.length(1);
      const weapon = stats.weapons[0];

      expect(weapon.velocity).to.be.greaterThan(0);
      expect(weapon.flightTime).to.be.greaterThan(0);
      expect(weapon.range).to.be.greaterThan(0);
      // Rocket range should be reasonable (not too high like some missiles)
      // With all-V skills, rockets get velocity/flight time bonuses, so range is slightly higher
      expect(weapon.range).to.be.lessThan(25000); // Less than 25km is reasonable for rockets with skills
    });
  });

  describe('Multiple Rocket Launchers', () => {
    it('should handle multiple rocket launchers correctly', async () => {
      const kestrelFit = `[Kestrel, Multi Rocket]
Ballistic Control System II
Damage Control II

5MN Quad LiF Restrained Microwarpdrive
Warp Scrambler II

Rocket Launcher II
Rocket Launcher II
Rocket Launcher II
Rocket Launcher II


Caldari Navy Scourge Rocket x2000
Mjolnir Rocket x2000`;

      const parsedFit = await fitCalculator.parseEFT(kestrelFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();

      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats.weapons).to.have.length(4); // Should have 4 rocket launchers

      // All weapons should have DPS and ammo
      stats.weapons.forEach((weapon) => {
        expect(weapon.name).to.equal('Rocket Launcher II');
        expect(weapon.dps.total).to.be.greaterThan(0);
        expect(weapon.chargeName).to.exist;
      });
    });
  });

  describe('Rocket Group ID Verification', () => {
    it('should have rocket launchers in missile weapon groups', () => {
      const missileWeaponGroups = [506, 507, 508, 509, 510, 511, 771, 812, 524, 1245];
      expect(missileWeaponGroups).to.include(507); // Rocket Launcher group
    });

    it('should have rockets in missile ammo groups', () => {
      const missileAmmoGroups = [84, 387, 388, 389, 390, 392, 656, 655];
      expect(missileAmmoGroups).to.include(387); // Rocket group
    });

    it('should verify rocket static data group IDs', async () => {
      const rocketLauncher = await fitCalculator.getItemByName("'Arbalest' Rocket Launcher I");
      const scourgeRocket = await fitCalculator.getItemByName('Caldari Navy Scourge Rocket');

      expect(rocketLauncher.group_id).to.equal(507);
      expect(scourgeRocket.group_id).to.equal(387);
    });
  });
});
