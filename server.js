const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const axios = require('axios');
const { ESIAuth } = require('./lib/esi-auth');
const { CacheManager } = require('./lib/cache-manager');
const { FitCalculator } = require('./lib/fit-calculator');
const { AIAnalyzer } = require('./lib/ai-analyzer');
const { ZKillboardParser } = require('./lib/zkillboard-parser');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: process.env.SESSION_SECRET || 'eve-fight-taker-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize services
console.log('ESI_CLIENT_ID:', process.env.ESI_CLIENT_ID ? 'Set' : 'Not set');
const esiAuth = new ESIAuth({
  clientId: process.env.ESI_CLIENT_ID,
  clientSecret: process.env.ESI_CLIENT_SECRET,
  redirectUri: 'http://localhost:8080/callback'
});

const cacheManager = new CacheManager('./cache');
const fitCalculator = new FitCalculator();
const aiAnalyzer = new AIAnalyzer(process.env.GOOGLE_API_KEY);
const zkillboardParser = new ZKillboardParser();

// Initialize static data
(async () => {
  console.log('Initializing static data...');
  await fitCalculator.ensureStaticData(); // Ensure staticData is initialized
  console.log('Static data loaded successfully');
})();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ESI OAuth routes
app.get('/auth', (req, res) => {
  const authUrl = esiAuth.getAuthorizationUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;
    console.log('OAuth callback - code received:', code ? 'Yes' : 'No');
    
    const tokenData = await esiAuth.exchangeCodeForTokens(code);
    console.log('Token data received:', tokenData ? 'Yes' : 'No');
    console.log('Access token:', tokenData.access_token ? tokenData.access_token.substring(0, 20) + '...' : 'None');
    
    req.session.accessToken = tokenData.access_token;
    req.session.refreshToken = tokenData.refresh_token;
    
    // Get character info
    const characterInfo = await esiAuth.getCharacterInfo(tokenData.access_token);
    req.session.character = characterInfo;
    
    res.redirect('/?authenticated=true');
  } catch (error) {
    console.error('OAuth callback error:', error.message);
    console.error('Error details:', error.response?.data || 'No response data');
    res.redirect('/?error=auth_failed');
  }
});

// API Routes
app.get('/api/character/ship', async (req, res) => {
  try {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const ship = await esiAuth.getCurrentShip(req.session.accessToken);
    
    // Get ship type name from static data
    const shipInfo = await fitCalculator.staticData.getItemInfo(ship.ship_type_id);
    const shipTypeName = shipInfo ? shipInfo.name : `Ship Type ${ship.ship_type_id}`;
    
    // Use the actual ship name from ESI if available, otherwise use ship type name
    const shipName = ship.ship_name || shipTypeName;
    const fitName = ship.ship_name ? ship.ship_name : 'Current Ship';
    
    // Create a basic EFT format for the current ship 
    // Note: ESI doesn't provide fitted modules for security reasons
    const eftFormat = `[${shipTypeName}, ${fitName}]\n[Empty High slot]\n[Empty High slot]\n\n[Empty Med slot]\n[Empty Med slot]\n\n[Empty Low slot]\n[Empty Low slot]\n\n[Empty Rig slot]\n\n\n\nNote: ESI API does not provide access to fitted modules for security reasons.\nThis shows only ship type and name. For full fitting analysis,\nplease paste your EFT fit in the Target Ship section.`;
    
    // Calculate stats for current ship hull only
    const parsedFit = { 
      shipType: shipTypeName, 
      fitName: fitName, 
      modules: { high: [], med: [], low: [], rig: [], subsystem: [] },
      drones: [],
      cargo: [],
      implants: []
    };
    const stats = await fitCalculator.calculateFitStats(parsedFit);
    
    res.json({ 
      ship: { 
        ...ship, 
        ship_type_name: shipTypeName,
        display_name: shipName
      }, 
      fit: parsedFit,
      stats: stats,
      eft: eftFormat
    });
  } catch (error) {
    console.error('Error getting character ship:', error);
    res.status(500).json({ error: 'Failed to get ship data' });
  }
});

