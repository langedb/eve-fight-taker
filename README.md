# EVE Fight Taker

A comprehensive EVE Online fleet management and ship combat analysis tool that uses static data, advanced fit simulation, and Google Gemini AI to provide precise tactical combat recommendations with professional-grade fleet operations.

## Features

- **Fleet Management System**: Create, manage, and analyze fleet compositions with role assignments and battle scenarios
- **Dynamic Fleet Statistics**: Real-time DPS and EHP calculation as ships are added, removed, or modified
- **Enhanced Fitting Cards**: Professional zKillboard-style UI with module icons, ship stats, and detailed visualization
- **Dual Ship Analysis**: Compare your ship against target ships with detailed combat predictions
- **Enhanced EFT Parsing**: Full EVE Fitting Tool format support with intelligent subsystem validation and smart cargo handling
- **Static Data Engine**: Uses PyFA's static data for 100% offline operation with complete EVE item database
- **All-V Skill Calculations**: Comprehensive skill bonus system assuming level V in all skills
- **Advanced Weapon Systems**: Full support for fighters, breacher pods, HAW weapons, and doomsday devices
- **T3 Strategic Cruiser Support**: Complete hull and subsystem bonus calculations
- **PyFA-Compatible Calculations**: DPS, EHP, and ship statistics matching PyFA's precision
- **Comprehensive Rig System**: Support for all rig types including velocity, range, and tank bonuses
- **AI-Powered Tactical Analysis**: Detailed combat recommendations using Google Gemini 2.5 Flash
- **Range Analysis**: Weapon range calculations with kiting vs brawling strategy recommendations
- **EVE SSO Authentication**: Secure character-based authentication with session management

## Prerequisites

