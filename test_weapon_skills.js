const { FitCalculator } = require('./lib/fit-calculator.js');

async function testWeaponSkills() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  console.log('=== WEAPON SKILLS TEST ===\n');
  
  // Test different weapon types
  const testFits = [
    {
      name: "Light Missile Test",
      eft: `[Corax, Light Missile Test]
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile`,
      expectedROFBonus: "Light Missile Specialization ROF"
    },
    {
      name: "HAM Test", 
      eft: `[Sacrilege, HAM Test]
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile`,
      expectedROFBonus: "Heavy Assault Missile Specialization ROF"
    },
    {
      name: "Blaster Test",
      eft: `[Talos, Blaster Test]
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M`,
      expectedDamageBonus: "Medium Blaster Specialization Damage"
    }
  ];
  
  for (const testFit of testFits) {
    try {
      const fit = await fitCalculator.parseEFT(testFit.eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      console.log(`${testFit.name}:`);
      console.log(`  DPS: ${stats.dps.total.toFixed(1)}`);
      console.log(`  Expected bonus: ${testFit.expectedROFBonus || testFit.expectedDamageBonus}`);
      console.log('');
    } catch (e) {
      console.log(`${testFit.name}: ERROR - ${e.message}`);
    }
  }
}

testWeaponSkills().catch(console.error);