app.get('/api/fittings', async (req, res) => {
  try {
    if (!req.session.accessToken) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const fittings = await esiAuth.getAllFittings(req.session.accessToken);
    res.json(fittings);
  } catch (error) {
    console.error('Error getting fittings:', error);
    res.status(500).json({ error: 'Failed to retrieve fittings' });
  }
});

app.post('/api/convert-esi-to-eft', async (req, res) => {
  try {
    const { esiFitting } = req.body;
    if (!esiFitting) {
      return res.status(400).json({ error: 'ESI fitting data required' });
    }
    const eftText = await fitCalculator.esiToEFT(esiFitting);
    res.json({ eftText });
  } catch (error) {
    console.error('Error converting ESI to EFT:', error);
    res.status(500).json({ error: 'Failed to convert ESI fitting to EFT' });
  }
});

app.post('/api/analyze-combat', async (req, res) => {
  try {
    const { currentFit, targetFit } = req.body;
    
    if (!currentFit || !targetFit) {
      return res.status(400).json({ error: 'Both current and target fits required' });
    }
    
    console.log('DEBUG: Received fit data');
    console.log('Current fit ship:', currentFit.shipType);
    console.log('Target fit ship:', targetFit.shipType);
    console.log('Current fit high slots:', currentFit.modules?.high?.length || 0);
    console.log('Target fit high slots:', targetFit.modules?.high?.length || 0);
    
    // Calculate stats for both fits
    const currentStats = await fitCalculator.calculateFitStats(currentFit);
    const targetStats = await fitCalculator.calculateFitStats(targetFit);
    
    // Get AI analysis with complete fit data
    const analysis = await aiAnalyzer.analyzeCombat(
      { stats: currentStats, fit: currentFit },
      { stats: targetStats, fit: targetFit }
    );
    
    console.log('DEBUG: AI analysis result');
    console.log('Has ammo recommendations:', !!(analysis.ammoRecommendations?.length));
    console.log('Has module recommendations:', !!(analysis.moduleRecommendations?.length));
    
    res.json({
      currentStats,
      targetStats,
      analysis
    });
  } catch (error) {
    console.error('Error analyzing combat:', error);
    res.status(500).json({ error: 'Failed to analyze combat' });
  }
});

app.post('/api/parse-eft', async (req, res) => {
  try {
    const { eftText } = req.body;
    
    if (!eftText) {
      return res.status(400).json({ error: 'EFT text required' });
    }
    
    const parsedFit = await fitCalculator.parseEFT(eftText);
    const stats = await fitCalculator.calculateFitStats(parsedFit);
    
    res.json({ fit: parsedFit, stats });
  } catch (error) {
    console.error('Error parsing EFT:', error);
    res.status(500).json({ error: 'Failed to parse EFT fit' });
  }
});

app.post('/api/parse-zkill', async (req, res) => {
  try {
    const { zkillUrl } = req.body;
    
    if (!zkillUrl) {
      return res.status(400).json({ error: 'zKillboard URL required' });
    }
    
    console.log('Parsing zKillboard URL:', zkillUrl);
    
    // Parse the zKillboard URL and get EFT format
    const zkillData = await zkillboardParser.parseZKillboardURL(zkillUrl);
    
    console.log('=== EFT TEXT FROM ZKILLBOARD ===');
    console.log(zkillData.eftText);
    console.log('=== END EFT TEXT ===');
    
    // Parse the EFT format using our existing parser
    const parsedFit = await fitCalculator.parseEFT(zkillData.eftText);
    const stats = await fitCalculator.calculateFitStats(parsedFit);
    
    // Add zkillboard metadata
    parsedFit.zkillboard = {
      killID: zkillData.killID,
      originalUrl: zkillData.originalUrl,
      killTime: zkillData.killTime
    };
    
    res.json({ fit: parsedFit, stats });
  } catch (error) {
    console.error('Error parsing zKillboard URL:', error);
    res.status(500).json({ error: 'Failed to parse zKillboard URL: ' + error.message });
  }
});

app.get('/api/zkillboard/:shipTypeId', async (req, res) => {
  try {
    const { shipTypeId } = req.params;
    const cacheKey = `zkb_${shipTypeId}`;
    
    // Check cache first
    let data = await cacheManager.get(cacheKey);
    
    if (!data) {
      // Fetch from zKillboard
      const response = await axios.get(`https://zkillboard.com/api/shipID/${shipTypeId}/`);
      data = response.data;
      
      // Cache for 1 hour
      await cacheManager.set(cacheKey, data, 3600);
    }
    
    res.json(data);
  } catch (error) {
    console.error('Error fetching zKillboard data:', error);
    res.status(500).json({ error: 'Failed to fetch killboard data' });
  }
});

app.get('/api/get-ship-name/:ship_type_id', async (req, res) => {
  try {
    const { ship_type_id } = req.params;
    
    // Use static data to look up ship name
    const shipInfo = await fitCalculator.staticData.getItemInfo(parseInt(ship_type_id));
    
    if (shipInfo) {
      res.json({ name: shipInfo.name });
    } else {
      res.status(404).json({ error: 'Ship type not found' });
    }
  } catch (error) {
    console.error('Error getting ship name:', error);
    res.status(500).json({ error: 'Failed to get ship name' });
  }
});

// Character search endpoint using authenticated ESI
app.get('/api/search/character/:characterName', async (req, res) => {
  try {
    const { characterName } = req.params;
    
    if (!characterName || characterName.length < 3) {
      return res.status(400).json({ error: 'Character name must be at least 3 characters' });
    }

    console.log(`Searching for character: "${characterName}"`);
    
    // Use the current ESI POST /universe/ids/ endpoint (no authentication required)
    const searchUrl = `https://esi.evetech.net/latest/universe/ids/`;
    console.log(`Using ESI POST /universe/ids/ for character search`);
    
    try {
      const searchResponse = await axios.post(searchUrl, 
        [characterName], // Array of names to search for
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'EVE Fight Taker - Combat Analysis Tool'
          }
        }
      );
      
      console.log('ESI search response:', searchResponse.data);
      
      if (!searchResponse.data.characters || searchResponse.data.characters.length === 0) {
        return res.status(404).json({ 
          error: `No character found named "${characterName}".`,
          suggestion: 'Make sure the character name is spelled exactly as it appears in game.'
        });
      }

      const character = searchResponse.data.characters[0];
      const characterId = character.id;
      console.log(`Found character: ${character.name} (ID: ${characterId})`);

      // Get additional character info (this endpoint is public, no auth needed)
      const characterInfoUrl = `https://esi.evetech.net/latest/characters/${characterId}/`;
      const characterInfoResponse = await axios.get(characterInfoUrl, {
        headers: {
          'User-Agent': 'EVE Fight Taker - Combat Analysis Tool'
        }
      });

      res.json({
        character_id: characterId,
        name: character.name,
        corporation_id: characterInfoResponse.data.corporation_id,
        alliance_id: characterInfoResponse.data.alliance_id,
        source: 'ESI'
      });

    } catch (esiError) {
      console.log(`ESI search failed for "${characterName}":`, esiError.response?.status, esiError.response?.statusText);
      console.log('Error details:', esiError.response?.data);
      
      if (esiError.response?.status === 404) {
        return res.status(404).json({ 
          error: `Character "${characterName}" not found.`,
          suggestion: 'Make sure the character name is spelled exactly as it appears in game.'
        });
      } else if (esiError.response?.status === 400) {
        return res.status(400).json({
          error: 'Invalid character name format.',
          suggestion: 'Please enter a valid EVE character name.'
        });
      }
      
      throw esiError;
    }

  } catch (error) {
    console.error('Error searching for character:', error);
    res.status(500).json({ 
      error: 'Character search failed.',
      suggestion: 'Please try again or use the manual EFT input method instead.'
    });
  }
});

