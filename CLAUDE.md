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

EVE Fight Taker is a Node.js/Express web application that analyzes EVE Online ship combat scenarios using multiple APIs and AI-powered analysis.

### Core Service Architecture

The application follows a service-oriented architecture with four main services initialized in `server.js`:

1. **ESIAuth** (`lib/esi-auth.js`) - Handles EVE Online SSO OAuth flow and ESI API interactions
2. **CacheManager** (`lib/cache-manager.js`) - Manages local disk-based caching with automatic hourly cleanup
3. **FitCalculator** (`lib/fit-calculator.js`) - Parses EFT format fits and calculates ship statistics (adapted from PyFA algorithms)
4. **AIAnalyzer** (`lib/ai-analyzer.js`) - Integrates with Google Gemini AI for combat analysis and tactical recommendations

### API Flow Pattern

The application implements a three-phase analysis workflow:

1. **Authentication Phase**: EVE SSO OAuth with character verification
2. **Data Collection Phase**: 
   - Current ship data via ESI API (`/api/character/ship`)
   - Target ship data via EFT parsing (`/api/parse-eft`)
   - Historical data via zKillboard API (`/api/zkillboard/:shipTypeId`)
3. **Analysis Phase**: Combat comparison via AI analysis (`/api/analyze-combat`)

### Environment Dependencies

Required environment variables in `.env`:
- `ESI_CLIENT_ID` / `ESI_CLIENT_SECRET` - EVE Developer application credentials
- `GOOGLE_API_KEY` - Google AI Studio API key for Gemini
- `SESSION_SECRET` - Express session encryption key

### Caching Strategy

The `CacheManager` implements a file-based cache in the `./cache` directory with automatic expiration:
- ESI API responses cached for 1 hour
- zKillboard data cached for 1 hour  
- Automatic cleanup runs hourly via `setInterval`
- Cache keys are sanitized for filesystem compatibility

### EFT Parsing Logic

The `FitCalculator.parseEFT()` method implements EVE's standard EFT format parsing:
- Header format: `[ShipType, FitName]`
- Section-based parsing (high/med/low/rig/subsystem slots, then drones/cargo/implants)
- Empty lines trigger section transitions
- Supports charged modules, offline modules, and quantity specifications

### Ship Statistics Calculation

Statistics are calculated using EVE's dogma attribute system via ESI API:
- DPS calculation includes damage type breakdown (EM/Thermal/Kinetic/Explosive)
- EHP calculation covers hull/armor/shield layers
- Speed, agility, signature radius, and scan resolution from ship attributes
- Module effects applied through dogma attribute modifications

### AI Analysis Integration

The `AIAnalyzer` constructs detailed prompts for Gemini AI including:
- Complete ship statistics for both vessels
- EVE Online combat mechanics context
- Structured JSON response format for tactical recommendations
- Fallback analysis using mathematical ratios when AI is unavailable

### Frontend State Management

The frontend (`public/script.js`) maintains application state through:
- `currentShipStats` and `targetShipStats` objects
- Authentication status tracking
- Analysis results caching for UI updates
- Loading state management for async operations