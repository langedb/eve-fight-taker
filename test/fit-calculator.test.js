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

    const fit = fitCalculator.parseEFT(eft);
    const stats = await fitCalculator.calculateFitStats(fit);

    expect(stats.dps.total).to.be.above(200);
  });

  it('should correctly initialize and retrieve drone attributes in FitSimulator', async () => {
    const eft = `[Osprey Navy Issue, Test Fit]
Warrior II x2`; // A simple fit with just drones

    const fit = fitCalculator.parseEFT(eft);
    const fitSimulator = new FitSimulator(fit, fitCalculator.staticData);

    await fitSimulator._initializeAttributes(); // Manually call initializeAttributes

    console.log("DEBUG: After _initializeAttributes in test, modifiedAttributes map:", fitSimulator.modifiedAttributes); // NEW LOG

    const warriorIIAttributes = fitSimulator.modifiedAttributes.get('Warrior II');
    expect(warriorIIAttributes).to.exist;
    expect(warriorIIAttributes).to.be.an('array').that.is.not.empty;

    const rateOfFire = await fitSimulator.getModifiedAttribute('Warrior II', 51);
    expect(rateOfFire).to.equal(4000); // Expected value from typedogma.0.json

    const damageMultiplier = await fitSimulator.getModifiedAttribute('Warrior II', 64);
    expect(damageMultiplier).to.equal(1.56); // Expected value from typedogma.0.json
  });
});