// Get ship types endpoint (for dropdown)
app.get('/api/ship-types', async (req, res) => {
  try {
    const shipTypes = await fitCalculator.staticData.getShipTypes();
    res.json(shipTypes);
  } catch (error) {
    console.error('Error getting ship types:', error);
    res.status(500).json({ error: 'Failed to get ship types' });
  }
});

// Get character's most recent death in specific ship type
app.get('/api/character/:characterId/death/:shipTypeId', async (req, res) => {
  try {
    const { characterId, shipTypeId } = req.params;

    console.log(`Looking for death data: characterId=${characterId}, shipTypeId=${shipTypeId}`);

    // Get recent losses from zKillboard
    const zkillUrl = `https://zkillboard.com/api/losses/characterID/${characterId}/`;
    console.log(`Fetching zKillboard losses from: ${zkillUrl}`);
    
    const zkillResponse = await axios.get(zkillUrl, {
      headers: {
        'User-Agent': 'EVE Fight Taker - Combat Analysis Tool - Contact: your-email@example.com'
      }
    });

    const killmails = zkillResponse.data;
    console.log(`Found ${killmails.length} total killmails for character`);
    
    // Filter for specific ship type by checking each killmail
    console.log(`Looking for ship type ID: ${shipTypeId} (as integer: ${parseInt(shipTypeId)})`);
    
    let shipTypeKill = null;
    let killmailData = null;
    
    // Check each killmail until we find one with the right ship type
    for (let i = 0; i < Math.min(killmails.length, 20); i++) { // Limit to first 20 to avoid rate limits
      const km = killmails[i];
      console.log(`Checking killmail ${i}: ${km.killmail_id}`);
      
      try {
        // Get full killmail data from ESI
        const killmailUrl = `https://esi.evetech.net/latest/killmails/${km.killmail_id}/${km.zkb.hash}/`;
        const killmailResponse = await axios.get(killmailUrl);
        const fullKillmailData = killmailResponse.data;
        
        console.log(`  Ship type: ${fullKillmailData.victim.ship_type_id}`);
        
        if (fullKillmailData.victim.ship_type_id === parseInt(shipTypeId)) {
          console.log(`  ✅ Match found! Using killmail ${km.killmail_id}`);
          shipTypeKill = km;
          killmailData = fullKillmailData;
          break;
        }
      } catch (error) {
        console.log(`  ❌ Error fetching killmail ${km.killmail_id}:`, error.message);
        continue;
      }
    }
    
    if (!shipTypeKill || !killmailData) {
      return res.status(404).json({ 
        error: 'No recent deaths found in that ship type',
        suggestion: 'The character may not have died in this ship type recently, or the killmail may not be available.'
      });
    }

    // Convert killmail to EFT format
    const eftText = await fitCalculator.killmailToEFT(killmailData);
    
    // Parse the EFT and calculate stats
    const parsedFit = await fitCalculator.parseEFT(eftText);
    const stats = await fitCalculator.calculateFitStats(parsedFit);

    // Add zkillboard metadata
    parsedFit.zkillboard = {
      killID: shipTypeKill.killmail_id,
      originalUrl: `https://zkillboard.com/kill/${shipTypeKill.killmail_id}/`,
      killTime: killmailData.killmail_time
    };

    res.json({
      fit: parsedFit,
      stats: stats,
      eftText: eftText,
      killmail: {
        id: shipTypeKill.killmail_id,
        time: killmailData.killmail_time,
        zkb_url: `https://zkillboard.com/kill/${shipTypeKill.killmail_id}/`
      }
    });
  } catch (error) {
    console.error('Error getting character death:', error);
    
    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Character or killmail not found' });
    }
    
    res.status(500).json({ error: 'Failed to get character death data' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`EVE Fight Taker server running on http://localhost:${PORT}`);
});