const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugSameInstance() {
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
    
    console.log('=== SAME INSTANCE DEBUG ===\n');
    
    // Create instance and test BEFORE applyEffects
    const fitSimulator = new FitSimulator(normalizedFit, fitCalculator.staticData);
    
    console.log('1. BEFORE applyEffects():');
    console.log(`   Charge keys: [${Array.from(fitSimulator.chargeAttributes.keys()).join(', ')}]`);
    
    const beforeResult = await fitSimulator.getModifiedAttribute('Caldari Navy Scourge Heavy Missile', 117);
    console.log(`   getModifiedAttribute result: ${beforeResult}`);
    
    // Now apply effects
    console.log('\n2. CALLING applyEffects()...');
    await fitSimulator.applyEffects();
    
    console.log('\n3. AFTER applyEffects():');
    console.log(`   Charge keys: [${Array.from(fitSimulator.chargeAttributes.keys()).join(', ')}]`);
    
    if (fitSimulator.chargeAttributes.has('Caldari Navy Scourge Heavy Missile')) {
      const store = fitSimulator.chargeAttributes.get('Caldari Navy Scourge Heavy Missile');
      console.log(`   Direct store value: ${store.get(117)}`);
    }
    
    const afterResult = await fitSimulator.getModifiedAttribute('Caldari Navy Scourge Heavy Missile', 117);
    console.log(`   getModifiedAttribute result: ${afterResult}`);
    
    // Check if there are multiple instances
    console.log('\n4. INSTANCE IDENTITY CHECK:');
    console.log(`   FitSimulator instance ID: ${fitSimulator.constructor.name}_${Math.random()}`);
    console.log(`   Charge store exists: ${fitSimulator.chargeAttributes.has('Caldari Navy Scourge Heavy Missile')}`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugSameInstance();