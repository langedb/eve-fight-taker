const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google API key is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }

  async analyzeCombat(currentShipData, targetShipData) {
    const prompt = await this.buildCombatAnalysisPrompt(currentShipData, targetShipData);
    
    console.log('DEBUG: AI Prompt length:', prompt.length);
    console.log('DEBUG: AI Prompt includes weapons:', prompt.includes('HIGH SLOTS'));
    
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const analysis = response.text();
      
      console.log('DEBUG: AI raw response length:', analysis.length);
      console.log('DEBUG: AI response includes ammoRecommendations:', analysis.includes('ammoRecommendations'));
      console.log('DEBUG: AI response includes moduleRecommendations:', analysis.includes('moduleRecommendations'));
      
      const parsed = this.parseAnalysisResponse(analysis);
      console.log('DEBUG: Parsed analysis has ammo recommendations:', !!(parsed.ammoRecommendations?.length));
      console.log('DEBUG: Parsed analysis has module recommendations:', !!(parsed.moduleRecommendations?.length));
      
      return parsed;
    } catch (error) {
      console.error('AI analysis error:', error);
      return this.getFallbackAnalysis(currentShipData.stats, targetShipData.stats);
    }
  }

  async buildCombatAnalysisPrompt(currentShipData, targetShipData) {
    const currentFit = currentShipData.fit;
    const currentStats = currentShipData.stats;
    const targetFit = targetShipData.fit;
    const targetStats = targetShipData.stats;

    // We need access to static data for damage type lookup
    const { StaticData } = require('./static-data');
    const staticData = new StaticData();

    // Fix for drones that ended up in subsystem slot due to EFT parsing issues
    this.fixMisplacedDrones(currentFit);
    this.fixMisplacedDrones(targetFit);

    return `
You are an expert EVE Online combat analyst. Analyze the following detailed ship combat scenario and provide specific tactical recommendations based on the actual fitted modules and weapons.

CRITICAL: Pay close attention to the exact damage types listed for each weapon, ammo, and drone. Do NOT make assumptions about damage types.

=== YOUR SHIP ===
Ship: ${currentFit.shipType} (${currentFit.fitName})

HIGH SLOTS (Weapons):
${await this.formatModuleList(currentFit.modules.high, staticData)}

MID SLOTS (Modules):
${await this.formatModuleList(currentFit.modules.med, staticData)}

LOW SLOTS (Modules):
${await this.formatModuleList(currentFit.modules.low, staticData)}

RIGS:
${await this.formatModuleList(currentFit.modules.rig, staticData)}

DRONES:
${await this.formatDroneList(currentFit.drones, staticData)}
${await this.getShipDroneBandwidthInfo(currentFit.shipType, staticData)}

CARGO/ALTERNATIVE AMMO:
${await this.formatCargoList(currentFit.cargo, staticData)}

YOUR SHIP STATS:
- TOTAL DPS: ${currentStats.dps.total.toFixed(1)} (EM: ${currentStats.dps.em.toFixed(1)}, Thermal: ${currentStats.dps.thermal.toFixed(1)}, Kinetic: ${currentStats.dps.kinetic.toFixed(1)}, Explosive: ${currentStats.dps.explosive.toFixed(1)})
- NOTE: This DPS includes ALL fitted weapons AND drones working together
- EHP: ${currentStats.ehp.total.toFixed(0)} (Hull: ${currentStats.ehp.hull.toFixed(0)}, Armor: ${currentStats.ehp.armor.toFixed(0)}, Shield: ${currentStats.ehp.shield.toFixed(0)})
- Speed: ${currentStats.speed.toFixed(0)} m/s
- Signature Radius: ${currentStats.signatureRadius.toFixed(0)} m
- Scan Resolution: ${currentStats.scanResolution.toFixed(0)} mm
- Lock Range: ${(currentStats.lockRange/1000).toFixed(0)} km

=== TARGET SHIP ===
Ship: ${targetFit.shipType} (${targetFit.fitName})

HIGH SLOTS (Weapons):
${await this.formatModuleList(targetFit.modules.high, staticData)}

MID SLOTS (Modules):
${await this.formatModuleList(targetFit.modules.med, staticData)}

LOW SLOTS (Modules):
${await this.formatModuleList(targetFit.modules.low, staticData)}

RIGS:
${await this.formatModuleList(targetFit.modules.rig, staticData)}

DRONES:
${await this.formatDroneList(targetFit.drones, staticData)}
${await this.getShipDroneBandwidthInfo(targetFit.shipType, staticData)}

CARGO/ALTERNATIVE AMMO:
${await this.formatCargoList(targetFit.cargo, staticData)}

TARGET SHIP STATS:
- DPS: ${targetStats.dps.total.toFixed(1)} (EM: ${targetStats.dps.em.toFixed(1)}, Thermal: ${targetStats.dps.thermal.toFixed(1)}, Kinetic: ${targetStats.dps.kinetic.toFixed(1)}, Explosive: ${targetStats.dps.explosive.toFixed(1)})
- EHP: ${targetStats.ehp.total.toFixed(0)} (Hull: ${targetStats.ehp.hull.toFixed(0)}, Armor: ${targetStats.ehp.armor.toFixed(0)}, Shield: ${targetStats.ehp.shield.toFixed(0)})
- Speed: ${targetStats.speed.toFixed(0)} m/s
- Signature Radius: ${targetStats.signatureRadius.toFixed(0)} m
- Scan Resolution: ${targetStats.scanResolution.toFixed(0)} mm
- Lock Range: ${(targetStats.lockRange/1000).toFixed(0)} km

=== ANALYSIS REQUEST ===
Based on the specific weapons, modules, and ammo types fitted on both ships, analyze this combat scenario. Consider:

1. WEAPON SYSTEMS: Analyze the specific weapons (pulse lasers, railguns, autocannons, etc.) and their optimal/falloff ranges
2. AMMO RECOMMENDATIONS: Recommend specific ammo types based on target's tank type and resistances - IMPORTANT: Consider both currently loaded ammo AND alternative ammo available in cargo
3. RANGE CONTROL: Provide specific optimal range recommendations based on weapon systems
4. MODULE INTERACTIONS: Consider how specific fitted modules (webs, scrams, AB/MWD, etc.) affect the engagement
5. DAMAGE TYPES: Match your weapon's damage types against target's tank strengths/weaknesses
6. ENGAGEMENT PROFILE: Kiting vs brawling based on actual fitted modules
7. CARGO ANALYSIS: Evaluate alternative ammunition and charges available in cargo for tactical switching during combat

CRITICAL DRONE ANALYSIS REQUIREMENTS:
1. ONLY analyze and recommend drones that are ACTUALLY FITTED in the ship loadouts above
2. Do NOT assume any drones beyond what is explicitly listed in the DRONES section
3. Consider drone bandwidth limitations - ships can only launch drones up to their maximum bandwidth
4. If multiple drone types are fitted, recommend which ones to prioritize based on engagement range and damage application
5. Use ONLY the damage types explicitly listed next to each drone above

IMPORTANT DAMAGE TYPE REFERENCE:
- Bouncer I/II drones: EXPLOSIVE damage
- Hammerhead I/II drones: THERMAL damage  
- Hobgoblin I/II drones: THERMAL damage
- Warrior I/II drones: EXPLOSIVE damage
- Vespa I/II drones: KINETIC damage
- Hornet I/II drones: KINETIC damage
- Infiltrator I/II drones: EXPLOSIVE damage
- Praetor I/II drones: EM damage
- Acolyte I/II drones: EM damage
- Curator I/II drones: EM damage

Use ONLY the damage types explicitly listed next to each weapon, ammo, and drone above. Do NOT assume damage types based on names or weapon categories.

CARGO AMMO STRATEGY:
- When recommending ammo, consider what alternative ammunition is available in each ship's cargo
- Suggest when to switch ammo during combat based on target tank type and engagement phase
- Consider ammo switching time (5-10 seconds) in tactical recommendations
- Prioritize ammo recommendations based on cargo availability

Provide tactical analysis in this JSON format:
{
  "winChance": <percentage 0-100>,
  "timeToKill": <estimated seconds or "N/A">,
  "majorAdvantages": ["advantage1", "advantage2", ...],
  "majorDisadvantages": ["disadvantage1", "disadvantage2", ...],
  "ammoRecommendations": ["specific ammo type recommendations based on fitted weapons and cargo availability"],
  "moduleRecommendations": ["how to use your fitted modules effectively"],
  "tactics": {
    "range": "<specific optimal range in km based on your weapons vs theirs>",
    "movement": "<movement strategy based on your propulsion vs theirs>",
    "engagement": "<how to initiate based on your fitted tackle/EWAR>",
    "disengagement": "<escape strategy based on your fitted modules>"
  },
  "summary": "<detailed assessment mentioning specific weapons and modules>"
}

Be specific about actual fitted modules, weapon types, optimal ranges, and ammo choices. This is a real PvP analysis, not generic advice.`;
  }

  async formatModuleList(modules, staticData) {
    if (!modules || modules.length === 0) {
      return "- [Empty]";
    }
    
    const formattedModules = [];
    for (const module of modules) {
      let moduleText = `- ${module.name}`;
      
      // Get module damage information
      const moduleInfo = staticData ? await staticData.searchItemByName(module.name) : null;
      const damageInfo = await this.getDamageInfo(moduleInfo);
      
      if (module.charge) {
        const chargeInfo = staticData ? await staticData.searchItemByName(module.charge) : null;
        const chargeDamageInfo = await this.getDamageInfo(chargeInfo);
        moduleText += ` (loaded with ${module.charge}`;
        if (chargeDamageInfo) {
          moduleText += ` - ${chargeDamageInfo}`;
        }
        moduleText += ')';
      } else if (damageInfo) {
        moduleText += ` - ${damageInfo}`;
      }
      
      if (module.offline) {
        moduleText += " [OFFLINE]";
      }
      formattedModules.push(moduleText);
    }
    
    return formattedModules.join('\n');
  }

  async formatDroneList(drones, staticData) {
    if (!drones || drones.length === 0) {
      return "- [None]";
    }
    
    const formattedDrones = [];
    let totalBandwidthUsed = 0;
    
    for (const drone of drones) {
      const droneInfo = staticData ? await staticData.searchItemByName(drone.name) : null;
      const damageInfo = await this.getDamageInfo(droneInfo);
      const bandwidthPerDrone = await this.getDroneBandwidth(droneInfo) || 0;
      const totalBandwidth = bandwidthPerDrone * drone.quantity;
      totalBandwidthUsed += totalBandwidth;
      
      let droneText = `- ${drone.name} x${drone.quantity}`;
      if (damageInfo) {
        droneText += ` - ${damageInfo}`;
      }
      if (bandwidthPerDrone > 0) {
        droneText += ` (${bandwidthPerDrone} Mbit/s each, ${totalBandwidth} total)`;
      }
      formattedDrones.push(droneText);
    }
    
    if (totalBandwidthUsed > 0) {
      formattedDrones.push(`\nTOTAL DRONE BANDWIDTH USED: ${totalBandwidthUsed} Mbit/s`);
    }
    
    return formattedDrones.join('\n');
  }

  async formatCargoList(cargo, staticData) {
    if (!cargo || cargo.length === 0) {
      return "- [None]";
    }
    
    const formattedCargo = [];
    const ammoItems = [];
    const otherItems = [];
    
    for (const item of cargo) {
      const itemInfo = staticData ? await staticData.searchItemByName(item.name) : null;
      const damageInfo = await this.getDamageInfo(itemInfo);
      
      let itemText = `- ${item.name}`;
      if (item.quantity && item.quantity > 1) {
        itemText += ` x${item.quantity}`;
      }
      
      if (damageInfo) {
        itemText += ` - ${damageInfo}`;
        ammoItems.push(itemText);
      } else {
        otherItems.push(itemText);
      }
    }
    
    // Show ammo first, then other items
    if (ammoItems.length > 0) {
      formattedCargo.push("AMMUNITION/CHARGES:");
      formattedCargo.push(...ammoItems);
    }
    
    if (otherItems.length > 0) {
      if (ammoItems.length > 0) {
        formattedCargo.push("");
        formattedCargo.push("OTHER ITEMS:");
      }
      formattedCargo.push(...otherItems);
    }
    
    return formattedCargo.join('\n');
  }

  async getDamageInfo(itemInfo) {
    if (!itemInfo || !itemInfo.attributes) return null;
    
    // Check for known drone damage types first (overrides static data due to known inaccuracies)
    const itemName = (itemInfo.name || '').toLowerCase();
    
    // NOTE: Now using static data directly since attribute mapping is fixed
    // These overrides are kept for reference but static data should be accurate now
    const droneTypeOverrides = {};
    
    // Check if this is a drone with known damage type
    for (const [droneName, damageType] of Object.entries(droneTypeOverrides)) {
      if (itemName.includes(droneName)) {
        return `100% ${damageType} damage`;
      }
    }
    
    const damages = {
      em: 0,
      thermal: 0, 
      kinetic: 0,
      explosive: 0
    };
    
    // Extract damage values from attributes
    for (const attr of itemInfo.attributes) {
      switch (attr.attributeID) {
        case 114: damages.em = attr.value || 0; break;
        case 116: damages.explosive = attr.value || 0; break;
        case 117: damages.kinetic = attr.value || 0; break;
        case 118: damages.thermal = attr.value || 0; break;
      }
    }
    
    // Find the primary damage type
    const total = damages.em + damages.thermal + damages.kinetic + damages.explosive;
    if (total === 0) return null;
    
    const primaryDamage = Object.entries(damages)
      .filter(([type, value]) => value > 0)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (primaryDamage && primaryDamage[1] > 0) {
      const damageType = primaryDamage[0].toUpperCase();
      const percentage = Math.round((primaryDamage[1] / total) * 100);
      return `${percentage}% ${damageType} damage`;
    }
    
    return null;
  }

  async getDroneBandwidth(itemInfo) {
    if (!itemInfo || !itemInfo.attributes) return null;
    
    for (const attr of itemInfo.attributes) {
      if (attr.attributeID === 1271) { // droneBandwidthUsed
        return attr.value;
      }
    }
    return null;
  }

  async getShipDroneBandwidth(shipInfo) {
    if (!shipInfo || !shipInfo.attributes) return 0;
    
    for (const attr of shipInfo.attributes) {
      if (attr.attributeID === 38) { // droneBandwidth (ship attribute)
        return attr.value || 0;
      }
    }
    return 0;
  }

  async getShipDroneBandwidthInfo(shipType, staticData) {
    const shipInfo = staticData ? await staticData.searchItemByName(shipType) : null;
    const maxBandwidth = await this.getShipDroneBandwidth(shipInfo);
    
    if (maxBandwidth > 0) {
      return `SHIP DRONE BANDWIDTH: ${maxBandwidth} Mbit/s maximum`;
    }
    return '';
  }

  fixMisplacedDrones(fit) {
    // Check subsystem slot for items that are actually drones
    const droneKeywords = ['bouncer', 'hobgoblin', 'hammerhead', 'warrior', 'vespa', 'hornet', 'acolyte', 'infiltrator', 'praetor'];
    
    if (fit.modules && fit.modules.subsystem) {
      const subsystemModules = fit.modules.subsystem.slice(); // Create a copy
      fit.modules.subsystem = []; // Clear subsystem array
      
      for (const module of subsystemModules) {
        const moduleName = module.name.toLowerCase();
        const isDrone = droneKeywords.some(keyword => moduleName.includes(keyword));
        
        if (isDrone) {
          // Parse quantity from name like "Bouncer I x10"
          const match = module.name.match(/^(.+?)\s+x(\d+)$/);
          if (match) {
            // Add to drones array with proper structure
            fit.drones.push({
              name: match[1].trim(),
              quantity: parseInt(match[2])
            });
            console.log(`Fixed misplaced drone: ${match[1].trim()} x${match[2]}`);
          } else {
            // Add to drones array with quantity 1
            fit.drones.push({
              name: module.name,
              quantity: 1
            });
            console.log(`Fixed misplaced drone: ${module.name} x1`);
          }
        } else {
          // Keep in subsystem if it's not a drone
          fit.modules.subsystem.push(module);
        }
      }
    }
  }

  parseAnalysisResponse(analysis) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysis.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback parsing if JSON isn't properly formatted
      return this.parseTextAnalysis(analysis);
    } catch (error) {
      console.error('Error parsing AI response:', error);
      return this.parseTextAnalysis(analysis);
    }
  }

  parseTextAnalysis(analysis) {
    // Fallback text parsing for when JSON isn't returned
    const lines = analysis.split('\n').filter(line => line.trim());
    
    return {
      winChance: this.extractNumber(analysis, /win.*?(\d+)%/i) || 50,
      timeToKill: this.extractTimeToKill(analysis),
      majorAdvantages: this.extractListItems(analysis, /advantage|strength/i),
      majorDisadvantages: this.extractListItems(analysis, /disadvantage|weakness/i),
      tactics: {
        range: this.extractTactic(analysis, /range|distance/i),
        movement: this.extractTactic(analysis, /movement|maneuver|position/i),
        engagement: this.extractTactic(analysis, /engage|attack|approach/i),
        disengagement: this.extractTactic(analysis, /disengage|retreat|escape/i)
      },
      summary: this.extractSummary(analysis)
    };
  }

  extractNumber(text, regex) {
    const match = text.match(regex);
    return match ? parseInt(match[1]) : null;
  }

  extractTimeToKill(text) {
    const timeMatch = text.match(/(\d+)\s*(second|minute|sec|min)/i);
    if (timeMatch) {
      const value = parseInt(timeMatch[1]);
      const unit = timeMatch[2].toLowerCase();
      return unit.startsWith('min') ? value * 60 : value;
    }
    return "N/A";
  }

  extractListItems(text, categoryRegex) {
    const items = [];
    const lines = text.split('\n');
    
    let inCategory = false;
    for (const line of lines) {
      if (categoryRegex.test(line)) {
        inCategory = true;
        continue;
      }
      
      if (inCategory) {
        if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          items.push(line.replace(/^[-•]\s*/, '').trim());
        } else if (line.trim() === '') {
          inCategory = false;
        }
      }
    }
    
    return items.slice(0, 3); // Limit to 3 items
  }

  extractTactic(text, categoryRegex) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (categoryRegex.test(lines[i])) {
        // Return next few lines as the tactic
        const tacticLines = [];
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          if (lines[j].trim() && !lines[j].includes(':')) {
            tacticLines.push(lines[j].trim());
          } else {
            break;
          }
        }
        return tacticLines.join(' ').substring(0, 200);
      }
    }
    return "Assess situation dynamically";
  }

  extractSummary(text) {
    // Try to find a summary section or use the first few meaningful sentences
    const summaryMatch = text.match(/summary[:\-\s]*(.*?)(?:\n\n|\n[A-Z]|$)/is);
    if (summaryMatch) {
      return summaryMatch[1].trim().substring(0, 300);
    }
    
    // Fallback to first paragraph
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ').trim().substring(0, 300);
  }

  getFallbackAnalysis(currentStats, targetStats) {
    // Basic fallback analysis when AI is unavailable
    const dpsRatio = currentStats.dps.total / (targetStats.dps.total || 1);
    const ehpRatio = currentStats.ehp.total / (targetStats.ehp.total || 1);
    const speedRatio = currentStats.speed / (targetStats.speed || 1);
    
    const winChance = Math.max(10, Math.min(90, 
      (dpsRatio * 40) + (ehpRatio * 30) + (speedRatio * 20) + 10
    ));
    
    const timeToKill = targetStats.ehp.total / (currentStats.dps.total || 1);
    
    return {
      winChance: Math.round(winChance),
      timeToKill: Math.round(timeToKill),
      majorAdvantages: dpsRatio > 1.2 ? ["Higher DPS"] : speedRatio > 1.2 ? ["Speed advantage"] : ["Balanced engagement"],
      majorDisadvantages: dpsRatio < 0.8 ? ["Lower DPS"] : ehpRatio < 0.8 ? ["Lower EHP"] : ["Fairly matched"],
      tactics: {
        range: "Maintain optimal range for your weapon systems",
        movement: speedRatio > 1.2 ? "Use speed advantage to control engagement" : "Focus on tracking and positioning",
        engagement: dpsRatio > 1.2 ? "Engage aggressively" : "Engage cautiously, look for tactical advantage",
        disengagement: "Disengage if taking heavy damage without dealing significant damage in return"
      },
      summary: `Combat analysis shows ${winChance}% estimated win chance. Focus on leveraging your ${dpsRatio > 1.2 ? 'DPS' : speedRatio > 1.2 ? 'speed' : 'positioning'} advantage.`
    };
  }
}

module.exports = { AIAnalyzer };