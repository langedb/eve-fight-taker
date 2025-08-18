# EVE Fight Taker

A web-based EVE Online ship combat analysis tool that uses the EVE ESI API, zKillboard API, and Google Gemini AI to provide tactical combat recommendations.

## Features

- **EVE SSO Authentication**: Login with your EVE Online character
- **Current Ship Detection**: Automatically load your current ship and fitting
- **EFT Fit Parsing**: Upload and analyze target ship fits in EFT format
- **Combat Statistics**: Calculate DPS, EHP, speed, and other vital combat stats
- **AI-Powered Analysis**: Get tactical recommendations using Google Gemini AI
- **Smart Caching**: Local disk-based cache with hourly refresh to minimize API calls

## Prerequisites

1. **EVE ESI Application**
   - Create an application at [EVE Developers](https://developers.eveonline.com/)
   - Set callback URL to: `http://localhost:8080/callback`
   - Required scopes:
     - `esi-location.read_location.v1`
     - `esi-location.read_ship_type.v1`
     - `esi-fittings.read_fittings.v1`

2. **Google AI API Key**
   - Get an API key from [Google AI Studio](https://aistudio.google.com/)

## Installation

1. **Clone and Install Dependencies**
   ```bash
   cd /home/davel/eve-fight-taker
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```
   ESI_CLIENT_ID=your_esi_client_id_here
   ESI_CLIENT_SECRET=your_esi_client_secret_here
   GOOGLE_API_KEY=your_google_api_key_here
   SESSION_SECRET=your_session_secret_here
   PORT=8080
   ```

3. **Start the Server**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Access the Application**
   Open your browser to: `http://localhost:8080`

## Usage

1. **Login**: Click "Login with EVE SSO" and authenticate with your EVE character
2. **Load Current Ship**: Click "Load Current Ship" to get your current ship stats
3. **Add Target Fit**: Paste an EFT format fit in the text area and click "Parse Fit"
4. **Analyze Combat**: Click "Analyze Combat" to get AI-powered tactical recommendations

## EFT Format Example

```
[Rifter, PvP Fit]
200mm AutoCannon II, Republic Fleet EMP S
200mm AutoCannon II, Republic Fleet EMP S
[Empty High slot]

1MN Y-S8 Compact Afterburner
Warp Scrambler II
X5 Prototype Engine Enervator

Damage Control II
Small Ancillary Armor Repairer
Adaptive Nano Plating II

Small Anti-EM Pump I
Small Auxiliary Thrusters I
Small Trimark Armor Pump I

Hobgoblin II x5
```

## Combat Mechanics Considered

The AI analysis takes into account EVE Online's complex combat mechanics:

- **Damage Application**: Signature radius, tracking, and velocity factors
- **Range Mechanics**: Optimal range and falloff for weapons
- **Tank Types**: Shield, armor, and hull tank analysis
- **Mobility**: Speed and agility advantages
- **Lock Time**: Scan resolution and targeting considerations

## API Integration

### EVE ESI API
- Character authentication and ship detection
- Fitting information retrieval
- Item and ship type data

### zKillboard API
- Historical combat data for ship types
- Kill statistics and common fittings

### Google Gemini AI
- Combat scenario analysis
- Tactical recommendation generation
- Natural language combat summaries

## Architecture

```
eve-fight-taker/
├── lib/
│   ├── esi-auth.js       # EVE SSO authentication
│   ├── cache-manager.js  # Local disk caching system
│   ├── fit-calculator.js # Ship fitting calculations (adapted from PyFA)
│   └── ai-analyzer.js    # Gemini AI integration
├── public/
│   ├── index.html        # Main web interface
│   ├── style.css         # UI styling
│   └── script.js         # Frontend JavaScript
├── cache/                # Local cache directory
└── server.js             # Express.js server
```

## Fit Calculation Engine

The fit calculation engine is adapted from the [PyFA](https://github.com/pyfa-org/Pyfa) project, which provides accurate EVE Online ship fitting calculations including:

- DPS and volley damage calculations
- EHP (Effective Hit Points) computation
- Speed and agility metrics
- Capacitor stability analysis
- Tracking and application factors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Disclaimer

EVE Online and all related materials are property of CCP Games. This tool is not affiliated with or endorsed by CCP Games.