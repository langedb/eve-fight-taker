const { FitCalculator } = require('./lib/fit-calculator.js');

async function debugChargeIdentification() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  const chargeName = 'Caldari Navy Scourge Heavy Missile';
  const chargeInfo = await fitCalculator.getItemByName(chargeName);
  
  console.log('=== CHARGE IDENTIFICATION DEBUG ===');
  console.log(`Charge: ${chargeName}`);
  console.log(`Type ID: ${chargeInfo.type_id}`);
  console.log(`Group ID: ${chargeInfo.group_id}`);
  
  // Check what group this charge belongs to
  const groupInfo = await fitCalculator.staticData.getGroupInfo(chargeInfo.group_id);
  console.log(`Group Name: ${groupInfo ? groupInfo.name : 'Unknown'}`);
  
  // Test our identification methods
  console.log('\nGroup ID checks:');
  console.log(`Group 84 (Light Missile): ${chargeInfo.group_id === 84}`);
  console.log(`Group 85 (Heavy Missile): ${chargeInfo.group_id === 85}`);
  console.log(`Group 657 (Heavy Assault Missile): ${chargeInfo.group_id === 657}`);
  
  console.log('\nSkill bonuses:');
  console.log(`Missile Specialization: 10%`);
  console.log(`Warhead Upgrades: 10%`);
  console.log(`Heavy Missiles: 25% (should apply to group 85)`);
  
}

debugChargeIdentification().catch(console.error);