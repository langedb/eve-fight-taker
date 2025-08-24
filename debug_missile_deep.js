const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugMissileCalculationDeep() {
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
    
    console.log('=== COMPREHENSIVE MISSILE DAMAGE DEBUG ===\n');
    
    // 1. Check base missile attributes
    console.log('1. BASE MISSILE ATTRIBUTES:');
    const missileName = 'Caldari Navy Scourge Heavy Missile';
    const missileInfo = await fitCalculator.getItemByName(missileName);
    const missileData = await fitCalculator.staticData.getItemInfo(missileInfo.type_id);
    
    console.log(`Missile: ${missileName} (ID: ${missileInfo.type_id})`);
    const emBase = missileData.attributes?.find(attr => attr.attributeID === 114)?.value || 0;
    const thermalBase = missileData.attributes?.find(attr => attr.attributeID === 118)?.value || 0;
    const kineticBase = missileData.attributes?.find(attr => attr.attributeID === 117)?.value || 0;
    const explosiveBase = missileData.attributes?.find(attr => attr.attributeID === 116)?.value || 0;
    
    console.log(`  EM (114): ${emBase}`);
    console.log(`  Thermal (118): ${thermalBase}`);
    console.log(`  Kinetic (117): ${kineticBase}`);
    console.log(`  Explosive (116): ${explosiveBase}`);
    console.log(`  Total Base Damage: ${emBase + thermalBase + kineticBase + explosiveBase}`);
    
    // 2. Check modified missile attributes
    console.log('\n2. MODIFIED MISSILE ATTRIBUTES:');
    const emModified = await fitSimulator.getModifiedAttribute(missileName, 114) || emBase;
    const thermalModified = await fitSimulator.getModifiedAttribute(missileName, 118) || thermalBase;
    const kineticModified = await fitSimulator.getModifiedAttribute(missileName, 117);
    const actualKineticModified = kineticModified !== null ? kineticModified : kineticBase;
    
    // DEBUG: Check what getModifiedAttribute is actually doing
    console.log('\\n=== DEBUG getModifiedAttribute ===');
    const chargeStore = fitSimulator.chargeAttributes.get(missileName);
    if (chargeStore) {
      console.log(`Direct store.get(117): ${chargeStore.get(117)}`);
      console.log(`getModifiedAttribute result: ${kineticModified}`);
      console.log(`getModifiedAttribute result type: ${typeof kineticModified}`);
      console.log(`getModifiedAttribute === null: ${kineticModified === null}`);
      console.log(`getModifiedAttribute === undefined: ${kineticModified === undefined}`);
      console.log(`getModifiedAttribute === 0: ${kineticModified === 0}`);
      console.log(`Store type:`, chargeStore.constructor.name);
    }
    const explosiveModified = await fitSimulator.getModifiedAttribute(missileName, 116) || explosiveBase;
    
    console.log(`  EM (114): ${emBase} → ${emModified} (${((emModified/emBase - 1) * 100).toFixed(1)}% change)`);
    console.log(`  Thermal (118): ${thermalBase} → ${thermalModified} (${((thermalModified/thermalBase - 1) * 100).toFixed(1)}% change)`);
    console.log(`  Kinetic (117): ${kineticBase} → ${actualKineticModified} (${((actualKineticModified/kineticBase - 1) * 100).toFixed(1)}% change)`);
    console.log(`  Explosive (116): ${explosiveBase} → ${explosiveModified} (${((explosiveModified/explosiveBase - 1) * 100).toFixed(1)}% change)`);
    console.log(`  Total Modified Damage: ${emModified + thermalModified + actualKineticModified + explosiveModified}`);
    
    // 3. Check launcher attributes
    console.log('\n3. LAUNCHER ATTRIBUTES:');
    const launcherName = 'Heavy Missile Launcher II';
    const launcherInfo = await fitCalculator.getItemByName(launcherName);
    const launcherData = await fitCalculator.staticData.getItemInfo(launcherInfo.type_id);
    
    console.log(`Launcher: ${launcherName} (ID: ${launcherInfo.type_id})`);
    const rofBase = launcherData.attributes?.find(attr => attr.attributeID === 51)?.value || 0;
    const damageMultBase = launcherData.attributes?.find(attr => attr.attributeID === 64)?.value || 1;
    
    console.log(`  ROF Base (51): ${rofBase}ms`);
    console.log(`  Damage Mult Base (64): ${damageMultBase}`);
    
    // Check all 5 launchers
    for (let i = 0; i < 5; i++) {
      const moduleKey = `${launcherName}_${i}`;
      const rofModified = await fitSimulator.getModifiedAttribute(moduleKey, 51) || rofBase;
      const damageMultModified = await fitSimulator.getModifiedAttribute(moduleKey, 64) || damageMultBase;
      
      console.log(`  Launcher ${i}: ROF ${rofBase} → ${rofModified}ms (${((rofBase - rofModified) / rofBase * 100).toFixed(1)}% faster)`);
      console.log(`  Launcher ${i}: DmgMult ${damageMultBase} → ${damageMultModified} (${((damageMultModified/damageMultBase - 1) * 100).toFixed(1)}% change)`);
    }
    
    // 4. Check skill bonuses applied
    console.log('\n4. SKILL BONUSES:');
    console.log(`  Missile Launcher Operation: ${(fitSimulator.fitBonuses.character.missileLauncherOperation * 100).toFixed(1)}%`);
    console.log(`  Missile Specialization: ${(fitSimulator.fitBonuses.character.missileSpecialization * 100).toFixed(1)}%`);
    console.log(`  Warhead Upgrades: ${(fitSimulator.fitBonuses.character.warheadUpgrades * 100).toFixed(1)}%`);
    console.log(`  Heavy Missiles: ${(fitSimulator.fitBonuses.character.heavyMissiles * 100).toFixed(1)}%`);
    console.log(`  Caldari Cruiser (Missile): ${(fitSimulator.fitBonuses.ship.caldariCruiserMissile * 100).toFixed(1)}%`);
    
    // 5. Check BCS modules
    console.log('\n5. BALLISTIC CONTROL SYSTEM MODULES:');
    let bcsCount = 0;
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      if (fit.modules[slotType]) {
        bcsCount += fit.modules[slotType].filter(m => m && m.name && m.name.includes('Ballistic Control System')).length;
      }
    }
    console.log(`  BCS Count: ${bcsCount}`);
    console.log(`  Expected BCS Bonus: ~${(bcsCount * 10).toFixed(1)}% (with stacking penalties)`);
    
    // 6. Calculate expected DPS manually
    console.log('\n6. MANUAL DPS CALCULATION:');
    const totalBaseDamage = emBase + thermalBase + kineticBase + explosiveBase;
    const totalModifiedDamage = emModified + thermalModified + kineticModified + explosiveModified;
    const avgRofModified = (await fitSimulator.getModifiedAttribute('Heavy Missile Launcher II_0', 51)) || rofBase;
    const cycleTimeSeconds = avgRofModified / 1000;
    const launcherCount = 5;
    
    console.log(`  Base Damage per Missile: ${totalBaseDamage}`);
    console.log(`  Modified Damage per Missile: ${totalModifiedDamage}`);
    console.log(`  Cycle Time: ${avgRofModified}ms = ${cycleTimeSeconds}s`);
    console.log(`  Launcher Count: ${launcherCount}`);
    console.log(`  Manual DPS: ${(totalModifiedDamage * launcherCount / cycleTimeSeconds).toFixed(2)}`);
    
    // 7. Compare with our app's calculation
    const stats = await fitCalculator.calculateFitStats(normalizedFit);
    console.log(`  Our App DPS: ${stats.dps.total.toFixed(2)}`);
    console.log(`  Expected DPS: 345`);
    console.log(`  Accuracy: ${(stats.dps.total / 345 * 100).toFixed(1)}%`);
    
    // 8. Debug ModifiedAttributeStore state
    console.log('\n8. MODIFIED ATTRIBUTE STORE DEBUG:');
    console.log(`  Available charge attributes keys: ${Array.from(fitSimulator.chargeAttributes.keys()).join(', ')}`);
    
    if (fitSimulator.chargeAttributes.has(missileName)) {
      const chargeAttrs = fitSimulator.chargeAttributes.get(missileName);
      console.log(`  Charge attributes for ${missileName}:`);
      console.log(`  Attributes object:`, chargeAttrs);
      
      // Try to access the attribute values correctly
      const em = chargeAttrs.get(114);
      const thermal = chargeAttrs.get(118);
      const kinetic = chargeAttrs.get(117);
      const explosive = chargeAttrs.get(116);
      
      console.log(`    EM (114): ${em}`);
      console.log(`    Thermal (118): ${thermal}`);
      console.log(`    Kinetic (117): ${kinetic}`);
      console.log(`    Explosive (116): ${explosive}`);
    } else {
      console.log(`  ERROR: No charge attributes found for ${missileName}`);
    }
    
    // 9. Debug charge lookup in module
    console.log('\n9. CHARGE LOOKUP DEBUG:');
    for (const slotType of ['high', 'med', 'low']) {
      for (const module of fit.modules[slotType]) {
        if (module.name && module.name.includes('Heavy Missile Launcher')) {
          console.log(`  Module: ${module.name}`);
          console.log(`  Charge: ${module.charge}`);
          
          if (module.charge) {
            const baseChargeName = module.charge.replace(/\s+x\d+$/, '');
            const cleanedChargeName = baseChargeName.split(',')[0].trim();
            console.log(`  Cleaned charge name: ${cleanedChargeName}`);
            console.log(`  Charge exists in fitSimulator: ${fitSimulator.chargeAttributes.has(cleanedChargeName)}`);
          }
        }
      }
    }
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugMissileCalculationDeep();