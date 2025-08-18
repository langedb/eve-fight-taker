# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Install dependencies
npm install

# Development server with auto-reload
npm run dev

# Production server
npm start

# Environment setup
cp .env.example .env
# Then edit .env with your API credentials
```

## Architecture Overview

EVE Fight Taker is a Node.js/Express web application that analyzes EVE Online ship combat scenarios using multiple APIs and AI-powered analysis. The application has evolved from ESI-dependent to a fully static data-driven system with comprehensive all-V skill bonuses and detailed AI recommendations.

### Core Service Architecture

The application follows a service-oriented architecture with five main services initialized in `server.js`:

1. **ESIAuth** (`lib/esi-auth.js`) - Handles EVE Online SSO OAuth flow and ESI API interactions
2. **CacheManager** (`lib/cache-manager.js`) - Manages local disk-based caching with automatic hourly cleanup
3. **StaticData** (`lib/static-data.js`) - Loads and manages PyFA's EVE static data from JSON files for offline item lookup
4. **FitCalculator** (`lib/fit-calculator.js`) - Parses EFT format fits, calculates ship statistics with all-V skill bonuses (adapted from PyFA algorithms)
5. **AIAnalyzer** (`lib/ai-analyzer.js`) - Integrates with Google Gemini 2.5 Flash for detailed combat analysis and tactical recommendations

### Current Application Flow

The application now implements a dual EFT input system:

1. **Your Ship**: EFT input field for user's fitted ship
2. **Target Ship**: EFT input field for enemy ship analysis
3. **Analysis Phase**: Detailed AI combat analysis with weapon-specific recommendations

### Environment Dependencies

Required environment variables in `.env`:
- `ESI_CLIENT_ID` / `ESI_CLIENT_SECRET` - EVE Developer application credentials (legacy, for future features)
- `GOOGLE_API_KEY` - Google AI Studio API key for Gemini 2.5 Flash
- `SESSION_SECRET` - Express session encryption key

### Static Data Integration

The `StaticData` class (`lib/static-data.js`) provides offline EVE data access:
- **PyFA Data Source**: Uses PyFA's exported static data (types.*.json, groups.0.json, typedogma.*.json, dogmaattributes.0.json)
- **Item Lookup**: Fast name-based item searching without ESI dependency
- **Attribute Access**: Complete dogma attributes for damage, cycle times, and bonuses
- **Data Location**: `./staticdata/` directory with PyFA-compatible JSON files

### EFT Parsing Logic

The `FitCalculator.parseEFT()` method implements EVE's standard EFT format parsing:
- Header format: `[ShipType, FitName]`
- Section-based parsing (high/med/low/rig/subsystem slots, then drones/cargo/implants)
- Empty lines trigger section transitions
- Supports charged modules, offline modules, and quantity specifications
- **Static Data Integration**: All item lookups use local static data instead of ESI

### Ship Statistics Calculation with All-V Skills

Statistics calculation now implements comprehensive skill bonuses:

#### Skill Bonus System (`getSkillBonuses()` method):
- **All Skills at Level 5**: Every skill assumed to be trained to maximum
- **Weapon Skills**: 
  - Gunnery: 2% rate of fire bonus per level (10% at V)
  - Weapon Specialization: 2% damage bonus per level (10% at V)
  - Motion Prediction: 5% tracking bonus per level (25% at V)
  - Sharpshooter: 5% optimal range bonus per level (25% at V)
  - Trajectory Analysis: 5% falloff bonus per level (25% at V)
- **Missile Skills**:
  - Missile Launcher Operation: 2% rate of fire bonus per level
  - Missile Specialization: 2% damage bonus per level
- **Ship Skills**: 
  - Racial Ship Skills: 5% damage bonus per level (25% at V)
  - Automatic race detection and bonus application

#### Statistics Calculated:
- DPS with skill bonuses and damage type breakdown (EM/Thermal/Kinetic/Explosive)
- EHP calculation covering hull/armor/shield layers
- Speed, agility, signature radius, and scan resolution from ship attributes
- Module effects with skill multipliers applied

### Enhanced AI Analysis Integration

The `AIAnalyzer` now uses **Gemini 2.5 Flash** and constructs highly detailed prompts:

#### AI Prompt Includes:
- **Complete Fit Details**: All fitted modules, weapons, ammo, rigs, and drones for both ships
- **Weapon-Specific Data**: Exact weapon types, loaded ammo, and module configurations
- **Ship Statistics**: Calculated stats with all-V skill bonuses applied
- **Combat Context**: EVE Online mechanics, range considerations, and damage application

#### AI Response Format:
```json
{
  "winChance": "<percentage>",
  "timeToKill": "<seconds>",
  "majorAdvantages": ["advantage1", "advantage2"],
  "majorDisadvantages": ["disadvantage1", "disadvantage2"],
  "ammoRecommendations": ["specific ammo type suggestions"],
  "moduleRecommendations": ["how to use fitted modules"],
  "tactics": {
    "range": "<specific km recommendations>",
    "movement": "<movement strategy>",
    "engagement": "<how to initiate>",
    "disengagement": "<escape strategy>"
  },
  "summary": "<detailed assessment>"
}
```

#### Response Processing:
- **Markdown to HTML Conversion**: AI responses in Markdown are converted to HTML with proper formatting
- **Styled Display**: Bold text, code blocks, and emphasis properly styled in the UI
- **Fallback Analysis**: Mathematical backup when AI is unavailable

### Frontend Architecture

The frontend (`public/script.js`) maintains enhanced state management:

#### State Objects:
- `currentShipStats` and `currentShipFit` - Complete fit data for user's ship
- `targetShipStats` and `targetShipFit` - Complete fit data for target ship  
- Authentication status tracking (legacy)
- Analysis results with Markdown rendering

#### UI Components:
- **EFT Input Fields**: Dual text areas for ship fitting input
- **Ship Display**: Real-time stats display with formatted numbers
- **Analysis Results**: 
  - Win chance and time-to-kill metrics
  - Advantages/disadvantages lists
  - **Ammo Recommendations**: Specific ammo type suggestions with formatting
  - **Module Recommendations**: Tactical module usage advice
  - **Tactical Advice**: Range, movement, engagement, and disengagement strategies
  - **Summary**: Comprehensive combat assessment

### Key Files and Their Roles

- `lib/static-data.js` - PyFA static data loader and item lookup
- `lib/fit-calculator.js` - EFT parsing, skill bonus calculation, ship statistics
- `lib/ai-analyzer.js` - Gemini 2.5 Flash integration with detailed prompts
- `public/script.js` - Frontend state management and Markdown rendering
- `public/style.css` - Enhanced UI styling for recommendations
- `staticdata/` - PyFA-compatible EVE static data files

### Recent Major Enhancements

1. **Static Data Migration**: Complete migration from ESI dependency to PyFA static data
2. **All-V Skill Implementation**: Comprehensive skill bonus system matching PyFA calculations
3. **Detailed AI Analysis**: Weapon-specific recommendations with ammo and module advice
4. **Enhanced UI**: New sections for ammo/module recommendations with Markdown rendering
5. **Gemini 2.5 Flash**: Latest AI model for improved tactical analysis

### Development Notes

- The application no longer requires ESI API access for basic functionality
- All item lookups use local static data for reliable offline operation
- Skill bonuses are hardcoded to level 5 for consistent "all-V" pilot assumptions
- AI analysis provides specific tactical advice rather than generic recommendations
- Frontend handles Markdown-formatted AI responses with proper HTML conversion