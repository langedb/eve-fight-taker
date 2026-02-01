#!/usr/bin/env node

/**
 * EVE Fight Taker CLI
 * 
 * Parse EFT fittings and calculate ship statistics from the command line.
 * 
 * Usage:
 *   eve-fight-taker stats <eft-file>              # Parse file and output stats
 *   eve-fight-taker stats --eft "<eft-string>"    # Parse inline EFT string
 *   cat fit.eft | eve-fight-taker stats -         # Parse from stdin
 *   eve-fight-taker compare <fit1.eft> <fit2.eft> # Compare two fits
 *   eve-fight-taker parse <eft-file>              # Parse EFT and output fit structure
 */

// Suppress logging for CLI mode BEFORE requiring anything
process.env.LOG_LEVEL = 'error';

const fs = require('fs');
const path = require('path');
const { FitCalculator } = require('./lib/fit-calculator');

const HELP = `
eve-fight-taker - EVE Online fit simulation CLI

USAGE:
  eve-fight-taker <command> [options]

COMMANDS:
  stats <file|->          Calculate DPS, EHP, speed, etc. from EFT file
  stats --eft "<string>"  Calculate stats from inline EFT string
  parse <file|->          Parse EFT and output fit structure (JSON)
  compare <f1> <f2>       Compare two fits side-by-side
  help                    Show this help

OPTIONS:
  --eft "<string>"        Inline EFT format string
  --pretty                Pretty-print JSON output
  --quiet                 Suppress progress messages

EXAMPLES:
  eve-fight-taker stats my-kikimora.eft
  eve-fight-taker stats --eft "[Kikimora, Kite]\\nLight Entropic Disintegrator II..."
  cat fit.eft | eve-fight-taker stats -
  eve-fight-taker compare attacker.eft defender.eft --pretty

OUTPUT (stats):
  {
    "ship": "Kikimora",
    "name": "Kite",
    "dps": { "total": 487.3, "em": 0, "thermal": 487.3, "kinetic": 0, "explosive": 0 },
    "ehp": { "total": 11240, "shield": 8500, "armor": 1800, "hull": 940 },
    "speed": 3200,
    "signatureRadius": 52,
    ...
  }
`;

async function readEFT(source) {
  if (source === '-') {
    // Read from stdin
    return new Promise((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  } else if (source.startsWith('[')) {
    // Inline EFT string (starts with ship header)
    return source;
  } else {
    // File path
    const filePath = path.resolve(source);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return fs.readFileSync(filePath, 'utf8');
  }
}

async function calculateStats(eftText) {
  const calculator = new FitCalculator();
  
  // Parse the EFT
  const fit = await calculator.parseEFT(eftText);
  
  // Calculate full stats
  const stats = await calculator.calculateFitStats(fit);
  
  return {
    ship: fit.shipType || fit.shipName,
    name: fit.fitName,
    dps: {
      total: round(stats.dps.total),
      em: round(stats.dps.em),
      thermal: round(stats.dps.thermal),
      kinetic: round(stats.dps.kinetic),
      explosive: round(stats.dps.explosive)
    },
    volley: {
      total: round(stats.volley.total),
      em: round(stats.volley.em),
      thermal: round(stats.volley.thermal),
      kinetic: round(stats.volley.kinetic),
      explosive: round(stats.volley.explosive)
    },
    ehp: {
      total: round(stats.ehp.total),
      shield: round(stats.ehp.shield),
      armor: round(stats.ehp.armor),
      hull: round(stats.ehp.hull)
    },
    tank: stats.tank ? {
      total: round(stats.tank.total),
      shield: round(stats.tank.shield),
      armor: round(stats.tank.armor),
      hull: round(stats.tank.hull)
    } : undefined,
    speed: round(stats.speed),
    agility: round(stats.agility, 3),
    signatureRadius: round(stats.signatureRadius),
    scanResolution: round(stats.scanResolution),
    lockRange: round(stats.lockRange / 1000), // Convert to km
    capacitor: stats.capacitor ? {
      amount: round(stats.capacitor.amount),
      recharge: round(stats.capacitor.recharge),
      stable: stats.capacitor.stable
    } : undefined,
    weapons: stats.weapons?.map(w => ({
      name: w.name,
      dps: round(w.dps),
      type: w.type,
      optimal: w.optimal ? round(w.optimal / 1000) : undefined, // km
      falloff: w.falloff ? round(w.falloff / 1000) : undefined, // km
      tracking: w.tracking ? round(w.tracking, 4) : undefined
    }))
  };
}

async function parseFit(eftText) {
  const calculator = new FitCalculator();
  return await calculator.parseEFT(eftText);
}

async function compareFits(eft1, eft2) {
  const [stats1, stats2] = await Promise.all([
    calculateStats(eft1),
    calculateStats(eft2)
  ]);
  
  // Calculate time-to-kill estimates (simplified)
  const ttk1on2 = stats2.ehp.total / stats1.dps.total; // How long fit1 takes to kill fit2
  const ttk2on1 = stats1.ehp.total / stats2.dps.total; // How long fit2 takes to kill fit1
  
  const winner = ttk1on2 < ttk2on1 ? stats1.ship : stats2.ship;
  const margin = Math.abs(ttk1on2 - ttk2on1);
  
  return {
    fit1: stats1,
    fit2: stats2,
    analysis: {
      ttk_fit1_kills_fit2: round(ttk1on2, 1),
      ttk_fit2_kills_fit1: round(ttk2on1, 1),
      winner: winner,
      margin_seconds: round(margin, 1),
      verdict: margin < 5 ? 'CLOSE' : (ttk1on2 < ttk2on1 ? 'FIT1_WINS' : 'FIT2_WINS')
    }
  };
}

function round(value, decimals = 1) {
  if (value === undefined || value === null || isNaN(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

function output(data, pretty) {
  if (pretty) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data));
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    console.log(HELP);
    process.exit(0);
  }
  
  const command = args[0];
  const pretty = args.includes('--pretty');
  const quiet = args.includes('--quiet');
  
  // Filter out flag arguments
  const positionalArgs = args.slice(1).filter(a => !a.startsWith('--'));
  
  // Check for inline --eft argument
  const eftIndex = args.indexOf('--eft');
  const inlineEFT = eftIndex !== -1 ? args[eftIndex + 1] : null;
  
  try {
    switch (command) {
      case 'stats': {
        const source = inlineEFT || positionalArgs[0];
        if (!source) {
          console.error('Error: No EFT source provided. Use a file path, "-" for stdin, or --eft "<string>"');
          process.exit(1);
        }
        
        if (!quiet) console.error('Loading static data...');
        const eftText = await readEFT(source);
        
        if (!quiet) console.error('Calculating stats...');
        const stats = await calculateStats(eftText);
        
        output(stats, pretty);
        break;
      }
      
      case 'parse': {
        const source = positionalArgs[0];
        if (!source) {
          console.error('Error: No EFT source provided.');
          process.exit(1);
        }
        
        const eftText = await readEFT(source);
        const fit = await parseFit(eftText);
        
        output(fit, pretty);
        break;
      }
      
      case 'compare': {
        if (positionalArgs.length < 2) {
          console.error('Error: Compare requires two EFT files.');
          process.exit(1);
        }
        
        if (!quiet) console.error('Loading static data...');
        const [eft1, eft2] = await Promise.all([
          readEFT(positionalArgs[0]),
          readEFT(positionalArgs[1])
        ]);
        
        if (!quiet) console.error('Comparing fits...');
        const comparison = await compareFits(eft1, eft2);
        
        output(comparison, pretty);
        break;
      }
      
      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
