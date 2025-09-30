const { AIAnalyzer } = require('./ai-analyzer');
const { FitCalculator } = require('./fit-calculator');
const log = require('./logger');

class FleetAnalyzer {
  constructor(googleApiKey) {
    this.aiAnalyzer = new AIAnalyzer(googleApiKey);
    this.fitCalculator = new FitCalculator();
  }

  async initialize() {
    await this.fitCalculator.ensureStaticData();
  }

  async analyzeFleetVsFleet(friendlyFleet, enemyFleet, scenario = {}) {
    try {
      log.info(`Analyzing fleet battle: ${friendlyFleet.name} vs ${enemyFleet.name}`);

      // Calculate stats for both fleets
      const friendlyStats = await this.calculateFleetStats(friendlyFleet.composition);
      const enemyStats = await this.calculateFleetStats(enemyFleet.composition);

      // Generate detailed fleet analysis
      const analysis = await this.generateFleetAnalysis(friendlyStats, enemyStats, scenario);

      return {
        friendlyFleet: {
          name: friendlyFleet.name,
          stats: friendlyStats,
          composition: friendlyFleet.composition
        },
        enemyFleet: {
          name: enemyFleet.name,
          stats: enemyStats,
          composition: enemyFleet.composition
        },
        analysis,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      log.error('Fleet analysis failed:', error);
      throw new Error(`Fleet analysis failed: ${error.message}`);
    }
  }

  async calculateFleetStats(fleetComposition) {
    const shipStats = [];
    const totalDps = { total: 0, em: 0, explosive: 0, kinetic: 0, thermal: 0 };
    const totalEhp = { total: 0, shield: 0, armor: 0, hull: 0 };
    const totalAlpha = { total: 0, em: 0, explosive: 0, kinetic: 0, thermal: 0 };

    // Analyze each ship type in the fleet
    for (const ship of fleetComposition) {
      try {
        // Parse the EFT fitting
        const parsedFit = await this.fitCalculator.parseEFT(ship.eft_format);
        const stats = await this.fitCalculator.calculateFitStats(parsedFit);

        // Scale by quantity
        const scaledStats = {
          ...stats,
          quantity: ship.quantity,
          role: ship.role,
          fittingName: ship.fitting_name,
          shipName: ship.ship_name
        };

        // Aggregate fleet totals
        if (stats.dps) {
          totalDps.total += (stats.dps.total || 0) * ship.quantity;
          totalDps.em += (stats.dps.em || 0) * ship.quantity;
          totalDps.explosive += (stats.dps.explosive || 0) * ship.quantity;
          totalDps.kinetic += (stats.dps.kinetic || 0) * ship.quantity;
          totalDps.thermal += (stats.dps.thermal || 0) * ship.quantity;
        }

        if (stats.ehp) {
          totalEhp.total += (stats.ehp.total || 0) * ship.quantity;
          totalEhp.shield += (stats.ehp.shield || 0) * ship.quantity;
          totalEhp.armor += (stats.ehp.armor || 0) * ship.quantity;
          totalEhp.hull += (stats.ehp.hull || 0) * ship.quantity;
        }

        if (stats.alpha) {
          totalAlpha.total += (stats.alpha.total || 0) * ship.quantity;
          totalAlpha.em += (stats.alpha.em || 0) * ship.quantity;
          totalAlpha.explosive += (stats.alpha.explosive || 0) * ship.quantity;
          totalAlpha.kinetic += (stats.alpha.kinetic || 0) * ship.quantity;
          totalAlpha.thermal += (stats.alpha.thermal || 0) * ship.quantity;
        }

        shipStats.push(scaledStats);
      } catch (error) {
        log.warn(`Failed to analyze ship ${ship.fitting_name}:`, error);
        shipStats.push({
          quantity: ship.quantity,
          role: ship.role,
          fittingName: ship.fitting_name,
          shipName: ship.ship_name,
          error: error.message
        });
      }
    }

    // Calculate fleet-wide metrics
    const totalShips = fleetComposition.reduce((sum, ship) => sum + ship.quantity, 0);
    const shipTypes = fleetComposition.length;

    // Analyze fleet composition by role and class
    const roleAnalysis = this.analyzeFleetRoles(shipStats);
    const rangeAnalysis = this.analyzeFleetRanges(shipStats);
    const mobilityAnalysis = this.analyzeFleetMobility(shipStats);

    return {
      totalShips,
      shipTypes,
      totalDps,
      totalEhp,
      totalAlpha,
      shipStats,
      roleAnalysis,
      rangeAnalysis,
      mobilityAnalysis,
      averageStats: {
        dpsPerShip: totalShips > 0 ? totalDps.total / totalShips : 0,
        ehpPerShip: totalShips > 0 ? totalEhp.total / totalShips : 0,
        alphaPerShip: totalShips > 0 ? totalAlpha.total / totalShips : 0
      }
    };
  }

  analyzeFleetRoles(shipStats) {
    const roles = {};
    let totalDps = 0;
    let totalEhp = 0;

    for (const ship of shipStats) {
      if (!roles[ship.role]) {
        roles[ship.role] = {
          count: 0,
          dps: 0,
          ehp: 0,
          ships: []
        };
      }

      roles[ship.role].count += ship.quantity;
      roles[ship.role].dps += (ship.dps?.total || 0) * ship.quantity;
      roles[ship.role].ehp += (ship.ehp?.total || 0) * ship.quantity;
      roles[ship.role].ships.push(ship);

      totalDps += (ship.dps?.total || 0) * ship.quantity;
      totalEhp += (ship.ehp?.total || 0) * ship.quantity;
    }

    // Calculate role percentages
    for (const role in roles) {
      roles[role].dpsPercentage = totalDps > 0 ? (roles[role].dps / totalDps) * 100 : 0;
      roles[role].ehpPercentage = totalEhp > 0 ? (roles[role].ehp / totalEhp) * 100 : 0;
    }

    return roles;
  }

  analyzeFleetRanges(shipStats) {
    const ranges = {
      short: { count: 0, dps: 0 },  // < 10km
      medium: { count: 0, dps: 0 }, // 10-30km
      long: { count: 0, dps: 0 }    // > 30km
    };

    for (const ship of shipStats) {
      if (!ship.weapons || ship.weapons.length === 0) continue;

      const maxRange = Math.max(...ship.weapons.map(w => w.optimalRange + w.falloffRange || 0));
      const shipDps = (ship.dps?.total || 0) * ship.quantity;

      if (maxRange < 10000) {
        ranges.short.count += ship.quantity;
        ranges.short.dps += shipDps;
      } else if (maxRange < 30000) {
        ranges.medium.count += ship.quantity;
        ranges.medium.dps += shipDps;
      } else {
        ranges.long.count += ship.quantity;
        ranges.long.dps += shipDps;
      }
    }

    return ranges;
  }

  analyzeFleetMobility(shipStats) {
    let totalSpeed = 0;
    let totalAgility = 0;
    let shipCount = 0;

    const speedCategories = {
      slow: { count: 0, threshold: 200 },    // < 200 m/s
      medium: { count: 0, threshold: 500 },  // 200-500 m/s
      fast: { count: 0 }                     // > 500 m/s
    };

    for (const ship of shipStats) {
      if (ship.speed && ship.agility) {
        totalSpeed += ship.speed * ship.quantity;
        totalAgility += ship.agility * ship.quantity;
        shipCount += ship.quantity;

        if (ship.speed < 200) {
          speedCategories.slow.count += ship.quantity;
        } else if (ship.speed < 500) {
          speedCategories.medium.count += ship.quantity;
        } else {
          speedCategories.fast.count += ship.quantity;
        }
      }
    }

    return {
      averageSpeed: shipCount > 0 ? totalSpeed / shipCount : 0,
      averageAgility: shipCount > 0 ? totalAgility / shipCount : 0,
      speedCategories
    };
  }

  async generateFleetAnalysis(friendlyStats, enemyStats, scenario) {
    const prompt = this.buildFleetAnalysisPrompt(friendlyStats, enemyStats, scenario);

    try {
      const analysis = await this.aiAnalyzer.analyzeWithPrompt(prompt);

      // New robust JSON parsing
      const jsonString = analysis.match(/\{[\s\S]*\}/);
      if (jsonString) {
        return JSON.parse(jsonString[0]);
      } else {
        throw new Error('No JSON object found in AI response');
      }
    } catch (error) {
      log.error('AI fleet analysis failed:', {
        error: error.message,
        prompt: prompt.substring(0, 500) + '...',
        rawResponse: error.rawResponse || 'N/A'
      });

      // Fallback to basic analysis
      return this.generateBasicAnalysis(friendlyStats, enemyStats);
    }
  }

  buildFleetAnalysisPrompt(friendlyStats, enemyStats, scenario) {
    return `Analyze this EVE Online fleet vs fleet battle scenario and provide detailed tactical assessment.

CRITICAL COMBAT PRINCIPLES:
- Fleet combat is about attrition. The fleet that can sustain its ships and remove enemy ships from the field will win.
- Target priority is paramount. Focus fire on high-value targets to quickly reduce the enemy's effectiveness.
- Logistics (healing) is the backbone of a fleet. Protecting your logistics and breaking the enemy's is a primary objective.
- EWAR (Electronic Warfare) can cripple a fleet. Understanding and countering EWAR is critical.

COMMON FLEET MATCHUPS:
- BRAWL vs. KITE: Brawling fleets want to close the distance and fight at close range. Kiting fleets want to maintain distance and fight at long range. The winner is often determined by which fleet can control the engagement range.
- ALPHA vs. TANK: Alpha fleets are designed to destroy a target in a single volley. Tank fleets are designed to withstand a large amount of damage. The winner is often determined by whether the alpha fleet can break the tank of the enemy ships.

LOGISTICS AND SUPPORT:
- Logistics ships are the healers of the fleet. They are high-priority targets and must be protected.
- Support ships provide bonuses to the fleet, such as increased damage, range, or tank. They are also high-priority targets.

EWAR (ELECTRONIC WARFARE):
- ECM (Electronic Countermeasures) can break a target's lock, preventing them from attacking or being healed.
- Sensor Dampeners reduce a target's lock range and scan resolution, making it difficult for them to engage at long range.
- Tracking Disruptors reduce a turret's tracking and optimal range, making it difficult for them to hit fast-moving or distant targets.
- Target Painters increase a target's signature radius, making them easier to hit.

FRIENDLY FLEET COMPOSITION:
- Total Ships: ${friendlyStats.totalShips}
- Total DPS: ${Math.round(friendlyStats.totalDps.total)} (EM: ${Math.round(friendlyStats.totalDps.em)}, Exp: ${Math.round(friendlyStats.totalDps.explosive)}, Kin: ${Math.round(friendlyStats.totalDps.kinetic)}, Therm: ${Math.round(friendlyStats.totalDps.thermal)})
- Total EHP: ${Math.round(friendlyStats.totalEhp.total)} (Shield: ${Math.round(friendlyStats.totalEhp.shield)}, Armor: ${Math.round(friendlyStats.totalEhp.armor)}, Hull: ${Math.round(friendlyStats.totalEhp.hull)})
- Alpha Strike: ${Math.round(friendlyStats.totalAlpha.total)}

Role Breakdown:
${Object.entries(friendlyStats.roleAnalysis).map(([role, data]) =>
    `- ${role}: ${data.count} ships, ${Math.round(data.dps)} DPS (${Math.round(data.dpsPercentage)}%)`
  ).join('\n')}

Range Analysis:
- Short Range (< 10km): ${friendlyStats.rangeAnalysis.short.count} ships, ${Math.round(friendlyStats.rangeAnalysis.short.dps)} DPS
- Medium Range (10-30km): ${friendlyStats.rangeAnalysis.medium.count} ships, ${Math.round(friendlyStats.rangeAnalysis.medium.dps)} DPS
- Long Range (> 30km): ${friendlyStats.rangeAnalysis.long.count} ships, ${Math.round(friendlyStats.rangeAnalysis.long.dps)} DPS
Engagement Style: ${this.getEngagementStyle(friendlyStats.rangeAnalysis)}

Mobility:
- Average Speed: ${Math.round(friendlyStats.mobilityAnalysis.averageSpeed)} m/s
- Average Agility: ${friendlyStats.mobilityAnalysis.averageAgility.toFixed(2)}s

ENEMY FLEET COMPOSITION:
- Total Ships: ${enemyStats.totalShips}
- Total DPS: ${Math.round(enemyStats.totalDps.total)} (EM: ${Math.round(enemyStats.totalDps.em)}, Exp: ${Math.round(enemyStats.totalDps.explosive)}, Kin: ${Math.round(enemyStats.totalDps.kinetic)}, Therm: ${Math.round(enemyStats.totalDps.thermal)})
- Total EHP: ${Math.round(enemyStats.totalEhp.total)} (Shield: ${Math.round(enemyStats.totalEhp.shield)}, Armor: ${Math.round(enemyStats.totalEhp.armor)}, Hull: ${Math.round(enemyStats.totalEhp.hull)})
- Alpha Strike: ${Math.round(enemyStats.totalAlpha.total)}

Role Breakdown:
${Object.entries(enemyStats.roleAnalysis).map(([role, data]) => {
    const ships = data.ships.map(ship => `${ship.shipName} (x${ship.quantity})`).join(', ');
    return `- ${role}: ${data.count} ships, ${Math.round(data.dps)} DPS (${Math.round(data.dpsPercentage)}%) - Ships: ${ships}`;
  }).join('\n')}

Range Analysis:
- Short Range (< 10km): ${enemyStats.rangeAnalysis.short.count} ships, ${Math.round(enemyStats.rangeAnalysis.short.dps)} DPS
- Medium Range (10-30km): ${enemyStats.rangeAnalysis.medium.count} ships, ${Math.round(enemyStats.rangeAnalysis.medium.dps)} DPS
- Long Range (> 30km): ${enemyStats.rangeAnalysis.long.count} ships, ${Math.round(enemyStats.rangeAnalysis.long.dps)} DPS
Engagement Style: ${this.getEngagementStyle(enemyStats.rangeAnalysis)}

Mobility:
- Average Speed: ${Math.round(enemyStats.mobilityAnalysis.averageSpeed)} m/s
- Average Agility: ${enemyStats.mobilityAnalysis.averageAgility.toFixed(2)}s

SCENARIO CONTEXT:
${scenario.notes || 'Standard fleet engagement'}

TARGETING PRIORITIES:
- In the 'targeting' section of the JSON output, you must provide a prioritized list of targets.
- 'primary': The single most important ship to destroy first. This is usually a logistics or EWAR ship.
- 'secondary': The second most important ship to destroy.
- 'tertiary': The third most important ship to destroy.
- Be specific. For example, for the 'primary' field, instead of saying "EWAR ship", you must specify the exact ship name, like "Griffin (EWAR)".

Provide comprehensive analysis in JSON format with:
{
  "winChance": <percentage 0-100>,
  "timeToKill": <estimated seconds>,
  "advantages": ["advantage 1", "advantage 2", ...],
  "disadvantages": ["disadvantage 1", "disadvantage 2", ...],
  "recommendations": {
    "tactics": ["tactical recommendation 1", "tactical recommendation 2", ...],
    "targeting": {
      "primary": "ship name (role)",
      "secondary": "ship name (role)",
      "tertiary": "ship name (role)"
    },
    "positioning": "positioning strategy",
    "range": "optimal engagement range"
  },
  "targetingPriorities": [
    "ship name 1 (role)",
    "ship name 2 (role)",
    "..."
  ],
  "fleetRoles": {
    "dps": "DPS strategy recommendations",
    "logistics": "Logistics/support recommendations",
    "ewar": "EWAR strategy recommendations",
    "tackle": "Tackle/mobility recommendations"
  },
  "weaknesses": ["enemy weakness 1", "enemy weakness 2", ...],
  "threats": ["enemy threat 1", "enemy threat 2", ...],
  "summary": "Brief tactical summary and expected outcome"
}

Focus on practical EVE Online fleet combat tactics including alpha strikes, logistics chains, EWAR effectiveness, range control, and fleet positioning.`;
  }

  getEngagementStyle(rangeAnalysis) {
    const shortDps = rangeAnalysis.short.dps;
    const mediumDps = rangeAnalysis.medium.dps;
    const longDps = rangeAnalysis.long.dps;

    const totalDps = shortDps + mediumDps + longDps;

    if (totalDps === 0) {
      return 'Unknown';
    }

    const shortPercentage = (shortDps / totalDps) * 100;
    const longPercentage = (longDps / totalDps) * 100;

    if (shortPercentage > 50) {
      return 'Brawling (close range)';
    } else if (longPercentage > 50) {
      return 'Kiting (long range)';
    } else {
      return 'Mixed (versatile)';
    }
  }

  generateBasicAnalysis(friendlyStats, enemyStats) {
    // Simple numerical analysis as fallback
    const dpsRatio = enemyStats.totalDps.total > 0 ? friendlyStats.totalDps.total / enemyStats.totalDps.total : 1;
    const ehpRatio = friendlyStats.totalEhp.total > 0 ? enemyStats.totalEhp.total / friendlyStats.totalEhp.total : 1;

    // Basic win chance calculation
    const rawWinChance = (dpsRatio / ehpRatio) * 50;
    const winChance = Math.max(10, Math.min(90, rawWinChance));

    // Estimated time to kill (rough calculation)
    const enemyTimeToKill = friendlyStats.totalDps.total > 0 ? enemyStats.totalEhp.total / friendlyStats.totalDps.total : 9999;
    const friendlyTimeToKill = enemyStats.totalDps.total > 0 ? friendlyStats.totalEhp.total / enemyStats.totalDps.total : 9999;

    return {
      winChance: Math.round(winChance),
      timeToKill: Math.round(Math.min(enemyTimeToKill, friendlyTimeToKill)),
      advantages: dpsRatio > 1 ? ['Superior firepower'] : [],
      disadvantages: dpsRatio < 1 ? ['Inferior firepower'] : [],
      recommendations: {
        tactics: ['Engage based on numerical analysis'],
        targeting: ['Focus fire on primary targets'],
        positioning: 'Maintain optimal range',
        range: 'Match fleet engagement profile'
      },
      fleetRoles: {
        dps: 'Focus on damage application',
        logistics: 'Maintain repair chains',
        ewar: 'Disrupt enemy coordination',
        tackle: 'Control enemy movement'
      },
      weaknesses: ['Analysis limited - AI unavailable'],
      threats: ['Unknown enemy capabilities'],
      summary: `Basic analysis: ${winChance}% win chance based on raw DPS/EHP ratios`
    };
  }
}

module.exports = { FleetAnalyzer };
