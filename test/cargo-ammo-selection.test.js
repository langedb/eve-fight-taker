const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { FitSimulator } = require('../lib/fit-simulator');

describe('Cargo Ammo Selection', () => {
  let staticData, fitCalculator;

  before(async () => {
    staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator = new FitCalculator(staticData);
  });

  describe('Cruise Missile Launchers', () => {
    it('should auto-select cruise missiles from cargo for unloaded cruise launchers', async () => {
      const barghestFit = `[Barghest, Test Barghest]
Ballistic Control System II
Damage Control II

Large Shield Extender II
10MN Afterburner II

Cruise Missile Launcher II
Cruise Missile Launcher II



Scourge Fury Cruise Missile x1000
Nova Fury Cruise Missile x1000`;

      const parsedFit = await fitCalculator.parseEFT(barghestFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should have DPS from auto-loaded cruise missiles
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      
      // Both launchers should use the same optimal ammo
      expect(stats._cargoAmmoUsed[0].ammo).to.equal('Scourge Fury Cruise Missile');
      expect(stats._cargoAmmoUsed[1].ammo).to.equal('Scourge Fury Cruise Missile');
    });
  });

  describe('Heavy Missile Launchers', () => {
    it('should auto-select heavy missiles from cargo for unloaded heavy launchers', async () => {
      const caracalFit = `[Caracal, Test Caracal]
Ballistic Control System II

Large Shield Extender II

Heavy Missile Launcher II
Heavy Missile Launcher II



Scourge Fury Heavy Missile x1000
Nova Fury Heavy Missile x1000`;

      const parsedFit = await fitCalculator.parseEFT(caracalFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.include('Heavy Missile');
    });
  });

  describe('Rapid Heavy Missile Launchers', () => {
    it('should auto-select heavy missiles from cargo for unloaded rapid heavy launchers', async () => {
      const barghestFit = `[Barghest, Rapid Heavy Test]
Ballistic Control System II

Large Shield Extender II

Caldari Navy Rapid Heavy Missile Launcher
Caldari Navy Rapid Heavy Missile Launcher



Nova Fury Heavy Missile x1000
Mjolnir Fury Heavy Missile x1000`;

      const parsedFit = await fitCalculator.parseEFT(barghestFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Nova|Mjolnir).*Fury.*Heavy Missile/);
    });
  });

  describe('Light Missile Launchers', () => {
    it('should auto-select light missiles from cargo for unloaded light launchers', async () => {
      const kestrelFit = `[Kestrel, Test Kestrel]
Ballistic Control System II

Small Shield Extender II

Light Missile Launcher II
Light Missile Launcher II



Scourge Light Missile x1000
Nova Light Missile x1000`;

      const parsedFit = await fitCalculator.parseEFT(kestrelFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.include('Light Missile');
    });
  });

  describe('Railgun Turrets', () => {
    it('should auto-select hybrid charges from cargo for unloaded railguns', async () => {
      const coraxFit = `[Corax, Test Corax]
Magnetic Field Stabilizer II

5MN Microwarpdrive II

150mm Railgun II
150mm Railgun II



Caldari Navy Antimatter Charge S x1000
Javelin S x1000`;

      const parsedFit = await fitCalculator.parseEFT(coraxFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Antimatter|Javelin)/);
    });

    it('should auto-select T2 hybrid charges (group 373) for large railguns', async () => {
      const nagaFit = `[Naga, T2 Charge Test]
Magnetic Field Stabilizer II
Magnetic Field Stabilizer II
Magnetic Field Stabilizer II

Sensor Booster II
Tracking Computer II
Medium Micro Jump Drive

425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II



Javelin L x2000
Spike L x2000
Caldari Navy Antimatter Charge L x2648`;

      const parsedFit = await fitCalculator.parseEFT(nagaFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(4); // 4 railguns should all get ammo
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Javelin|Spike|Antimatter).*L/);
    });
  });

  describe('Blaster Turrets', () => {
    it('should auto-select hybrid charges from cargo for unloaded blasters', async () => {
      const thoraxFit = `[Thorax, Test Thorax]
Magnetic Field Stabilizer II

10MN Afterburner II

Neutron Blaster Cannon II
Neutron Blaster Cannon II



Caldari Navy Antimatter Charge M x1000
Null M x1000`;

      const parsedFit = await fitCalculator.parseEFT(thoraxFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Antimatter|Null)/);
    });
  });

  describe('Artillery Turrets', () => {
    it('should auto-select projectile ammo from cargo for unloaded artillery', async () => {
      const ruptureFit = `[Rupture, Test Rupture]
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II

10MN Afterburner II
Medium Shield Extender II

Gyrostabilizer II
Damage Control II

Medium Trimark Armor Pump I
Medium Trimark Armor Pump I
Medium Trimark Armor Pump I



Republic Fleet EMP L x1000
Barrage L x1000
Hail L x1000`;

      const parsedFit = await fitCalculator.parseEFT(ruptureFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(4);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(EMP|Barrage|Hail)/);
    });
  });

  describe('Autocannon Turrets', () => {
    it('should auto-select projectile ammo from cargo for unloaded autocannons', async () => {
      const rifterFit = `[Rifter, Test Rifter]
Gyrostabilizer II

1MN Afterburner II

200mm AutoCannon I
200mm AutoCannon I



Republic Fleet EMP S x1000
Barrage S x1000`;

      const parsedFit = await fitCalculator.parseEFT(rifterFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(EMP|Barrage)/);
    });
  });

  describe('Pulse Laser Turrets', () => {
    it('should auto-select frequency crystals from cargo for unloaded pulse lasers', async () => {
      const punisherFit = `[Punisher, Test Punisher]
Heat Sink II

1MN Afterburner II

Small Focused Pulse Laser II
Small Focused Pulse Laser II



Multifrequency S x1000
Scorch S x1000`;

      const parsedFit = await fitCalculator.parseEFT(punisherFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Multifrequency|Scorch)/);
    });
  });

  describe('Size Compatibility', () => {
    it('should not match small ammo with large weapons', async () => {
      const badFit = `[Barghest, Bad Size Test]



Cruise Missile Launcher II



Scourge Light Missile x1000`; // Wrong size - small ammo for large weapon

      const parsedFit = await fitCalculator.parseEFT(badFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // Should have no DPS because ammo is incompatible
      expect(stats.dps.total).to.equal(0);
      expect(stats._cargoAmmoUsed || []).to.have.length(0);
    });

    it('should correctly identify weapon and ammo sizes', async () => {
      // Test weapon size extraction
      expect(fitCalculator.extractWeaponSize('cruise missile launcher ii')).to.equal('large');
      expect(fitCalculator.extractWeaponSize('heavy missile launcher ii')).to.equal('medium');
      expect(fitCalculator.extractWeaponSize('light missile launcher ii')).to.equal('small');
      expect(fitCalculator.extractWeaponSize('150mm railgun ii')).to.equal('small');
      expect(fitCalculator.extractWeaponSize('425mm railgun ii')).to.equal('large');
      expect(fitCalculator.extractWeaponSize('1400mm railgun ii')).to.equal('large');

      // Test ammo size extraction
      expect(fitCalculator.extractAmmoSize('scourge fury cruise missile')).to.equal('large');
      expect(fitCalculator.extractAmmoSize('scourge fury heavy missile')).to.equal('medium');
      expect(fitCalculator.extractAmmoSize('scourge light missile')).to.equal('small');
      expect(fitCalculator.extractAmmoSize('antimatter charge s')).to.equal('small');
      expect(fitCalculator.extractAmmoSize('antimatter charge m')).to.equal('medium');
      expect(fitCalculator.extractAmmoSize('antimatter charge l')).to.equal('large');
    });
  });

  describe('Weapon Module Detection', () => {
    it('should identify all missile launcher types as weapons', async () => {
      const lightLauncher = await fitCalculator.getItemByName('Light Missile Launcher II');
      const heavyLauncher = await fitCalculator.getItemByName('Heavy Missile Launcher II');
      const cruiseLauncher = await fitCalculator.getItemByName('Cruise Missile Launcher II');

      expect(fitCalculator.isWeaponModule(lightLauncher)).to.be.true;
      expect(fitCalculator.isWeaponModule(heavyLauncher)).to.be.true;
      expect(fitCalculator.isWeaponModule(cruiseLauncher)).to.be.true;
    });

    it('should identify all turret types as weapons', async () => {
      const railgun = await fitCalculator.getItemByName('150mm Railgun II');
      const blaster = await fitCalculator.getItemByName('Neutron Blaster Cannon II');
      const autocannon = await fitCalculator.getItemByName('200mm AutoCannon I');
      const pulseLaser = await fitCalculator.getItemByName('Small Focused Pulse Laser II');

      expect(fitCalculator.isWeaponModule(railgun)).to.be.true;
      expect(fitCalculator.isWeaponModule(blaster)).to.be.true;
      expect(fitCalculator.isWeaponModule(autocannon)).to.be.true;
      expect(fitCalculator.isWeaponModule(pulseLaser)).to.be.true;
    });
  });

  describe('Ammo Compatibility Matrix', () => {
    it('should match cruise missiles with cruise launchers', async () => {
      const launcher = await fitCalculator.getItemByName('Cruise Missile Launcher II');
      const ammo = await fitCalculator.getItemByName('Scourge Fury Cruise Missile');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(launcher, ammo)).to.be.true;
    });

    it('should match heavy missiles with heavy launchers', async () => {
      const launcher = await fitCalculator.getItemByName('Heavy Missile Launcher II');
      const ammo = await fitCalculator.getItemByName('Scourge Fury Heavy Missile');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(launcher, ammo)).to.be.true;
    });

    it('should match hybrid charges with railguns', async () => {
      const weapon = await fitCalculator.getItemByName('150mm Railgun II');
      const ammo = await fitCalculator.getItemByName('Caldari Navy Antimatter Charge S');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, ammo)).to.be.true;
    });

    it('should match T2 hybrid charges (group 373) with railguns', async () => {
      const weapon = await fitCalculator.getItemByName('425mm Railgun II');
      const javelinAmmo = await fitCalculator.getItemByName('Javelin L');
      const spikeAmmo = await fitCalculator.getItemByName('Spike L');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, javelinAmmo)).to.be.true;
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, spikeAmmo)).to.be.true;
    });

    it('should match basic hybrid charges (group 1042) with railguns', async () => {
      const weapon = await fitCalculator.getItemByName('425mm Railgun II');
      const basicAmmo = await fitCalculator.getItemByName('Antimatter Charge L');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, basicAmmo)).to.be.true;
    });

    it('should match advanced projectile ammo (group 372) with artillery', async () => {
      const weapon = await fitCalculator.getItemByName('720mm Howitzer Artillery II');
      const barrageAmmo = await fitCalculator.getItemByName('Barrage L');
      const hailAmmo = await fitCalculator.getItemByName('Hail L');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, barrageAmmo)).to.be.true;
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, hailAmmo)).to.be.true;
    });

    it('should match frequency crystals with pulse lasers', async () => {
      const weapon = await fitCalculator.getItemByName('Small Focused Pulse Laser II');
      const ammo = await fitCalculator.getItemByName('Multifrequency S');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(weapon, ammo)).to.be.true;
    });

    it('should not match incompatible weapon/ammo types', async () => {
      const missileWeapon = await fitCalculator.getItemByName('Heavy Missile Launcher II');
      const hybridAmmo = await fitCalculator.getItemByName('Antimatter Charge M');
      
      expect(fitCalculator.isAmmoCompatibleWithWeapon(missileWeapon, hybridAmmo)).to.be.false;
    });
  });

  describe('Optimal Ammo Selection', () => {
    it('should prefer higher damage ammo when available', async () => {
      const testFit = `[Caracal, High Damage Test]



Heavy Missile Launcher II



Scourge Heavy Missile x1000
Scourge Fury Heavy Missile x1000`; // Fury should be selected for higher damage

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed[0].ammo).to.include('Fury'); // Should select the higher damage variant
    });
  });

  describe('Multiple Weapon Types', () => {
    it('should handle mixed weapon loadouts with different ammo types', async () => {
      const mixedFit = `[Caracal, Mixed Weapons]



Heavy Missile Launcher II
150mm Railgun II



Scourge Heavy Missile x1000
Antimatter Charge S x1000`;

      const parsedFit = await fitCalculator.parseEFT(mixedFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(2);
      
      // Should match missile launcher with missile ammo and railgun with hybrid ammo
      const ammoTypes = stats._cargoAmmoUsed.map(u => u.ammo);
      expect(ammoTypes).to.include('Scourge Heavy Missile');
      expect(ammoTypes).to.include('Antimatter Charge S');
    });
  });

  describe('Regression Tests', () => {
    it('should never show 0 DPS for Naga with T2 railgun charges in cargo', async () => {
      // Regression test for bug where railguns showed 0 DPS due to missing hybrid charge groups
      const nagaFit = `[Naga, Splash]
Magnetic Field Stabilizer II
Magnetic Field Stabilizer II
Magnetic Field Stabilizer II

Sensor Booster II
Sensor Booster II
Sensor Booster II
Tracking Computer II
Tracking Computer II
Medium Micro Jump Drive

425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II
425mm Railgun II

Medium Ancillary Current Router I
Medium Hybrid Locus Coordinator I
Medium Hybrid Locus Coordinator II

Javelin L x2000
Spike L x2000
Caldari Navy Antimatter Charge L x2648
Caldari Navy Uranium Charge L x3320
Caldari Navy Iridium Charge L x2376`;

      const parsedFit = await fitCalculator.parseEFT(nagaFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // This was the bug - Naga showed 0 DPS because T2 charges (group 373) weren't recognized
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(8); // 8 railguns should all get ammo
      
      // Should auto-select one of the available compatible charges
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(Javelin|Spike|Antimatter|Uranium|Iridium).*L/);
    });

    it('should never show 0 DPS for Rupture with artillery and L-size projectile ammo', async () => {
      // Regression test for bug where artillery showed 0 DPS due to missing projectile ammo group 372
      const ruptureFit = `[Rupture, Artillery Test]
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II

10MN Afterburner II
Medium Shield Extender II

Gyrostabilizer II
Damage Control II

Medium Trimark Armor Pump I



Republic Fleet EMP L x1000
Barrage L x1000
Hail L x1000`;

      const parsedFit = await fitCalculator.parseEFT(ruptureFit);
      const fitSimulator = new FitSimulator(parsedFit, staticData);
      await fitSimulator.applyEffects();
      const stats = await fitCalculator.calculateShipStats(parsedFit, fitSimulator);

      // This was the bug - Rupture showed 0 DPS because advanced projectile ammo (group 372) wasn't recognized
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(stats._cargoAmmoUsed).to.exist;
      expect(stats._cargoAmmoUsed).to.have.length(4); // 4 artillery guns should all get ammo
      
      // Should auto-select one of the available compatible projectile charges
      expect(stats._cargoAmmoUsed[0].ammo).to.match(/(EMP|Barrage|Hail).*L/);
    });
  });
});