- **Node.js**: Version 18.18.0 or higher
- **Google AI API Key**: Get an API key from [Google AI Studio](https://aistudio.google.com/) for Gemini AI analysis
- **EVE ESI Application**: Required for EVE SSO authentication and ship loading features
  - Create an application at [EVE Developers](https://developers.eveonline.com/)
  - Set callback URL to: `http://localhost:8080/callback`
  - Required scopes:
    - `esi-location.read_location.v1`
    - `esi-location.read_ship_type.v1`
    - `esi-fittings.read_fittings.v1`

## Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone https://github.com/your-username/eve-fight-taker.git
   cd eve-fight-taker
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```
   # Required for AI analysis
   GOOGLE_API_KEY=your_google_api_key_here
   
   # Required for EVE SSO and ship loading
   ESI_CLIENT_ID=your_esi_client_id_here
   ESI_CLIENT_SECRET=your_esi_client_secret_here
   
   # Required for session management
   SESSION_SECRET=your_random_session_secret_here
   
   # Optional
   PORT=8080
   LOG_LEVEL=info
   ```

3. **Start the Server**
   ```bash
   # Production server
   npm start
   
   # Development server with auto-reload
   npm run dev
   
   # Run tests
   npm test
   
   # Run linting
   npm run lint
   ```

4. **Access the Application**
   Open your browser to: `http://localhost:8080`

## Usage

1. **Your Ship**: Paste your ship's EFT format fitting in the "Your Ship" text area
2. **Target Ship**: Paste the enemy ship's EFT format fitting in the "Target Ship" text area  
3. **Parse Fits**: Click "Parse Fit" buttons to load and calculate ship statistics
4. **Analyze Combat**: Click "Analyze Combat" to get detailed AI tactical recommendations including:
   - Win chance percentage and estimated time to kill
   - Major tactical advantages and disadvantages
   - Specific ammo and module usage recommendations
   - Range strategy (kiting vs brawling) with exact distance recommendations
   - Engagement and disengagement tactics

## EFT Format Example

```
[Caracal Navy Issue, Missile Kiting]
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II

Large Shield Extender II
50MN Y-T8 Compact Microwarpdrive
Missile Guidance Computer II, Missile Range Script
Multispectrum Shield Hardener II
EM Shield Hardener II

Heavy Missile Launcher II, Scourge Fury Heavy Missile
Heavy Missile Launcher II, Scourge Fury Heavy Missile
Heavy Missile Launcher II, Scourge Fury Heavy Missile
Heavy Missile Launcher II, Scourge Fury Heavy Missile
Heavy Missile Launcher II, Scourge Fury Heavy Missile

Medium Hydraulic Bay Thrusters II
Medium Rocket Fuel Cache Partition I
Medium EM Shield Reinforcer II

Hobgoblin II x5

Scourge Fury Heavy Missile x1000
Missile Range Script x1
```

## Combat Mechanics Calculated

The system performs comprehensive combat analysis using verified EVE Online mechanics:

- **All-V Skill Bonuses**: Complete skill system with level V in all skills including specialization skills
- **Weapon Specialization**: T2 weapon bonuses (Heavy Missile Specialization, Small Pulse Laser Specialization, etc.)
- **Dynamic Hull Bonuses**: Automatic ship bonus processing using EVE's dogmaEffects data for all ship types
- **T3 Strategic Cruiser System**: Hull bonuses and subsystem effects for Loki, Tengu, Proteus, and Legion
- **Intelligent Subsystem Classification**: Category-based validation ensures only T3 cruiser subsystems are properly classified
- **Advanced Weapon Systems**: Fighter squadrons, breacher pods, HAW weapons, doomsday devices
- **Rig Bonuses**: Complete rig system including velocity, range, damage, and tank bonuses
- **Stacking Penalties**: PyFA-compatible stacking penalty calculations
- **Range Analysis**: Weapon optimal/falloff ranges, missile flight distances, EWAR module ranges
- **Damage Application**: Signature radius, tracking speed, and velocity factors
- **Tank Calculations**: Shield/armor/hull EHP with resistance bonuses
- **Drone Control Ranges**: Calculated drone control distances with skill and module bonuses

## API Integration

### Static Data System
- **PyFA Integration**: Uses PyFA's exported EVE static data for 100% offline operation
- **Complete Item Database**: 50,243+ items with full attribute data
- **Dogma Attributes**: Weapon damage, cycle times, bonuses, and ship statistics
- **DogmaEffects Processing**: 50,243+ effects for automatic ship hull bonus calculations
- **No ESI Dependency**: All calculations work offline using static data

### Google Gemini AI
- **Gemini 2.5 Flash**: Provides tactical analysis
- **Detailed Prompts**: Weapon-specific, range-aware combat analysis
- **Tactical Recommendations**: Ammo selection, module usage, engagement strategies
- **Natural Language**: Human-readable combat summaries and advice

### EVE ESI Integration
- **EVE SSO Authentication**: Secure login with your EVE Online character
- **Live Ship Loading**: Automatically load your current ship and fitting
- **Fitting Management**: Access and analyze your saved fittings
- **Character Data**: Location and ship type detection

## Architecture

```
eve-fight-taker/
├── lib/
│   ├── static-data.js           # PyFA static data loader
│   ├── fit-calculator.js        # EFT parsing and ship statistics
│   ├── fit-simulator.js         # PyFA-compatible fit simulation
│   ├── modified-attribute-store.js # Advanced attribute modification system
│   ├── ai-analyzer.js           # Gemini 2.5 Flash integration
│   ├── cache-manager.js         # Local disk caching system
│   ├── esi-auth.js             # EVE SSO authentication (legacy)
│   └── zkillboard-parser.js     # zKillboard API integration
├── public/
│   ├── index.html               # Dual-ship analysis interface
│   ├── style.css                # Enhanced UI styling
│   └── script.js                # Frontend state management
├── staticdata/                  # PyFA-compatible EVE data
│   ├── types.*.json             # Item definitions
│   ├── dogmaattributes.0.json   # Attribute definitions
│   ├── dogmaeffects.0.json      # Effect definitions for ship bonuses
│   ├── typedogma.*.json         # Item-attribute mappings
│   └── groups.0.json            # Item group classifications
├── test/                        # Comprehensive test suite (244 tests)
├── cache/                       # Local cache directory
└── server.js                    # Express.js server
```

## Fit Calculation Engine

The fit calculation engine is fully compatible with [PyFA](https://github.com/pyfa-org/Pyfa) and provides industry-standard EVE Online ship fitting calculations:

### Core Systems
- **ModifiedAttributeStore**: Advanced attribute modification with PyFA-compatible stacking penalties
- **FitSimulator**: Complete skill bonus application system with all-V assumptions  
- **Dynamic Hull Bonus Engine**: Generic dogmaEffects processing for all ship types automatically
- **Weapon Systems**: Support for turrets, missiles, drones, fighters, and exotic weapons
- **T3 Strategic Cruiser Engine**: Full hull and subsystem bonus calculations
- **Rig Processing**: Complete rig bonus system with velocity, range, and tank bonuses

## Performance Metrics

- **Static Data**: 50,243 EVE items + 50,243+ dogmaEffects loaded with fast lookup
- **Dynamic Hull Bonuses**: Generic processing system works with any ship type automatically
- **Calculation Speed**: Real-time ship statistics with complex bonus stacking
- **Memory Efficient**: Optimized attribute storage and caching system

## Logging System

The application uses Winston for professional-grade logging:

### **Log Levels**
- **ERROR**: Critical issues, API failures, system errors
- **WARN**: Non-fatal issues, missing data, deprecation warnings  
- **INFO**: Application startup, major operations, user actions (default)
- **DEBUG**: Detailed application flow, fit processing steps
- **TRACE**: Extremely verbose debugging information

### **Log Files** (`logs/` directory)
- `error.log` - Error level logs only (10MB rotation, 5 files)
- `combined.log` - All log levels (10MB rotation, 5 files)  
- `debug.log` - Debug and trace logs (10MB rotation, 3 files)

### **Configuration**
Set `LOG_LEVEL` in `.env` to control verbosity:
```bash
LOG_LEVEL=debug  # Show debug information
LOG_LEVEL=info   # Standard logging (default)
LOG_LEVEL=error  # Only critical errors
```

In development mode, logs also appear in the console with color coding.

## Development

```bash
# Install dependencies
npm install

# Development server with auto-reload
npm run dev

# Run comprehensive test suite  
npm test

# Run ESLint with auto-fix
npm run lint

# Update all dependencies
npm run update-deps
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with comprehensive tests
4. Ensure all tests pass (`npm test`)
5. Run linting (`npm run lint`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- **PyFA Team**: For the exceptional EVE fitting calculation algorithms and static data export
- **CCP Games**: For EVE Online and the comprehensive game mechanics
- **Google**: For Gemini AI that powers the tactical analysis system

## Disclaimer

EVE Online and all related materials are property of CCP Games. This tool is not affiliated with or endorsed by CCP Games.
