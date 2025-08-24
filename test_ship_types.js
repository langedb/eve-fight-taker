const { FitCalculator } = require('./lib/fit-calculator.js');

async function testShipTypes() {
  const fitCalculator = new FitCalculator();
  await fitCalculator.ensureStaticData();
  
  console.log('Testing ship types functionality...');
  
  try {
    const shipTypes = await fitCalculator.staticData.getShipTypes();
    
    console.log(`Found ${shipTypes.length} ship groups:`);
    
    // Show first few groups
    for (let i = 0; i < Math.min(5, shipTypes.length); i++) {
      const group = shipTypes[i];
      console.log(`\n${group.groupName}: ${group.ships.length} ships`);
      
      // Show first few ships in each group
      for (let j = 0; j < Math.min(3, group.ships.length); j++) {
        const ship = group.ships[j];
        console.log(`  - ${ship.name} (ID: ${ship.typeId})`);
      }
      if (group.ships.length > 3) {
        console.log(`  ... and ${group.ships.length - 3} more`);
      }
    }
    
    // Test character search (ESI endpoint)
    console.log('\n=== Testing Character Search ===');
    const axios = require('axios');
    
    try {
      const testCharacter = 'CCP Falcon'; // Well-known character
      const searchUrl = `https://esi.evetech.net/latest/search/?categories=character&search=${encodeURIComponent(testCharacter)}&strict=false`;
      const searchResponse = await axios.get(searchUrl);
      
      if (searchResponse.data.character && searchResponse.data.character.length > 0) {
        const characterId = searchResponse.data.character[0];
        console.log(`Found character "${testCharacter}" with ID: ${characterId}`);
        
        // Get character info
        const characterInfoUrl = `https://esi.evetech.net/latest/characters/${characterId}/`;
        const characterInfoResponse = await axios.get(characterInfoUrl);
        console.log(`Character details:`, {
          name: characterInfoResponse.data.name,
          corporation_id: characterInfoResponse.data.corporation_id
        });
        
      } else {
        console.log('No character found');
      }
    } catch (error) {
      console.log('Character search error:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testShipTypes().catch(console.error);