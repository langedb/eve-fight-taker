const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugOverApplication() {
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
    
    console.log('=== OVER-APPLICATION DEBUG ===\n');
    
    // 1. Check missile damage calculation step by step
    const missileName = 'Caldari Navy Scourge Heavy Missile';
    const missileInfo = await fitCalculator.getItemByName(missileName);
    const missileData = await fitCalculator.staticData.getItemInfo(missileInfo.type_id);
    
    console.log('1. STEP-BY-STEP DAMAGE CALCULATION:');
    const baseKineticDamage = missileData.attributes?.find(attr => attr.attributeID === 117)?.value || 0;
    const modifiedKineticDamage = await fitSimulator.getModifiedAttribute(missileName, 117);
    
    console.log(`Base Kinetic Damage: ${baseKineticDamage}`);
    console.log(`Modified Kinetic Damage: ${modifiedKineticDamage}`);
    console.log(`Damage Multiplier: ${(modifiedKineticDamage / baseKineticDamage).toFixed(3)}x`);
    
    // DEBUG: Check if charge attributes store exists and has modifications
    if (fitSimulator.chargeAttributes.has(missileName)) {
      const chargeStore = fitSimulator.chargeAttributes.get(missileName);
      const directValue = chargeStore.get(117);
      console.log(`Direct store.get(117): ${directValue}`);
      console.log(`Store has modifiers: ${chargeStore.modifiers.has(117) ? chargeStore.modifiers.get(117).length : 0} modifiers`);
    } else {
      console.log(`ERROR: Charge store not found for ${missileName}`);
    }
    
    // 2. Calculate expected damage multiplier manually
    console.log('\n2. EXPECTED DAMAGE MULTIPLIER CALCULATION:');
    const missileSpecBonus = 1 + fitSimulator.fitBonuses.character.missileSpecialization; // 1.10
    const warheadBonus = 1 + fitSimulator.fitBonuses.character.warheadUpgrades; // 1.10
    const heavyMissileBonus = 1 + fitSimulator.fitBonuses.character.heavyMissiles; // 1.25
    
    console.log(`Missile Specialization: ${missileSpecBonus.toFixed(3)}x (${(missileSpecBonus - 1) * 100}%)`);
    console.log(`Warhead Upgrades: ${warheadBonus.toFixed(3)}x (${(warheadBonus - 1) * 100}%)`);
    console.log(`Heavy Missiles: ${heavyMissileBonus.toFixed(3)}x (${(heavyMissileBonus - 1) * 100}%)`);
    
    // Calculate BCS bonuses with stacking penalties
    const bcsCount = 3;
    let bcsMultiplier = 1.0;
    const stackingPenalties = [1.0, 0.869, 0.571, 0.283, 0.106]; // Standard EVE stacking penalties
    
    for (let i = 0; i < bcsCount; i++) {
      const bcsBonus = 0.10 * stackingPenalties[i]; // 10% base bonus with stacking penalty
      bcsMultiplier *= (1 + bcsBonus);
      console.log(`BCS ${i+1}: ${(1 + bcsBonus).toFixed(3)}x (${(bcsBonus * 100).toFixed(1)}% effective)`);
    }
    
    console.log(`Total BCS Multiplier: ${bcsMultiplier.toFixed(3)}x`);
    
    const expectedDamageMultiplier = missileSpecBonus * warheadBonus * heavyMissileBonus * bcsMultiplier;
    console.log(`Expected Total Damage Multiplier: ${expectedDamageMultiplier.toFixed(3)}x`);
    console.log(`Expected Modified Damage: ${(baseKineticDamage * expectedDamageMultiplier).toFixed(1)}`);
    
    // 3. Check ROF calculation
    console.log('\n3. RATE OF FIRE ANALYSIS:');
    const launcherInfo = await fitCalculator.getItemByName('Heavy Missile Launcher II');
    const baseROF = launcherInfo.attributes?.find(attr => attr.attributeID === 51)?.value || 0;
    const modifiedROF = await fitSimulator.getModifiedAttribute('Heavy Missile Launcher II_0', 51);
    
    console.log(`Base ROF: ${baseROF}ms`);
    console.log(`Modified ROF: ${modifiedROF}ms`);
    console.log(`ROF Multiplier: ${(baseROF / modifiedROF).toFixed(3)}x faster`);
    
    // Calculate expected ROF multiplier
    const launcherOpBonus = fitSimulator.fitBonuses.character.missileLauncherOperation; // 0.10
    const rapidLaunchBonus = fitSimulator.fitBonuses.character.rapidLaunch; // 0.15
    const heavySpecBonus = fitSimulator.fitBonuses.character.heavyMissileSpecialization; // 0.10
    const caldariCruiserBonus = fitSimulator.fitBonuses.ship.caldariCruiserMissile; // 0.25
    
    console.log(`Missile Launcher Operation: ${(launcherOpBonus * 100)}% ROF bonus`);
    console.log(`Rapid Launch: ${(rapidLaunchBonus * 100)}% ROF bonus`);
    console.log(`Heavy Missile Spec: ${(heavySpecBonus * 100)}% ROF bonus`);
    console.log(`Caldari Cruiser: ${(caldariCruiserBonus * 100)}% ROF bonus`);
    
    const expectedROFMultiplier = 1 / (1 - (launcherOpBonus + rapidLaunchBonus + heavySpecBonus + caldariCruiserBonus));
    console.log(`Expected ROF Multiplier: ${expectedROFMultiplier.toFixed(3)}x faster`);
    console.log(`Expected Modified ROF: ${(baseROF / expectedROFMultiplier).toFixed(1)}ms`);
    
    // 4. Final DPS calculation
    console.log('\n4. FINAL DPS CALCULATION:');
    const launcherCount = 5;
    const expectedDPS = (baseKineticDamage * expectedDamageMultiplier * expectedROFMultiplier * launcherCount) / (baseROF / 1000);
    console.log(`Expected DPS: ${expectedDPS.toFixed(1)} (${launcherCount} launchers)`);
    
    const stats = await fitCalculator.calculateFitStats(normalizedFit);
    console.log(`Actual DPS: ${stats.dps.total.toFixed(1)}`);
    console.log(`Difference: ${(stats.dps.total - expectedDPS).toFixed(1)} DPS`);
    console.log(`Ratio: ${(stats.dps.total / expectedDPS).toFixed(3)}x`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugOverApplication();