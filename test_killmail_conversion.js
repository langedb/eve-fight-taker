const { FitCalculator } = require('./lib/fit-calculator.js');

async function testKillmailConversion() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  console.log('Testing killmail to EFT conversion...');
  
  // Sample killmail data structure (simplified)
  const sampleKillmail = {
    killmail_id: 123456789,
    killmail_time: "2024-01-15T14:30:22Z",
    victim: {
      ship_type_id: 621, // Caracal
      character_id: 987654321,
      items: [
        // High slots
        { item_type_id: 25847, flag: 27, items: [{ item_type_id: 212 }] }, // Heavy Missile Launcher II + Caldari Navy Scourge Heavy Missile
        { item_type_id: 25847, flag: 28, items: [{ item_type_id: 212 }] },
        { item_type_id: 25847, flag: 29, items: [{ item_type_id: 212 }] },
        { item_type_id: 25847, flag: 30, items: [{ item_type_id: 212 }] },
        { item_type_id: 25847, flag: 31, items: [{ item_type_id: 212 }] },
        
        // Medium slots
        { item_type_id: 1978, flag: 19 }, // Small Shield Extender II
        { item_type_id: 1978, flag: 20 },
        { item_type_id: 10246, flag: 21 }, // Sensor Booster II
        
        // Low slots
        { item_type_id: 2048, flag: 11 }, // Ballistic Control System II
        { item_type_id: 2048, flag: 12 },
        
        // Drones
        { item_type_id: 2188, quantity_destroyed: 2 }, // Warrior II x2
        
        // Cargo
        { item_type_id: 212, quantity_destroyed: 1000 }, // More missiles in cargo
      ]
    }
  };
  
  try {
    const eftText = await fitCalculator.killmailToEFT(sampleKillmail);
    console.log('\n=== Generated EFT Text ===');
    console.log(eftText);
    
    // Test parsing the generated EFT
    console.log('\n=== Testing EFT Parsing ===');
    const parsedFit = await fitCalculator.parseEFT(eftText);
    console.log('Parsed fit ship:', parsedFit.shipType);
    console.log('High slots:', parsedFit.modules.high.length);
    console.log('Med slots:', parsedFit.modules.med.length);
    console.log('Low slots:', parsedFit.modules.low.length);
    console.log('Drones:', parsedFit.drones.length);
    
    // Calculate stats
    const stats = await fitCalculator.calculateFitStats(parsedFit);
    console.log('\n=== Calculated Stats ===');
    console.log('DPS:', stats.dps.total.toFixed(1));
    console.log('EHP:', stats.ehp.total.toFixed(0));
    console.log('Speed:', stats.speed.toFixed(1), 'm/s');
    
  } catch (error) {
    console.error('Error:', error);
    console.error(error.stack);
  }
}

testKillmailConversion().catch(console.error);