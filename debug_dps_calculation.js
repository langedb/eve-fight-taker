const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugDPSCalculation() {
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
    
    // Create the SAME FitSimulator instance that will be used in calculateFitStats
    const fitSimulator = new FitSimulator(normalizedFit, fitCalculator.staticData);
    await fitSimulator.applyEffects();
    
    console.log('=== DPS CALCULATION FLOW DEBUG ===\n');
    
    // Test the exact flow from fit-calculator.js
    const module = fit.modules.high[0]; // First launcher
    console.log(`Module: ${module.name}`);
    console.log(`Charge: ${module.charge}`);
    
    // Step 1: Clean up charge name (same as line 934-935 in fit-calculator.js)
    const baseChargeName = module.charge.replace(/\s+x\d+$/, '');
    const damageSourceItemName = baseChargeName.split(',')[0].trim();
    console.log(`Cleaned charge name: ${damageSourceItemName}`);
    
    // Step 2: Get base damage from charge (same as lines 951-954)
    const baseEmDamage = await fitSimulator.getModifiedAttribute(damageSourceItemName, 114) || 0;
    const baseExplosiveDamage = await fitSimulator.getModifiedAttribute(damageSourceItemName, 116) || 0;
    const baseKineticDamage = await fitSimulator.getModifiedAttribute(damageSourceItemName, 117) || 0;
    const baseThermalDamage = await fitSimulator.getModifiedAttribute(damageSourceItemName, 118) || 0;
    
    console.log('\nCharge damage from getModifiedAttribute:');
    console.log(`  EM (114): ${baseEmDamage}`);
    console.log(`  Explosive (116): ${baseExplosiveDamage}`);
    console.log(`  Kinetic (117): ${baseKineticDamage}`);
    console.log(`  Thermal (118): ${baseThermalDamage}`);
    console.log(`  Total: ${baseEmDamage + baseExplosiveDamage + baseKineticDamage + baseThermalDamage}`);
    
    // Step 3: Get launcher damage multiplier (line 957)
    const baseDamageMultiplier = await fitSimulator.getModifiedAttribute(module.name, 64) || 1;
    console.log(`\nLauncher damage multiplier (64): ${baseDamageMultiplier}`);
    
    // Step 4: Calculate final damage (lines 961-964)
    const finalEmDamage = baseEmDamage * baseDamageMultiplier;
    const finalExplosiveDamage = baseExplosiveDamage * baseDamageMultiplier;
    const finalKineticDamage = baseKineticDamage * baseDamageMultiplier;
    const finalThermalDamage = baseThermalDamage * baseDamageMultiplier;
    
    console.log('\nFinal damage (charge × launcher multiplier):');
    console.log(`  EM: ${finalEmDamage}`);
    console.log(`  Explosive: ${finalExplosiveDamage}`);
    console.log(`  Kinetic: ${finalKineticDamage}`);
    console.log(`  Thermal: ${finalThermalDamage}`);
    console.log(`  Total per shot: ${finalEmDamage + finalExplosiveDamage + finalKineticDamage + finalThermalDamage}`);
    
    // Step 5: Get cycle time and calculate DPS
    const moduleInfo = await fitCalculator.getItemByName(module.name);
    const finalCycleTime = await fitSimulator.getModifiedAttribute(module.name, 51) || 1000;
    
    console.log(`\nCycle time: ${finalCycleTime}ms`);
    
    const dpsFactor = (1000 / finalCycleTime);
    console.log(`DPS factor: ${dpsFactor}`);
    
    const singleLauncherDPS = (finalEmDamage + finalExplosiveDamage + finalKineticDamage + finalThermalDamage) * dpsFactor;
    console.log(`Single launcher DPS: ${singleLauncherDPS}`);
    console.log(`5 launchers DPS: ${singleLauncherDPS * 5}`);
    
    // Step 6: Compare with direct charge store access
    console.log('\n=== DIRECT STORE ACCESS COMPARISON ===');
    if (fitSimulator.chargeAttributes.has(damageSourceItemName)) {
      const chargeStore = fitSimulator.chargeAttributes.get(damageSourceItemName);
      console.log(`Direct store kinetic (117): ${chargeStore.get(117)}`);
      console.log(`getModifiedAttribute kinetic (117): ${baseKineticDamage}`);
      console.log(`Values match: ${chargeStore.get(117) === baseKineticDamage}`);
    } else {
      console.log(`ERROR: Charge store not found for ${damageSourceItemName}`);
    }
    
    // Step 7: Test actual calculateFitStats
    console.log('\n=== ACTUAL CALCULATEFITSTATS RESULT ===');
    const stats = await fitCalculator.calculateFitStats(normalizedFit);
    console.log(`Calculated DPS: ${stats.dps.total}`);
    console.log(`Kinetic DPS: ${stats.dps.kinetic}`);
    console.log(`Expected DPS: 345`);
    console.log(`Gap: ${345 - stats.dps.total} DPS`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugDPSCalculation();