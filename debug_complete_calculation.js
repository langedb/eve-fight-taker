const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugCompleteCalculation() {
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
    
    console.log('=== COMPLETE CALCULATION DEBUG ===\n');
    
    // 1. Check all skills being applied
    console.log('1. SKILL BONUSES APPLIED:');
    console.log(`Missile Launcher Operation: ${(fitSimulator.fitBonuses.character.missileLauncherOperation * 100).toFixed(1)}% ROF`);
    console.log(`Missile Specialization (legacy): ${(fitSimulator.fitBonuses.character.missileSpecialization * 100).toFixed(1)}% damage`);
    console.log(`Warhead Upgrades: ${(fitSimulator.fitBonuses.character.warheadUpgrades * 100).toFixed(1)}% damage`);
    console.log(`Heavy Missiles: ${(fitSimulator.fitBonuses.character.heavyMissiles * 100).toFixed(1)}% damage`);
    console.log(`Heavy Missile Specialization: ${(fitSimulator.fitBonuses.character.heavyMissileSpecialization * 100).toFixed(1)}% ROF`);
    console.log(`Rapid Launch: ${(fitSimulator.fitBonuses.character.rapidLaunch * 100).toFixed(1)}% ROF`);
    console.log(`Caldari Cruiser: ${(fitSimulator.fitBonuses.ship.caldariCruiserMissile * 100).toFixed(1)}% ROF`);
    
    // 2. Check BCS modules
    console.log('\n2. BCS MODULE ANALYSIS:');
    console.log(`BCS Count: ${fitSimulator.fitBonuses.modules.bcsCount}`);
    console.log(`BCS Bonus per module: ${(fitSimulator.fitBonuses.modules.bcsBonusPerModule * 100).toFixed(1)}%`);
    
    // 3. Calculate expected total multipliers manually
    console.log('\n3. EXPECTED MULTIPLIER CALCULATION:');
    
    // Damage multipliers (skills + BCS with stacking)
    const skillDamageMultiplier = (1 + fitSimulator.fitBonuses.character.missileSpecialization) * 
                                  (1 + fitSimulator.fitBonuses.character.warheadUpgrades) * 
                                  (1 + fitSimulator.fitBonuses.character.heavyMissiles);
    console.log(`Skill damage multiplier: ${skillDamageMultiplier.toFixed(3)}x`);
    
    // BCS with stacking penalties
    const bcsCount = fitSimulator.fitBonuses.modules.bcsCount;
    let bcsMultiplier = 1.0;
    if (bcsCount > 0) {
      const penaltyFactors = [1.0, 0.8691, 0.5706, 0.2832, 0.1059, 0.0421]; // EVE stacking penalties
      for (let i = 0; i < bcsCount; i++) {
        const penalizedBonus = fitSimulator.fitBonuses.modules.bcsBonusPerModule * penaltyFactors[i];
        bcsMultiplier *= (1 + penalizedBonus);
        console.log(`  BCS ${i + 1}: ${((1 + penalizedBonus) * 100 - 100).toFixed(1)}% effective (penalty: ${(penaltyFactors[i] * 100).toFixed(1)}%)`);
      }
    }
    console.log(`BCS total multiplier: ${bcsMultiplier.toFixed(3)}x`);
    
    const totalDamageMultiplier = skillDamageMultiplier * bcsMultiplier;
    console.log(`Total damage multiplier: ${totalDamageMultiplier.toFixed(3)}x`);
    
    // ROF multipliers
    const rofReduction = fitSimulator.fitBonuses.character.missileLauncherOperation + 
                        fitSimulator.fitBonuses.character.heavyMissileSpecialization + 
                        fitSimulator.fitBonuses.character.rapidLaunch + 
                        fitSimulator.fitBonuses.ship.caldariCruiserMissile;
    const rofMultiplier = 1 / (1 - rofReduction);
    console.log(`ROF multiplier: ${rofMultiplier.toFixed(3)}x (${(rofReduction * 100).toFixed(1)}% total bonus)`);
    
    // 4. Check actual values from stores
    console.log('\n4. ACTUAL STORE VALUES:');
    const missileName = 'Caldari Navy Scourge Heavy Missile';
    const launcherName = 'Heavy Missile Launcher II_0';
    
    if (fitSimulator.chargeAttributes.has(missileName)) {
      const chargeStore = fitSimulator.chargeAttributes.get(missileName);
      const baseKinetic = chargeStore.getBase(117);
      const modifiedKinetic = chargeStore.get(117);
      console.log(`Missile base kinetic: ${baseKinetic}`);
      console.log(`Missile modified kinetic: ${modifiedKinetic}`);
      console.log(`Actual damage multiplier: ${(modifiedKinetic / baseKinetic).toFixed(3)}x`);
    }
    
    if (fitSimulator.moduleAttributes.has(launcherName)) {
      const launcherStore = fitSimulator.moduleAttributes.get(launcherName);
      const baseROF = launcherStore.getBase(51);
      const modifiedROF = launcherStore.get(51);
      console.log(`Launcher base ROF: ${baseROF}ms`);
      console.log(`Launcher modified ROF: ${modifiedROF}ms`);
      console.log(`Actual ROF multiplier: ${(baseROF / modifiedROF).toFixed(3)}x`);
    }
    
    // 5. Manual DPS calculation
    console.log('\n5. MANUAL DPS CALCULATION:');
    const baseDamage = 171; // Base kinetic damage
    const actualModifiedDamage = 321.44; // From store
    const actualModifiedROF = 4350; // Expected modified ROF
    const launchers = 5;
    
    const manualDPS = (actualModifiedDamage * launchers * 1000) / actualModifiedROF;
    console.log(`Manual DPS: (${actualModifiedDamage} × ${launchers} × 1000) / ${actualModifiedROF} = ${manualDPS.toFixed(2)}`);
    
    // 6. Compare with app calculation
    const stats = await fitCalculator.calculateFitStats(normalizedFit);
    console.log(`App calculated DPS: ${stats.dps.total.toFixed(2)}`);
    console.log(`Expected DPS: 345`);
    console.log(`Difference: ${(345 - stats.dps.total).toFixed(1)} DPS`);
    console.log(`Accuracy: ${(stats.dps.total / 345 * 100).toFixed(1)}%`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugCompleteCalculation();