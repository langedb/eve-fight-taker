# CLAUDE.md

EVE Fight Taker guidance for Claude Code (claude.ai/code).

## Commands

```bash
npm install      # Install dependencies
npm run dev      # Development server
npm start        # Production server
npm test         # Test suite
npm run lint     # ESLint with auto-fix
cp .env.example .env  # Setup environment
```

## Overview

Node.js/Express application analyzing EVE Online ship combat using static PyFA data, all-V skill bonuses, and AI recommendations.

## Services

- **ESIAuth** - EVE Online SSO OAuth
- **CacheManager** - Disk caching with hourly cleanup
- **StaticData** - PyFA static data loader
- **FitCalculator** - EFT parsing with all-V skill bonuses
- **AIAnalyzer** - Gemini 2.5 Flash combat analysis (ship vs ship + fleet vs fleet)
- **FleetManager** - Fleet composition, scenarios, database management
- **FleetAnalyzer** - Fleet vs fleet battle analysis with AI integration
- **Logger** - Winston logging with rotation

## Environment

```
GOOGLE_API_KEY=<API key for Gemini 2.5 Flash>
ESI_CLIENT_ID/SECRET=<EVE developer credentials>
SESSION_SECRET=<session encryption>
LOG_LEVEL=<error|warn|info|debug>
```

## Core Components

### Static Data (`lib/static-data.js`)
- PyFA JSON files in `./staticdata/`: types, groups, typedogma, dogmaattributes, dogmaeffects
- Fast item lookup without ESI dependency
- Complete dogma attributes and effects for calculations
- 50,243+ dogmaEffects for dynamic ship bonus processing

### EFT Parsing (`lib/fit-calculator.js`)
- **Format**: `[ShipType, FitName]` header, section-based parsing
- **Sections**: High/Med/Low/Rig/Subsystem → Drones → Cargo
- **ESI Conversion**: Handles string/numeric slot flags, proper ordering

### Ship Statistics (`lib/fit-simulator.js`)

**All-V Skills Applied:**
- **Missile**: Launcher Operation (10% ROF), Specializations (10% ROF T2 only), Warhead Upgrades (10% damage), missile type skills (10% damage)
- **Gunnery**: Gunnery (10% ROF), Specializations (10% damage T2 only), weapon upgrade skills
- **Drone**: Drones (25% damage), Combat Drone Operation (25% damage)
- **T3 Cruiser**: Strategic Cruiser Operation (25% weapon damage), subsystem bonuses
- **Modules**: Ballistic Control Systems (10% per module, stacking penalties)
- **Ship Hull Bonuses**: Dynamic processing from dogmaEffects data for all ship types

**Calculations:** DPS, volley damage, EHP, speed, agility, signature radius, weapon performance

### Advanced Weapon Systems

**Fighters** (category 87): Light 50-60 DPS, Heavy 75-90 DPS per fighter, all-V fighter skills  
**Breacher Pods** (group 4807): Resistance-ignoring damage, flat HP or % HP (whichever lower)  
**HAW Weapons**: Capital anti-subcapital, 2000-3000+ DPS vs small targets  
**Doomsday**: Capital-only targeting, subcapital restriction enforced  
**T3 Cruisers**: Hull bonuses (Loki: missile+projectile, Tengu: missile, Proteus: hybrid, Legion: energy), subsystem bonuses

### AI Analysis (`lib/ai-analyzer.js`)

**Gemini 2.5 Flash** with detailed prompts including:
- **Ship vs Ship**: Complete fit details, weapon/ammo data, damage types, all-V skill bonus stats, range analysis, drone control ranges, 5-drone active limit enforcement, tactical deployment strategies
- **Fleet vs Fleet**: Fleet composition analysis, role breakdown, range analysis, mobility assessment, tactical recommendations

**Response:** JSON with winChance, timeToKill, advantages/disadvantages, ammo/module recommendations, range tactics, summary

### Character Death Search

**API**: `/api/character/:id/deaths`, `/api/killmail/:id/:hash`  
**Filtering**: Ship category 6 only, excludes capsules (group 29)  
**Workflow**: Character name → zKillboard query → ship deaths dropdown → fit loading

### Range Analysis

**Weapon Ranges**: Turret (optimal+falloff), Missile (flight time × velocity), EWAR (optimal+falloff)  
**Range Boosting**: Missile Guidance Computer, Tracking Computer, range rigs, scripts  
**Tactics**: Kiting (range advantage), Brawling (close-range superiority), Mixed (long weapons + short EWAR)  
**EWAR Limits**: Neuts 6-10km, Scrams 9-15km, Webs 10-20km, ECM 15-24km

## Frontend

**State** (`public/script.js`): Ship stats/fits, analysis results with Markdown rendering  
**UI**: Dual EFT input fields, real-time stats, analysis display (win chance, advantages/disadvantages, ammo/module recommendations, tactical advice)

## Key Files

- `lib/static-data.js` - PyFA data loader
- `lib/fit-calculator.js` - EFT parsing, all-V skills
- `lib/fit-simulator.js` - PyFA-compatible bonuses, T3 support
- `lib/modified-attribute-store.js` - Stacking penalties, attribute tracking
- `lib/ai-analyzer.js` - Gemini 2.5 Flash integration
- `public/script.js` - Frontend state, Markdown rendering
- `staticdata/` - PyFA JSON files
- `test/` - Comprehensive test suite (244+ tests)

## Recent Major Enhancements

- **Dynamic Hull Bonus System**: Complete replacement of hardcoded ship bonuses with generic dogmaEffects processing
- **Static Data Migration**: ESI to PyFA static data with 50,243+ dogmaEffects
- **All-V Skill System**: Comprehensive verified bonuses (~40 → 284 DPS improvement)
- **PyFA Compatibility**: Attribute calculation matching PyFA's algorithms  
- **Advanced Weapons**: Fighters, breacher pods, HAW, doomsday restrictions, T3 cruisers
- **Range Analysis**: Weapon ranges, EWAR limits, kiting/brawling tactics
- **AI Enhancement**: Gemini 2.5 Flash with tactical prompts, 5-drone limit enforcement
- **Bug Fixes**: EHP calculations, stacking penalties, skill bonus over-application
- **Test Coverage**: 244+ comprehensive tests, weapon systems validation
- **Character Search**: Death analysis with ship-only filtering
- **Ammo/Module Systems**: Auto-selection, compatibility matrices, cargo analysis

## Development Notes

- **All-V Skills**: All skills at level 5 for maximum bonuses
- **PyFA Compatible**: Matches PyFA's calculation methods and attribute order
- **Static Data Only**: No ESI dependency for DPS calculations  
- **Verified Mechanics**: All bonuses based on actual EVE mechanics
- **Unique Modules**: Each module gets unique key to prevent bonus cross-contamination
- **Single Application**: Bonuses calculated once per fit, applied once per weapon
- **Dynamic Hull Bonuses**: Generic system processes any ship type automatically
- **Comprehensive Testing**: 244+ tests covering all systems and edge cases
- **Range Enforcement**: AI prevented from impossible EWAR recommendations
- **5-Drone Limit**: AI enforces EVE's fundamental drone limitations

## Performance

- **DPS Accuracy**: 609% improvement (40 → 284 DPS) with skill bonus fixes
- **Dynamic Hull System**: Processes 50,243+ dogmaEffects for all ship bonuses automatically
- **Advanced Weapons**: Fighter DPS (Nyx: 0 → 2,392.5 DPS), T3 support  
- **Test Coverage**: 244+ tests with 100% pass rate
- **Static Data**: 50,243 types with fast lookup and dogmaEffects processing
- **Range Analysis**: Complete weapon/EWAR range extraction
- **AI Enhancement**: Prevents impossible tactics, accurate tactical recommendations
- **Bug Fixes**: EHP calculations, stacking penalties, drone deployment limits

## Dynamic Hull Bonus System

**DogmaEffects Processing**: Loads 50,243+ effects from dogmaeffects.0.json  
**Modifier Functions**: LocationGroupModifier, OwnerRequiredSkillModifier, LocationRequiredSkillModifier, ItemModifier, LocationModifier  
**Attribute-Based Filtering**: Automatic weapon type detection (missile, projectile, hybrid, energy, drone)  
**Dynamic Storage**: Bonuses calculated once per fit, applied with proper stacking  
**Universal Compatibility**: Works with any ship type automatically through EVE's dogma data  
**Performance**: Replaces hardcoded logic with future-proof generic system

## T3 Strategic Cruiser Implementation

**Detection**: `isT3StrategicCruiser()` checks for loki/tengu/proteus/legion
**Hull Bonuses**: Now processed through dynamic dogmaEffects system
**Weapon Classification**: Group IDs for projectile/hybrid/energy/missile weapons
**Subsystems**: Launcher Efficiency Configuration, Covert Reconfiguration bonuses
**Testing**: Unit tests, integration tests, stacking penalty verification

## Fleet Management System (v2.4.0)

**Enhanced Fitting Cards**: zKillboard-style professional UI with module icons, stats display, and ship renders
**Fleet Operations**: Create, manage, and analyze fleet compositions with role assignments
**Battle Scenarios**: Save and compare fleet vs fleet matchups with cached analysis
**Authentication**: EVE SSO integration for secure character-based fleet management
**Database**: SQLite-based storage for fittings, fleets, and scenario data with automatic cleanup

## EFT Parsing Engine

**Format Support**: Official EVE Fitting Tool format with header `[ShipType, FitName]`
**Slot Progression**: Low → Med → High → Rig → Subsystem → Drones → Cargo (per EFT spec)
**hasModulesInCurrentSlot Fix**: Prevents premature slot advancement on empty lines
**Module Enrichment**: Automatic icon_id and type_id lookup from static data
**Error Handling**: Robust parsing with detailed error messages and fallbacks
**Testing**: 6 comprehensive unit tests covering edge cases and slot placement

## Enhanced User Interface

**Professional Styling**: EVE Online-themed dark UI with neon accents and smooth animations
**Responsive Design**: CSS Grid and Flexbox layouts with mobile compatibility
**Module Visualization**: Icon-based fitting display with tooltip information
**Real-time Updates**: Async loading with loading spinners and error states
**Image Fallbacks**: Placeholder system for failed module icon loads

## Recent v2.4.0 Enhancements

- **EFT Parsing Fix**: Resolved critical slot misalignment bug affecting Cormorant and other ships
- **Enhanced Fitting Cards**: Complete redesign with professional zKillboard-style appearance
- **Fleet Management**: Full CRUD operations for fleets, fittings, and battle scenarios
- **Module Icons**: Dynamic icon loading with EVE image API integration
- **CSS Modernization**: Fixed syntax issues, removed debug borders, improved browser compatibility
- **Unit Testing**: Added 6 comprehensive tests for EFT parsing edge cases
- **Code Quality**: ESLint and Stylelint compliance with auto-fixes applied

## API Documentation
- zKillboard: https://github.com/zKillboard/zKillboard/wiki
- ESI: https://github.com/esi/esi-docs
- EFT Format: https://developers.eveonline.com/docs/guides/fitting/