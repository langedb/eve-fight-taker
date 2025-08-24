const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugStackingPenalties() {
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
    
    console.log('=== STACKING PENALTY DEBUG ===\n');
    
    // Check charge attribute store state
    const missileName = 'Caldari Navy Scourge Heavy Missile';
    console.log('1. CHARGE ATTRIBUTE STORE STATE:');
    
    if (fitSimulator.chargeAttributes.has(missileName)) {
      const chargeStore = fitSimulator.chargeAttributes.get(missileName);
      console.log(`Missile: ${missileName}`);
      console.log(`Store type: ${chargeStore.constructor.name}`);
      
      // Get kinetic damage attribute (117)
      const baseValue = chargeStore.getBase(117);
      const modifiedValue = chargeStore.get(117);
      console.log(`Base Kinetic Damage (117): ${baseValue}`);
      console.log(`Modified Kinetic Damage (117): ${modifiedValue}`);
      
      // Examine the modifiers applied
      if (chargeStore.modifiers.has(117)) {
        const modifiers = chargeStore.modifiers.get(117);
        console.log(`Number of modifiers on attribute 117: ${modifiers.length}`);
        
        console.log('\n2. DETAILED MODIFIER ANALYSIS:');
        modifiers.forEach((mod, index) => {
          console.log(`  Modifier ${index + 1}:`);
          console.log(`    Value: ${mod.value}`);
          console.log(`    Type: ${mod.type}`);
          console.log(`    Stacking Group: ${mod.stackingGroup}`);
        });
        
        console.log('\n3. STACKING GROUP ANALYSIS:');
        const stackingGroups = new Map();
        modifiers.forEach(mod => {
          if (mod.stackingGroup) {
            if (!stackingGroups.has(mod.stackingGroup)) {
              stackingGroups.set(mod.stackingGroup, []);
            }
            stackingGroups.get(mod.stackingGroup).push(mod);
          }
        });
        
        stackingGroups.forEach((mods, group) => {
          console.log(`  Group "${group}": ${mods.length} modifiers`);
          mods.forEach((mod, idx) => {
            console.log(`    ${idx + 1}: ${mod.value}x (${((mod.value - 1) * 100).toFixed(1)}% bonus)`);
          });
        });
        
        console.log('\n4. EXPECTED STACKING PENALTY CALCULATION:');
        
        // Manual calculation for BCS (group 'bcs')
        if (stackingGroups.has('bcs')) {
          const bcsMods = stackingGroups.get('bcs');
          console.log(`BCS modifiers: ${bcsMods.length}`);
          
          // Sort for stacking penalty
          const sorted = [...bcsMods].map(m => m.value).sort((a, b) => b - a);
          console.log(`Sorted multipliers: [${sorted.join(', ')}]`);
          
          let stackedResult = 1.0;
          const stackingPenalties = [1.0, 0.869, 0.571, 0.283, 0.106];
          
          for (let i = 0; i < sorted.length; i++) {
            const multiplier = sorted[i];
            const penaltyFactor = Math.exp(-Math.pow(i / 2.22292081, 2));
            const penalizedEffect = 1 + (multiplier - 1) * penaltyFactor;
            stackedResult *= penalizedEffect;
            
            console.log(`    BCS ${i + 1}: ${multiplier}x * penalty ${penaltyFactor.toFixed(3)} = ${penalizedEffect.toFixed(3)}x effective`);
          }
          
          console.log(`Expected BCS total multiplier: ${stackedResult.toFixed(3)}x`);
        }
        
        // Check if we're applying BCS bonuses correctly
        console.log('\n5. BCS APPLICATION CHECK:');
        console.log(`FitBonuses BCS count: ${fitSimulator.fitBonuses.modules.bcsCount}`);
        console.log(`FitBonuses BCS bonus per module: ${fitSimulator.fitBonuses.modules.bcsBonusPerModule}`);
      }
    } else {
      console.log(`ERROR: Charge store not found for ${missileName}`);
    }
    
    // Check launcher modifiers too
    console.log('\n6. LAUNCHER ATTRIBUTE ANALYSIS:');
    const launcherKey = 'Heavy Missile Launcher II_0';
    if (fitSimulator.moduleAttributes.has(launcherKey)) {
      const launcherStore = fitSimulator.moduleAttributes.get(launcherKey);
      const baseROF = launcherStore.getBase(51);
      const modifiedROF = launcherStore.get(51);
      console.log(`Launcher: ${launcherKey}`);
      console.log(`Base ROF (51): ${baseROF}ms`);
      console.log(`Modified ROF (51): ${modifiedROF}ms`);
      
      if (launcherStore.modifiers.has(51)) {
        const rofModifiers = launcherStore.modifiers.get(51);
        console.log(`ROF modifiers: ${rofModifiers.length}`);
        rofModifiers.forEach((mod, index) => {
          console.log(`  Modifier ${index + 1}: ${mod.value}x (${mod.type}, ${mod.stackingGroup})`);
        });
      }
    }
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugStackingPenalties();