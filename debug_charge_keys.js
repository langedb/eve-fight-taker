const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugChargeKeys() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  const eft = `[Caracal, Boss]
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II
Power Diagnostic System II

50MN Quad LiF Restrained Microwarpdrive
Sensor Booster II, Targeting Range Script
Remote Sensor Dampener II, Targeting Range Dampening Script
10MN Afterburner II
Medium Cap Battery II

Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21
Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21
Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21
Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21
Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21

Medium Capacitor Control Circuit I
Medium Hydraulic Bay Thrusters I
Medium Hydraulic Bay Thrusters I

Warrior II x2

Caldari Navy Nova Heavy Missile x1000
Caldari Navy Scourge Heavy Missile x800
Caldari Navy Inferno Heavy Missile x1000
Caldari Navy Mjolnir Heavy Missile x1225`;

  try {
    const fit = await fitCalculator.parseEFT(eft);
    const normalizedFit = { ...fit };
    if (fit.shipType && !fit.shipName) {
      normalizedFit.shipName = fit.shipType;
    }
    
    const fitSimulator = new FitSimulator(normalizedFit, fitCalculator.staticData);
    await fitSimulator.applyEffects();
    
    console.log('=== CHARGE KEYS DEBUG ===\n');
    
    console.log('Available charge attribute keys:');
    for (const [key, store] of fitSimulator.chargeAttributes.entries()) {
      console.log(`  "${key}"`);
    }
    
    console.log('\nModule charges from fit:');
    for (const module of fit.modules.high) {
      if (module.charge) {
        console.log(`  Module: ${module.name}`);
        console.log(`  Original charge: "${module.charge}"`);
        
        const baseChargeName = module.charge.replace(/\s+x\d+$/, '');
        const cleanedChargeName = baseChargeName.split(',')[0].trim();
        console.log(`  Cleaned charge: "${cleanedChargeName}"`);
        console.log(`  Exists in store: ${fitSimulator.chargeAttributes.has(cleanedChargeName)}`);
        
        if (fitSimulator.chargeAttributes.has(cleanedChargeName)) {
          const store = fitSimulator.chargeAttributes.get(cleanedChargeName);
          console.log(`  Store kinetic value: ${store.get(117)}`);
        }
        console.log('');
      }
    }
    
    // Test getModifiedAttribute with exact keys
    const testKey = 'Caldari Navy Scourge Heavy Missile';
    console.log(`Testing getModifiedAttribute with key: "${testKey}"`);
    const result = await fitSimulator.getModifiedAttribute(testKey, 117);
    console.log(`Result: ${result}`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugChargeKeys();