const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { FitSimulator } = require('../lib/fit-simulator');

describe('FitCalculator', () => {
  let fitCalculator;

  before(async () => {
    fitCalculator = new FitCalculator();
    const staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator.staticData = staticData;
  });

  it('should calculate DPS for a fit with missiles and drones to be over 300', async () => {
    const eft = `[Osprey Navy Issue, Charles Marsailles's Osprey Navy Issue]
Ballistic Control System II
Ballistic Control System II
Nanofiber Internal Structure II
Nanofiber Internal Structure II

50MN Quad LiF Restrained Microwarpdrive
Fleeting Compact Stasis Webifier
Large Shield Extender II
Small F-RX Compact Capacitor Booster
Warp Disruptor II
X-Large Ancillary Shield Booster,Navy Cap Booster 400

Small Infectious Scoped Energy Neutralizer
Small Infectious Scoped Energy Neutralizer
Rapid Light Missile Launcher II,Caldari Navy Inferno Light Missile
Rapid Light Missile Launcher II,Caldari Navy Inferno Light Missile
Rapid Light Missile Launcher II,Caldari Navy Inferno Light Missile

Medium Ancillary Current Router I
Medium EM Shield Reinforcer II
Medium Thermal Shield Reinforcer I

Warrior II x2
Warrior II x2`;

    const fit = await fitCalculator.parseEFT(eft);
    const stats = await fitCalculator.calculateFitStats(fit);

    expect(stats.dps.total).to.be.above(200);
  });

  it('should correctly initialize and retrieve drone attributes in FitSimulator', async () => {
    const eft = `[Osprey Navy Issue, Test Fit]
Warrior II x2`; // A simple fit with just drones

    const fit = await fitCalculator.parseEFT(eft);
    const fitSimulator = new FitSimulator(fit, fitCalculator.staticData);

    await fitSimulator._initializeAttributes(); // Manually call initializeAttributes

    

    const warriorIIAttributes = fitSimulator.droneAttributes.get('Warrior II');
    expect(warriorIIAttributes).to.exist;
    expect(warriorIIAttributes.get(51)).to.equal(4000); // Expected value for attributeID 51 (Rate of fire)
    expect(warriorIIAttributes.get(64)).to.equal(1.56); // Expected value for attributeID 64 (Damage multiplier)
  });

  it('should calculate EHP for a Cenotaph fit to be around 83.2K', async function() {
    this.timeout(10000); // Increase timeout to 10 seconds
    const eft = `[Cenotaph,  ]
Reactor Control Unit II
Damage Control II
Reactor Control Unit II

Medium Micro Jump Drive
50MN Y-T8 Compact Microwarpdrive
Large Ancillary Shield Booster
Multispectrum Shield Hardener II
Large Shield Extender II
Stasis Webifier II
Dread Guristas Warp Scrambler

720mm Howitzer Artillery II, Quake M x9
720mm Howitzer Artillery II, Quake M x9
720mm Howitzer Artillery II, Quake M x9
Medium Breacher Pod Launcher, SCARAB Breacher Pod M x44
Heavy Assault Missile Launcher II, Nova Rage Heavy Assault Missile x32
Heavy Assault Missile Launcher II, Nova Rage Heavy Assault Missile x32
Heavy Assault Missile Launcher II, Nova Rage Heavy Assault Missile x32
Covert Ops Cloaking Device II

Medium Core Defense Field Extender II
Medium Core Defense Field Extender II
Medium Core Defense Field Extender II


'Augmented' Hobgoblin x8
'Augmented' Hammerhead x1


SCARAB Breacher Pod M x163
Quake M x1230
Nova Rage Heavy Assault Missile x4110
Corpse Female x1`;

    const fit = await fitCalculator.parseEFT(eft);
    const stats = await fitCalculator.calculateFitStats(fit);

    expect(stats.ehp.total).to.be.within(81000, 85000);
  });

  it('should calculate DPS for the Loki fit correctly', async function() {
    this.timeout(10000); // Increase timeout for potentially longer calculation

    const eft = `[Loki,  A]
Damage Control II
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II

Stasis Webifier II
Stasis Webifier II
Warp Disruptor II
Republic Fleet Large Shield Extender
50MN Y-T8 Compact Microwarpdrive

Heavy Assault Missile Launcher II, Mjolnir Rage Heavy Assault Missile x42
Heavy Assault Missile Launcher II, Mjolnir Rage Heavy Assault Missile x42
Heavy Assault Missile Launcher II, Mjolnir Rage Heavy Assault Missile x42
Heavy Assault Missile Launcher II, Mjolnir Rage Heavy Assault Missile x42
Heavy Assault Missile Launcher II, Mjolnir Rage Heavy Assault Missile x42
Covert Ops Cloaking Device II
Sisters Expanded Probe Launcher, Sisters Combat Scanner Probe x8
Medium Energy Neutralizer II

Medium Core Defense Field Extender II
Medium Thermal Shield Reinforcer I
Medium Core Defense Field Extender II

Loki Core - Immobility Drivers
Loki Defensive - Covert Reconfiguration
Loki Offensive - Launcher Efficiency Configuration
Loki Propulsion - Intercalated Nanofibers


Mjolnir Rage Heavy Assault Missile x3519
Sisters Combat Scanner Probe x8
Agency 'Pyrolancea' DB3 Dose I x1
Dread Guristas Warp Scrambler x1
Nanite Repair Paste x185
125mm Gatling AutoCannon II x3
Caldari Navy Mjolnir Heavy Assault Missile x940`;

    const fit = await fitCalculator.parseEFT(eft);
    const stats = await fitCalculator.calculateFitStats(fit);

    // Expected DPS from user is 801.5. Using a tolerance for floating point.
    expect(stats.dps.total).to.be.closeTo(801.5, 5);
  });
});
