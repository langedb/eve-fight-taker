const { FitCalculator } = require('./lib/fit-calculator.js');

async function debugMissileBonuses() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  const eft = `[Caracal, Debug]
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II

Heavy Missile Launcher II, Caldari Navy Scourge Heavy Missile x21`;

  try {
    const fit = await fitCalculator.parseEFT(eft);
    const normalizedFit = { ...fit };
    if (fit.shipType && !fit.shipName) {
      normalizedFit.shipName = fit.shipType;
    }
    
    const { FitSimulator } = require('./lib/fit-simulator.js');
    const fitSimulator = new FitSimulator(normalizedFit, fitCalculator.staticData);
    await fitSimulator.applyEffects();
    
    // Check missile damage attributes
    console.log('=== Missile Damage Check ===');
    const missileName = 'Caldari Navy Scourge Heavy Missile';
    const missileInfo = await fitCalculator.getItemByName(missileName);
    const missileData = await fitCalculator.staticData.getItemInfo(missileInfo.type_id);
    const kineticBase = missileData.attributes?.find(attr => attr.attributeID === 117)?.value || 0;
    const kineticModified = await fitSimulator.getModifiedAttribute(missileName, 117) || 0;
    console.log(`Kinetic damage - Base: ${kineticBase}, Modified: ${kineticModified}`);
    
    // Check launcher ROF
    console.log('\n=== Launcher ROF Check ===');
    const launcherName = 'Heavy Missile Launcher II';
    const launcherInfo = await fitCalculator.getItemByName(launcherName);
    const launcherData = await fitCalculator.staticData.getItemInfo(launcherInfo.type_id);
    const rofBase = launcherData.attributes?.find(attr => attr.attributeID === 51)?.value || 0;
    const rofModified = await fitSimulator.getModifiedAttribute(launcherName + '_0', 51) || 0;
    console.log(`ROF - Base: ${rofBase}ms, Modified: ${rofModified}ms`);
    console.log(`ROF improvement: ${((rofBase - rofModified) / rofBase * 100).toFixed(1)}%`);
    
  } catch(e) { console.error('Error:', e.message); }
}

debugMissileBonuses();