const axios = require('axios');

async function testCharacterSearch() {
  console.log('Testing ESI character search...\n');
  
  // Test with some well-known characters that should exist
  const testCharacters = [
    'Chribba',           // Very famous EVE player
    'The Mittani',       // Former CSM chair
    'CCP Swift',         // CCP dev
    'CCP Dopamine'       // CCP dev
  ];
  
  for (const characterName of testCharacters) {
    try {
      console.log(`Testing character: "${characterName}"`);
      const searchUrl = `https://esi.evetech.net/latest/search/?categories=character&search=${encodeURIComponent(characterName)}&strict=false`;
      console.log(`URL: ${searchUrl}`);
      
      const searchResponse = await axios.get(searchUrl);
      console.log(`Response status: ${searchResponse.status}`);
      console.log(`Response data:`, searchResponse.data);
      
      if (searchResponse.data.character && searchResponse.data.character.length > 0) {
        const characterId = searchResponse.data.character[0];
        console.log(`✅ Found character ID: ${characterId}`);
        
        // Get character info
        const characterInfoUrl = `https://esi.evetech.net/latest/characters/${characterId}/`;
        const characterInfoResponse = await axios.get(characterInfoUrl);
        console.log(`Character info:`, {
          name: characterInfoResponse.data.name,
          corporation_id: characterInfoResponse.data.corporation_id
        });
      } else {
        console.log(`❌ No character found in response`);
      }
      
    } catch (error) {
      console.log(`❌ Error for "${characterName}":`, error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error data:', error.response.data);
      }
    }
    console.log('---\n');
  }
  
  // Test the exact search that failed
  console.log('=== Testing the exact search that failed ===');
  try {
    const failedCharacterName = 'Reab Fermalen';
    console.log(`Testing character: "${failedCharacterName}"`);
    const searchUrl = `https://esi.evetech.net/latest/search/?categories=character&search=${encodeURIComponent(failedCharacterName)}&strict=false`;
    console.log(`URL: ${searchUrl}`);
    
    const searchResponse = await axios.get(searchUrl);
    console.log('✅ Success:', searchResponse.data);
    
  } catch (error) {
    console.log(`❌ Failed as expected:`, error.response?.status, error.response?.statusText);
    console.log('Error data:', error.response?.data);
  }
}

testCharacterSearch().catch(console.error);