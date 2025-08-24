const { FitCalculator } = require('./lib/fit-calculator.js');
const { FitSimulator } = require('./lib/fit-simulator.js');

async function debugROFApplication() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  const eft = `[Caracal, Boss]
Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21`;

  try {
    const fit = await fitCalculator.parseEFT(eft);
    const normalizedFit = { ...fit };
    if (fit.shipType && !fit.shipName) {
      normalizedFit.shipName = fit.shipType;
    }
    
    const fitSimulator = new FitSimulator(normalizedFit, fitCalculator.staticData);
    
    console.log('=== ROF APPLICATION DEBUG ===\n');
    
    // Check launcher info
    const launcherInfo = await fitCalculator.getItemByName('Heavy Missile Launcher II');
    console.log(`Launcher: ${launcherInfo.name}`);
    console.log(`Group ID: ${launcherInfo.group_id}`);
    console.log(`Is Heavy Missile Launcher: ${fitSimulator.isHeavyMissileLauncher(launcherInfo)}`);
    console.log(`Is T2 (contains 'II'): ${launcherInfo.name.includes('II')}`);
    
    // Get base ROF
    const baseROF = launcherInfo.attributes?.find(attr => attr.attributeID === 51)?.value || 0;
    console.log(`Base ROF: ${baseROF}ms`);
    
    await fitSimulator.applyEffects();
    
    // Check modified ROF
    const launcherKey = 'Heavy Missile Launcher II_0';
    if (fitSimulator.moduleAttributes.has(launcherKey)) {
      const launcherStore = fitSimulator.moduleAttributes.get(launcherKey);
      console.log(`\nLauncher store found: ${launcherKey}`);
      console.log(`Modified ROF: ${launcherStore.get(51)}ms`);
      
      // Check individual modifiers
      if (launcherStore.modifiers.has(51)) {
        const modifiers = launcherStore.modifiers.get(51);
        console.log(`\nROF Modifiers applied (${modifiers.length} total):`);
        modifiers.forEach((mod, idx) => {
          console.log(`  ${idx + 1}: ${mod.value}x (${mod.type}, group: ${mod.stackingGroup})`);
        });
        
        // Calculate expected result manually
        console.log('\nManual ROF calculation:');
        let calculatedROF = baseROF;
        modifiers.forEach((mod, idx) => {
          console.log(`  Step ${idx + 1}: ${calculatedROF} × ${mod.value} = ${calculatedROF * mod.value}`);
          calculatedROF *= mod.value;
        });
        console.log(`Expected final ROF: ${calculatedROF}ms`);
        console.log(`Actual final ROF: ${launcherStore.get(51)}ms`);
        console.log(`Values match: ${Math.abs(calculatedROF - launcherStore.get(51)) < 0.01}`);
      }
    }
    
    // Check individual skill applications
    console.log('\n=== SKILL APPLICATION CHECK ===');
    console.log('Skills that should apply ROF bonuses:');
    console.log(`- Missile Launcher Operation: -${fitSimulator.fitBonuses.character.missileLauncherOperation * 100}%`);
    console.log(`- Rapid Launch: -${fitSimulator.fitBonuses.character.rapidLaunch * 100}%`);
    console.log(`- Heavy Missile Specialization: -${fitSimulator.fitBonuses.character.heavyMissileSpecialization * 100}%`);
    console.log(`- Caldari Cruiser: -${fitSimulator.fitBonuses.ship.caldariCruiserMissile * 100}%`);
    
    const totalROFReduction = fitSimulator.fitBonuses.character.missileLauncherOperation + 
                             fitSimulator.fitBonuses.character.rapidLaunch + 
                             fitSimulator.fitBonuses.character.heavyMissileSpecialization + 
                             fitSimulator.fitBonuses.ship.caldariCruiserMissile;
    console.log(`Total ROF reduction: ${totalROFReduction * 100}%`);
    console.log(`Expected final ROF: ${baseROF * (1 - totalROFReduction)}ms`);
    
  } catch(e) { 
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

debugROFApplication();