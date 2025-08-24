const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugMissingBonuses() {
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
    
    console.log('=== MISSING BONUSES DEBUG ===\n');
    
    // Check if Heavy Missile Specialization is being applied
    console.log('1. HEAVY MISSILE SPECIALIZATION CHECK:');
    const launcherName = 'Heavy Missile Launcher II';
    const launcherInfo = await fitCalculator.getItemByName(launcherName);
    
    console.log(`Launcher: ${launcherName}`);
    console.log(`Launcher name includes 'II': ${launcherInfo.name.includes('II')}`);
    console.log(`Launcher group_id: ${launcherInfo.group_id}`);
    console.log(`Expected group_id for Heavy Missile Launcher: 509`);
    console.log(`Is Heavy Missile Launcher: ${fitSimulator.isHeavyMissileLauncher(launcherInfo)}`);
    console.log(`Heavy Missile Specialization bonus: ${fitSimulator.fitBonuses.character.heavyMissileSpecialization * 100}%`);
    
    // Check current ROF values
    console.log('\n2. ROF ANALYSIS:');
    const baseROF = launcherInfo.attributes?.find(attr => attr.attributeID === 51)?.value || 0;
    console.log(`Base ROF: ${baseROF}ms`);
    
    for (let i = 0; i < 5; i++) {
      const modifiedROF = await fitSimulator.getModifiedAttribute(`Heavy Missile Launcher II_${i}`, 51);
      console.log(`Launcher ${i} ROF: ${baseROF}ms → ${modifiedROF}ms (${((baseROF - modifiedROF) / baseROF * 100).toFixed(1)}% faster)`);
    }
    
    // Calculate expected ROF improvement
    const expectedROFImprovement = (fitSimulator.fitBonuses.character.missileLauncherOperation + fitSimulator.fitBonuses.character.heavyMissileSpecialization + fitSimulator.fitBonuses.ship.caldariCruiserMissile) * 100;
    console.log(`Expected total ROF improvement: ${expectedROFImprovement.toFixed(1)}% (Launcher Op: ${fitSimulator.fitBonuses.character.missileLauncherOperation * 100}% + Heavy Spec: ${fitSimulator.fitBonuses.character.heavyMissileSpecialization * 100}% + Caldari Cruiser: ${fitSimulator.fitBonuses.ship.caldariCruiserMissile * 100}%)`);
    
    // Check other potential missing bonuses
    console.log('\n3. OTHER POTENTIAL MISSING BONUSES:');
    
    // Rapid Launch skill (3% ROF per level)
    console.log('Rapid Launch skill: NOT IMPLEMENTED (3% ROF per level = 15% at V)');
    
    // Missile Projection skill (10% missile velocity per level)
    console.log('Missile Projection skill: NOT NEEDED for damage calculation');
    
    // Missile Bombardment skill (20% missile flight time per level)  
    console.log('Missile Bombardment skill: NOT NEEDED for damage calculation');
    
    // BCS stacking penalties check
    console.log('\n4. BCS STACKING PENALTY CHECK:');
    const bcsModules = [];
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      if (fit.modules[slotType]) {
        for (const module of fit.modules[slotType]) {
          if (module && module.name && module.name.includes('Ballistic Control System')) {
            bcsModules.push(module.name);
          }
        }
      }
    }
    console.log(`BCS modules found: ${bcsModules.length} (${bcsModules.join(', ')})`);
    console.log('Expected BCS bonuses with stacking penalties:');
    console.log('1st BCS: 10.0%');
    console.log('2nd BCS: 10.0% × 0.869 = 8.69%');
    console.log('3rd BCS: 10.0% × 0.571 = 5.71%');
    console.log('Total expected: ~24.4% damage increase');
    
    const stats = await fitCalculator.calculateFitStats(normalizedFit);
    console.log(`\nCurrent DPS: ${stats.dps.total.toFixed(2)}`);
    console.log(`Expected DPS: 345`);
    console.log(`Gap: ${(345 - stats.dps.total).toFixed(0)} DPS`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugMissingBonuses();