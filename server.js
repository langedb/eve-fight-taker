const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const axios = require('axios');
const { ESIAuth } = require('./lib/esi-auth');
const { CacheManager } = require('./lib/cache-manager');
const { FitCalculator } = require('./lib/fit-calculator');
const { AIAnalyzer } = require('./lib/ai-analyzer');

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
const esiAuth = new ESIAuth({
  clientId: process.env.ESI_CLIENT_ID,
  clientSecret: process.env.ESI_CLIENT_SECRET,
  redirectUri: 'http://localhost:8080/callback'
});

const cacheManager = new CacheManager('./cache');
const fitCalculator = new FitCalculator();
const aiAnalyzer = new AIAnalyzer(process.env.GOOGLE_API_KEY);

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
    const { code, state } = req.query;
    const tokenData = await esiAuth.exchangeCodeForTokens(code);
    
    req.session.accessToken = tokenData.access_token;
    req.session.refreshToken = tokenData.refresh_token;
    
    // Get character info
    const characterInfo = await esiAuth.getCharacterInfo(tokenData.access_token);
    req.session.character = characterInfo;
    
    res.redirect('/?authenticated=true');
  } catch (error) {
    console.error('OAuth callback error:', error);
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
    const fit = await esiAuth.getShipFitting(req.session.accessToken, ship.ship_type_id);
    
    res.json({ ship, fit });
  } catch (error) {
    console.error('Error getting character ship:', error);
    res.status(500).json({ error: 'Failed to get ship data' });
  }
});

app.post('/api/analyze-combat', async (req, res) => {
  try {
    const { currentFit, targetFit } = req.body;
    
    if (!currentFit || !targetFit) {
      return res.status(400).json({ error: 'Both current and target fits required' });
    }
    
    // Calculate stats for both fits
    const currentStats = await fitCalculator.calculateFitStats(currentFit);
    const targetStats = await fitCalculator.calculateFitStats(targetFit);
    
    // Get AI analysis
    const analysis = await aiAnalyzer.analyzeCombat(currentStats, targetStats);
    
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