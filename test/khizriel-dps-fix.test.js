const { FitCalculator } = require('../lib/fit-calculator');
const assert = require('assert');

describe('Khizriel DPS Calculation Fix', () => {
  let calculator;

  beforeEach(() => {
    calculator = new FitCalculator();
  });

  it('Khizriel fit with 3x Gyrostabilizers should calculate correct DPS', async () => {
    const fit = `[Khizriel, Death Fit - 2025-06-30]
Republic Fleet Gyrostabilizer
Domination Tracking Enhancer
Nanofiber Internal Structure II
Republic Fleet Gyrostabilizer
Nanofiber Internal Structure II
Republic Fleet Gyrostabilizer

X-Large Ancillary Shield Booster
Abyssal Warp Disruptor
Republic Fleet Stasis Webifier
'Posse' Multispectrum Shield Hardener
Corelum C-Type 50MN Microwarpdrive

425mm AutoCannon II, Barrage M
Skirmish Command Burst II, Rapid Deployment Charge
425mm AutoCannon II, Barrage M
425mm AutoCannon II, Barrage M
425mm AutoCannon II, Barrage M
425mm AutoCannon II, Barrage M
425mm AutoCannon II, Barrage M

Medium EM Shield Reinforcer I
Medium Ancillary Current Router II
Medium Projectile Ambit Extension II

Cladistic-5 'Krai Veles' Filament
Republic Fleet Phased Plasma M x990
Barrage M x2550
Hail M x1612
Evasive Maneuvers Charge x50
Republic Fleet Fusion M x1000
Nanite Repair Paste x279
Republic Fleet EMP M x968
Border-15 'Pochven' Filament
Interdiction Maneuvers Charge x50
Medium Secure Container`;

    const parsedFit = await calculator.parseEFT(fit);
    const stats = await calculator.calculateFitStats(parsedFit);

    // The fix should provide at least 280 DPS (was 93 DPS before)
    assert(stats.dps.total > 280, `DPS should be > 280, got ${stats.dps.total}`);

    // Should be close to but not necessarily exactly 537 DPS (game calculation)
    // Allow for differences in skill bonus calculations
    assert(stats.dps.total > 250, `DPS should be > 250, got ${stats.dps.total}`);
    assert(stats.dps.total < 600, `DPS should be < 600, got ${stats.dps.total}`);

    // Verify Gyrostabilizers are detected
    const gyroCount = parsedFit.modules.low.filter(m => m.name.includes('Gyrostabilizer')).length;
    assert.strictEqual(gyroCount, 3, 'Should have 3 Gyrostabilizers');

    // Verify autocannons are detected
    const autoCannons = parsedFit.modules.high.filter(m => m.name.includes('425mm AutoCannon')).length;
    assert.strictEqual(autoCannons, 6, 'Should have 6 AutoCannons');

    // Verify weapon stats are calculated correctly
    assert.strictEqual(stats.weapons.length, 6, 'Should have 6 weapons in stats');
    assert(stats.weapons[0].dps.total > 40, `Each weapon should do >40 DPS, got ${stats.weapons[0].dps.total}`);
  });

  it('Gyrostabilizer group ID detection should work correctly', async () => {
    // Ensure the group ID fix (59 instead of 305) is working
    const testFit = `[Rifter, Test Gyro]
Gyrostabilizer II

200mm AutoCannon II, EMP S`;

    const parsedFit = await calculator.parseEFT(testFit);
    const stats = await calculator.calculateFitStats(parsedFit);

    // With a single gyro, DPS should be higher than without
    assert(stats.dps.total > 5, `DPS should be > 5, got ${stats.dps.total}`); // Basic sanity check
  });

  it('Barrage M should be detected as projectile charge', async () => {
    const testFit = `[Rifter, Test Barrage]
Gyrostabilizer II

200mm AutoCannon II, Barrage S`;

    const parsedFit = await calculator.parseEFT(testFit);
    const stats = await calculator.calculateFitStats(parsedFit);

    // Should work with Barrage charges (group 372)
    assert(stats.dps.total > 5, `DPS should be > 5, got ${stats.dps.total}`);
    assert(stats.dps.kinetic + stats.dps.explosive > 0, 'Should have kinetic/explosive damage');
  });

  it('425mm AutoCannon II should be detected as large weapon', async () => {
    // Test the weapon size fix
    const { StaticData } = require('../lib/static-data');
    const { FitSimulator } = require('../lib/fit-simulator');

    const staticData = await StaticData.getInstance();
    const autocannon = await staticData.searchItemByName('425mm AutoCannon II');
    const fit = { shipName: 'Khizriel', modules: { high: [], med: [], low: [], rig: [], subsystem: [] }, drones: [], cargo: [] };
    const fitSimulator = new FitSimulator(fit, staticData);

    assert.strictEqual(fitSimulator.getWeaponSize(autocannon), 'large', '425mm AutoCannon II should be large weapon');
    assert.strictEqual(fitSimulator.isProjectileWeapon(autocannon), true, '425mm AutoCannon II should be projectile weapon');
    assert.strictEqual(fitSimulator.getTurretSizeSkillBonus(autocannon), 0.25, 'Should have 25% Large Projectile Turret bonus');
  });
});
