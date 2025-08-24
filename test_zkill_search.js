const axios = require('axios');

async function testZkillSearch() {
  console.log('Testing zKillboard search...\n');
  
  // Test with some characters that should have killmail activity
  const testCharacters = [
    'PL',               // Alliance/corp
    'Goons',           // Alliance
    'Chribba',         // Famous player
    'TEST'             // Alliance
  ];
  
  for (const characterName of testCharacters) {
    try {
      console.log(`Testing search: "${characterName}"`);
      const zkillSearchUrl = `https://zkillboard.com/api/search/${encodeURIComponent(characterName)}/`;
      console.log(`URL: ${zkillSearchUrl}`);
      
      const zkillResponse = await axios.get(zkillSearchUrl, {
        headers: {
          'User-Agent': 'EVE Fight Taker - Combat Analysis Tool'
        }
      });
      
      console.log(`Response status: ${zkillResponse.status}`);
      console.log(`Response data length:`, zkillResponse.data?.length || 0);
      
      if (zkillResponse.data && zkillResponse.data.length > 0) {
        console.log('First few results:');
        zkillResponse.data.slice(0, 3).forEach((item, index) => {
          console.log(`  ${index + 1}. Type: ${item.type}, Name: ${item.name}, ID: ${item.id}`);
        });
        
        // Look for characters specifically
        const characterResults = zkillResponse.data.filter(item => item.type === 'character');
        if (characterResults.length > 0) {
          console.log(`✅ Found ${characterResults.length} character(s):`);
          characterResults.slice(0, 3).forEach((char, index) => {
            console.log(`  ${index + 1}. ${char.name} (ID: ${char.id})`);
          });
        } else {
          console.log(`ℹ️ No characters found (found ${zkillResponse.data.length} other results)`);
        }
      } else {
        console.log(`❌ No results found`);
      }
      
    } catch (error) {
      console.log(`❌ Error for "${characterName}":`, error.response?.status, error.response?.statusText);
      if (error.response?.data) {
        console.log('Error data:', error.response.data);
      }
    }
    console.log('---\n');
  }
}

testZkillSearch().catch(console.error);