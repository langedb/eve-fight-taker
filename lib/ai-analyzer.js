const { GoogleGenerativeAI } = require('@google/generative-ai');

class AIAnalyzer {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Google API key is required');
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    this.staticData = null;
  }

  async ensureStaticData() {
    if (!this.staticData) {
      const { StaticData } = require('./static-data');
      this.staticData = await StaticData.getInstance();
    }
  }

  async analyzeCombat(currentShipData, targetShipData) {
    await this.ensureStaticData();
    const prompt = await this.buildCombatAnalysisPrompt(currentShipData, targetShipData);
    
    console.log('DEBUG: AI Prompt length:', prompt.length);
    console.log('DEBUG: AI Prompt includes weapons:', prompt.includes('HIGH SLOTS'));
    console.log('DEBUG: AI Prompt:', prompt);
    
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

    const staticData = this.staticData;

    // Fix for drones that ended up in subsystem slot due to EFT parsing issues
    this.fixMisplacedDrones(currentFit);
    this.fixMisplacedDrones(targetFit);

    // Get ship group names for accurate classification
    const currentShipInfo = await staticData.searchItemByName(currentFit.shipName);
    const currentShipGroupName = currentShipInfo ? currentShipInfo.group_name : 'Unknown Ship Type';

    const targetShipInfo = await staticData.searchItemByName(targetFit.shipName);
    const targetShipGroupName = targetShipInfo ? targetShipInfo.group_name : 'Unknown Ship Type';

    // Get typical tanking profiles for accurate tactical analysis
    const currentShipTankProfile = this.getShipTankingProfile(currentFit.shipName);
    const targetShipTankProfile = this.getShipTankingProfile(targetFit.shipName);

    return `
You are an expert EVE Online combat analyst. Your task is to provide tactical recommendations for "Your Ship" on how to best defeat the "Target Ship".

CRITICAL: Pay close attention to the exact damage types listed for each weapon, ammo, and drone. Do NOT make assumptions about damage types.

SHIP CLASSIFICATION DETAILS:
- Your Ship: ${currentFit.shipName} (Type: ${currentShipGroupName}, Typical Tank: ${currentShipTankProfile})
- Target Ship: ${targetFit.shipName} (Type: ${targetShipGroupName}, Typical Tank: ${targetShipTankProfile})

IMPORTANT TANKING NOTES:
- Rupture is a SHIELD-TANKED Minmatar cruiser, NOT armor-tanked
- Hurricane is a SHIELD-TANKED Minmatar battlecruiser, NOT armor-tanked  
- Stabber is a SHIELD-TANKED Minmatar cruiser, NOT armor-tanked
- Most Minmatar ships (Rupture, Hurricane, Stabber, Cyclone, Typhoon, Maelstrom) use shield tanks
- Only specific Minmatar ships like Vagabond, Muninn, Sacrilege use armor tanks
- Analyze the ACTUAL fitted modules to determine the specific tank type rather than assuming based on race

=== YOUR SHIP ===
Ship: ${currentFit.shipName} (${currentFit.fitName})

HIGH SLOTS (Weapons):
${await this.formatModuleList(currentFit.modules.low, staticData)}

MID SLOTS (Modules):
${await this.formatModuleList(currentFit.modules.med, staticData)}

LOW SLOTS (Modules):
${await this.formatModuleList(currentFit.modules.high, staticData)}

RIGS:
${await this.formatModuleList(currentFit.modules.rig, staticData)}

DRONES:
${await this.formatDroneList(currentFit.drones, staticData)}
${await this.getShipDroneBandwidthInfo(currentFit.shipName, staticData)}

CARGO/ALTERNATIVE AMMO:
${await this.formatCargoList(currentFit.cargo, staticData)}
${await this.getScriptAnalysis(currentFit.cargo, staticData)}

YOUR SHIP STATS:
- TOTAL DPS: ${currentStats.dps.total.toFixed(1)} (EM: ${currentStats.dps.em.toFixed(1)}, Thermal: ${currentStats.dps.thermal.toFixed(1)}, Kinetic: ${currentStats.dps.kinetic.toFixed(1)}, Explosive: ${currentStats.dps.explosive.toFixed(1)})
- NOTE: This DPS includes ALL fitted weapons AND drones working together
- EHP: ${currentStats.ehp.total.toFixed(0)} (Hull: ${currentStats.ehp.hull.toFixed(0)}, Armor: ${currentStats.ehp.armor.toFixed(0)}, Shield: ${currentStats.ehp.shield.toFixed(0)})
- Speed: ${currentStats.speed.toFixed(0)} m/s
- Signature Radius: ${currentStats.signatureRadius.toFixed(0)} m
- Scan Resolution: ${currentStats.scanResolution.toFixed(0)} mm
- Lock Range: ${(currentStats.lockRange/1000).toFixed(0)} km

=== TARGET SHIP ===
Ship: ${targetFit.shipName} (${targetFit.fitName})

TARGET SHIP STATS:
- DPS: ${targetStats.dps.total.toFixed(1)} (EM: ${targetStats.dps.em.toFixed(1)}, Thermal: ${targetStats.dps.thermal.toFixed(1)}, Kinetic: ${targetStats.dps.kinetic.toFixed(1)}, Explosive: ${targetStats.dps.explosive.toFixed(1)})
- EHP: ${targetStats.ehp.total.toFixed(0)} (Hull: ${targetStats.ehp.hull.toFixed(0)}, Armor: ${targetStats.ehp.armor.toFixed(0)}, Shield: ${targetStats.ehp.shield.toFixed(0)})
- Speed: ${targetStats.speed.toFixed(0)} m/s
- Signature Radius: ${targetStats.signatureRadius.toFixed(0)} m
- Scan Resolution: ${targetStats.scanResolution.toFixed(0)} mm
- Lock Range: ${(targetStats.lockRange/1000).toFixed(0)} km

=== ANALYSIS REQUEST ===
Provide a tactical analysis for "Your Ship" to defeat the "Target Ship". Focus on the following for YOUR SHIP ONLY:

1.  **Winning Strategy**: Based on the strengths of your ship and the weaknesses of the target, what is the best overall strategy to win this engagement?
2.  **Ammo Recommendations**: What is the best ammunition for YOUR SHIP's weapons against this specific target? Consider both loaded ammo and any alternatives in YOUR SHIP's cargo.
3.  **Range Control**: What is the optimal range for YOUR SHIP to engage the target? Should you kite or brawl?
4.  **Module Usage**: How should YOU use your active modules to gain an advantage?
5.  **Threats**: What are the biggest threats from the target ship that you need to be aware of?

CRITICAL MODULE ACTIVATION GUIDELINES:
- PASSIVE modules (marked [PASSIVE]) are ALWAYS active and provide constant bonuses - DO NOT recommend "activating" them
- ACTIVE modules (marked [ACTIVE]) must be manually activated by the pilot to provide their effects
- Examples of PASSIVE modules: Damage Control II, Ballistic Control Systems, Gyrostabilizers, Shield Extenders, Armor Plates, Inertial Stabilizers, all Rigs
- Examples of ACTIVE modules: Weapons, Shield Boosters, Armor Repairers, Afterburners, Microwarpdrives, Scramblers, Webs, Neutralizers, Sensor Boosters, Tracking Computers
- Only recommend activation strategies for YOUR SHIP's ACTIVE modules.
- For PASSIVE modules, mention their benefits but do not suggest "keeping them activated" or "turning them on"

CRITICAL: MODULES ARE NOT DRONES
- MODULES are fitted to your ship's slots (high/mid/low/rig) and controlled directly
- DRONES are separate entities launched from your ship's drone bay
- Energy Neutralizers are MODULES, not drones - they are activated like weapons, not "deployed" like drones
- When discussing Energy Neutralizers, Scramblers, Webs, etc. use terms like "activate", "cycle", "target", NOT "deploy"
- Example: "Activate your Small Energy Neutralizer on the target to drain their capacitor" NOT "Deploy these drones"

CRITICAL RANGE ANALYSIS AND ENGAGEMENT STRATEGY:
**Analyze weapon ranges and choose engagement strategy based on range comparison:**

1. **KITING STRATEGY** (Recommended when YOU have range advantage):
   - YOUR SHIP has longer weapon range than TARGET SHIP
   - Examples: Your railguns 20km vs their blasters 5km, Your heavy missiles 50km vs their autocannons 15km
   - **Tactic**: Fight at YOUR optimal range but OUTSIDE their weapon range
   - **Movement**: Use speed/afterburner to maintain distance, avoid letting them close
   - **Optimal Range**: Target's weapon range + 5-10km (stay outside their engagement envelope)

2. **BRAWLING STRATEGY** (Only when YOU need close range or have close-range advantage):
   - YOUR SHIP has shorter range weapons but superior DPS/tank at close range
   - Examples: Your blasters vs their beam lasers, Your autocannons vs their railguns
   - **Tactic**: Close distance quickly, use tackle to prevent escape
   - **Movement**: Orbit at optimal range of YOUR weapons, prevent them from pulling range

3. **RANGE CALCULATION EXAMPLES**:
   - **Turrets**: Optimal + Falloff = effective range (50% damage at edge of falloff)
   - **Missiles**: Max Range = maximum engagement distance
   - **Mixed Systems**: Use longest-range weapon as primary engagement range

4. **NEVER recommend brawling when you have a significant range advantage**
   - If YOUR weapons work at 30km and theirs work at 8km, fight at 25-30km
   - If YOUR missiles have 60km range and their guns have 20km range, fight at 40-50km
   - Only close to short range if YOUR short-range weapons significantly outclass theirs

5. **SPEED AND PROPULSION CONSIDERATIONS**:
   - Faster ship with longer range = perfect kiting setup
   - Slower ship with longer range = defensive kiting from optimal positions
   - Faster ship with shorter range = aggressive closing and tackling

6. **EWAR MODULE RANGE LIMITATIONS**:
   - **Energy Neutralizers**: Typically 6-10km range (small/medium/large)
   - **Warp Scramblers**: Usually 9-15km range
   - **Stasis Webs**: Typically 10-20km range  
   - **ECM Jammers**: Usually 15-24km range
   - **CRITICAL**: If recommending kiting at 30km+ range, DO NOT suggest using neutralizers/scramblers/webs
   - **Mixed Range Strategy**: For ships with both long-range weapons AND short-range EWAR:
     * Primary engagement at long range using weapons only
     * Secondary close-range option if enemy approaches (use EWAR when they get within range)
     * Example: "Fight at 40km with missiles; if they close to under 10km, activate neutralizers"

7. **RANGE-BOOSTING MODULES ANALYSIS**:
   - **Missile Guidance Computer**: +missile range when active with range script (typically +30-50% range)
   - **Tracking Computer**: +turret range when active with range script (typically +30-50% range)  
   - **Omnidirectional Tracking Link**: +drone range when active with range script
   - **Sensor Booster**: +targeting range when active with range script
   - **Range Rigs**: Passive missile/turret range bonuses (Bay Loading Accelerator, Ionic Field Projector, etc.)
   - **CRITICAL CALCULATION**: When calculating engagement ranges, account for range-boosting modules:
     * Base missile range 40km + Missile Guidance Computer (40% boost) = ~56km effective range
     * Base turret range 20km + Tracking Computer (50% boost) = ~30km effective range
     * **Always consider boosted ranges** when recommending kiting distances and engagement strategies
   - **Script Management**: Mention when to use range vs precision scripts based on engagement needs

CRITICAL DOOMSDAY WEAPON RESTRICTIONS:
- DOOMSDAY WEAPONS can ONLY target CAPITAL ships (carriers, dreadnoughts, titans, supercarriers)
- DOOMSDAY WEAPONS CANNOT target subcapital ships (frigates, destroyers, cruisers, battlecruisers, battleships)
- If YOUR SHIP has a doomsday weapon and the TARGET SHIP is a subcapital (non-capital), DO NOT recommend using the doomsday weapon
- Subcapital ship types: Frigates, Destroyers, Cruisers, Battlecruisers, Battleships, Industrial ships
- Capital ship types: Carriers, Dreadnoughts, Force Auxiliaries, Supercarriers, Titans
- If the target is a subcapital ship, focus on conventional weapons (lasers, blasters, railguns, missiles, etc.) instead

UNLOADED WEAPONS AND CARGO AMMO DATA:
${this.getCargoAmmoAnalysis(currentStats, targetStats)}
${this.getAvailableCargoAmmoDetails(currentStats, targetStats)}
- If YOUR SHIP's weapons are unloaded, analyze available ammo options in YOUR SHIP's cargo and select the most appropriate type for this engagement.
- Base YOUR SHIP's ammo selection on the target's resistance profile, ship size/speed, and expected engagement range.
- IMPORTANT: Consider all turret weapon systems and their ammo characteristics:
  * HYBRID (Railgun/Blaster): Javelin=short_range/tracking_bonus, Spike=long_range/tracking_penalty, Antimatter=short_range, Void=very_short_range, Null=short_range/tracking_bonus  
  * PROJECTILE (Auto/Arty): Barrage=long_range/tracking_bonus, Hail=short_range, Tremor=very_long_range/tracking_penalty, EMP/Fusion=standard_range
  * LASER (Pulse/Beam): Multifrequency=short_range, Scorch/Aurora=long_range/tracking_penalty, Infrared=short_range/tracking_bonus
  * FACTION variants have increased damage values compared to tech I versions
  * Always match ammo selection to engagement range and target speed/size

CRITICAL CAPITAL VS SUBCAPITAL AMMO SELECTION:
- When YOUR SHIP is a CAPITAL (titan, carrier, dreadnought, supercarrier) fighting a SUBCAPITAL target:
  * ALWAYS prioritize HIGH-TRACKING ammo types over long-range ammo
  * Capital weapons have EXTREMELY poor tracking against small, fast targets
  * **LASER CAPITALS**: Use Multifrequency XL, Infrared XL. AVOID Scorch XL, Aurora XL
  * **HYBRID CAPITALS**: Use Javelin XL, Antimatter XL, Void XL. AVOID Spike XL
  * **PROJECTILE CAPITALS**: Use Hail XL, EMP XL, Fusion XL. AVOID Tremor XL, Barrage XL
  * **MISSILE CAPITALS**: Use short-range torpedoes with high damage. Avoid long-range variants
  * Example: Titan vs Cruiser = Multifrequency XL/Javelin XL/Hail XL, NOT Scorch XL/Spike XL/Tremor XL
  * Faction variants provide even better tracking and damage

CRITICAL HIGH ANGLE WEAPONS (HAW) RECOGNITION:
- HAW weapons are CAPITAL weapons specifically designed to fight SUBCAPITAL ships
- HAW weapons have MUCH BETTER tracking than standard capital weapons
- Common HAW weapon names: "Quad Mega Pulse", "Dual Giga Pulse", "Tera Neutron", "3500mm Railgun", "XL Torpedo Launcher"
- **IF YOUR SHIP has HAW weapons (High Angle Weapons)**: These are EXCELLENT against subcapitals
  * HAW weapons can achieve 2000-3000+ DPS against subcapital targets
  * HAW dreads are specifically built for anti-subcapital warfare
  * Still prefer high-tracking ammo but HAW weapons can hit subcapitals much more reliably
  * HAW fit capitals are among the most dangerous threats to subcapital fleets

CRITICAL BREACHER POD WEAPONS RECOGNITION:
- Breacher Pod Launchers are UNIQUE weapons exclusive to Deathless Circle ships (Tholos, Cenotaph)
- **BREACHER PODS IGNORE ALL RESISTANCES** - their damage cannot be reduced by armor/shield hardeners
- Breacher pods apply damage-over-time (DoT) effects lasting 50-75 seconds
- **Damage calculation**: Uses the LOWER of flat HP damage OR percentage of target's total HP
  * Small pods: 160 flat HP OR 0.6% of target HP (whichever is lower)
  * Medium pods: 800 flat HP OR 0.8% of target HP (whichever is lower)
- **Multiple pods extend duration but do NOT stack damage** - only highest DPS effect applies
- **Unique tactical properties**:
  * Damage continues while target is in warp or tethered
  * Cannot target capsules, structures, or stargates
  * Penetrate defensive modules like Assault Damage Controls
- **Against large HP targets**: Percentage damage becomes significant (e.g., 0.8% of 100,000 HP = 800 HP per application)
- **Against small HP targets**: Flat damage is typically the limiting factor
- Evaluate ALL available ammo types in YOUR SHIP's cargo for the best tactical choice.
- Make your own tactical assessment based on the target ship's characteristics and likely engagement scenario.

CRITICAL DRONE ANALYSIS REQUIREMENTS:
1. ONLY analyze and recommend drones that are ACTUALLY FITTED in YOUR SHIP's loadout.
2. Do NOT assume any drones beyond what is explicitly listed in the DRONES section for YOUR SHIP.
3. Consider YOUR SHIP's drone bandwidth limitations.
4. EWAR drones (ECM, Tracking Disruption, Sensor Dampening, Target Painting) do NOT deal damage - they provide electronic warfare effects.
5. Combat drones deal damage and should be analyzed for damage type and DPS.
6. TACTICAL PRIORITY: Prioritize combat drones for DPS first. Use EWAR drones primarily for disengagement/escape when you need to break enemy tackle or create tactical advantage to disengage.
7. Use ONLY the damage types or EWAR effects explicitly listed next to each of your drones.

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
- When recommending ammo for YOUR SHIP, consider what alternative ammunition is available in YOUR SHIP's cargo.
- Suggest when to switch ammo during combat based on the target's tank type and the engagement phase.
- Consider ammo switching time (5-10 seconds) in your tactical recommendations.
- Prioritize ammo recommendations based on what is available in YOUR SHIP's cargo.

IMPORTANT: Never reference "the prompt", "instructions", "analysis section", "being told", or "provided data" in your response. Present all recommendations as your own tactical assessment based on ship fittings and combat analysis. Do not mention where information came from.

Provide tactical analysis in this JSON format:
{
  "winChance": <percentage 0-100>,
  "timeToKill": <estimated seconds or "N/A">,
  "majorAdvantages": ["advantage1", "advantage2", ...],
  "majorDisadvantages": ["disadvantage1", "disadvantage2", ...],
  "ammoRecommendations": ["specific ammo type recommendations for YOUR SHIP based on fitted weapons and cargo availability"],
  "moduleRecommendations": ["how to use YOUR ACTIVE fitted modules effectively - do NOT recommend activating PASSIVE modules. CRITICAL: Only recommend EWAR modules (neuts/scramblers/webs) if engagement range allows their use - check module ranges!"],
  "tactics": {
    "range": "<SPECIFIC range in km based on weapon analysis - if you outrange them, fight outside their range; if they outrange you, close to your optimal. Example: '25-30km to stay outside their 20km blaster range while using your 35km railgun optimal' NOT generic advice like 'optimal range'>",
    "movement": "<movement strategy for YOUR SHIP based on your propulsion vs theirs - kiting if you have range advantage, closing if you need short range>",
    "engagement": "<how to initiate based on YOUR FITTED tackle/EWAR>",
    "disengagement": "<escape strategy for YOUR SHIP based on your fitted modules>"
  },
  "summary": "<detailed assessment of how YOUR SHIP can win the engagement, mentioning specific weapons and modules>"
}

Be specific about actual fitted modules, weapon types, optimal ranges, and ammo choices for YOUR SHIP. This is a real PvP analysis, not generic advice.`;
  }

  async formatModuleList(modules, staticData) {
    if (!modules || modules.length === 0) {
      return "- [Empty]";
    }
    
    const formattedModules = [];
    for (const module of modules) {
      let moduleText = `- ${module.name}`;
      
      // Get module information
      const moduleInfo = staticData ? await staticData.searchItemByName(module.name) : null;
      const moduleClassification = await this.getModuleClassification(moduleInfo);
      const damageInfo = await this.getDamageInfo(moduleInfo);
      const rangeBonus = await this.getRangeBonus(moduleInfo);
      
      if (module.charge) {
        const chargeInfo = staticData ? await staticData.searchItemByName(module.charge) : null;
        const chargeDamageInfo = await this.getDamageInfo(chargeInfo);
        moduleText += ` (loaded with ${module.charge}`;
        if (chargeDamageInfo) {
          moduleText += ` - ${chargeDamageInfo}`;
        }
        const chargeWeaponAttributes = await this.getWeaponAttributes(chargeInfo, staticData);
        if (chargeWeaponAttributes) {
          moduleText += ` ${this.formatWeaponAttributes(chargeWeaponAttributes)}`;
        }
        moduleText += ')';
      } else if (damageInfo) {
        moduleText += ` - ${damageInfo}`;
      }

      const moduleWeaponAttributes = await this.getWeaponAttributes(moduleInfo, staticData);
      if (moduleWeaponAttributes) {
        moduleText += ` ${this.formatWeaponAttributes(moduleWeaponAttributes)}`;
      }

      // Add range bonus information
      if (rangeBonus) {
        moduleText += ` ${rangeBonus}`;
      }

      // Add module activation info
      if (moduleClassification) {
        moduleText += ` [${moduleClassification.type.toUpperCase()}`;
        if (moduleClassification.activationTime) {
          moduleText += ` - ${moduleClassification.activationTime}s cycle`;
        }
        moduleText += `]`;
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
        const itemWeaponAttributes = await this.getWeaponAttributes(itemInfo, staticData);
        if (itemWeaponAttributes) {
          itemText += ` ${this.formatWeaponAttributes(itemWeaponAttributes)}`;
        }
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

  async getModuleClassification(moduleInfo) {
    if (!moduleInfo) return null;
    
    const moduleName = (moduleInfo.name || '').toLowerCase();
    
    // Define passive modules (always active, cannot be manually activated/deactivated)
    const passiveModules = [
      // Tank modules
      'damage control', 'reactive armor hardener', 'coating', 'plating', 
      'energized', 'adaptive', 'resistance', 'hardener', 'extender',
      'reinforcer', 'amplifier', 'battery', 'capacitor flux coil',
      // Rigs (all rigs are passive)
      'rig', 'rigging',
      // Navigation modules
      'inertial stabilizers', 'overdrive', 'nanofiber', 'polycarbon',
      'istab', 'nano', 'polycarb',
      // Weapon upgrades
      'ballistic control system', 'bcs', 'gyrostabilizer', 'gyro',
      'heat sink', 'magnetic field stabilizer', 'tracking enhancer',
      'drone damage amplifier', 'dda',
      // Power/CPU upgrades
      'power diagnostic system', 'pds', 'reactor control unit', 'rcu',
      'co-processor', 'micro auxiliary power core', 'capacitor power relay',
      // Signal amplifiers
      'signal amplifier', 'scan rangefinding array', 'scan pinpointing array',
      'scan acquisition array', 'gravimetric backup array',
      // Passive targeted modules
      'target painter'
    ];
    
    // Define active modules (must be manually activated)
    const activeModules = [
      // Weapons (all weapons are active)
      'laser', 'blaster', 'railgun', 'pulse', 'beam', 'autocannon', 'artillery',
      'launcher', 'torpedo', 'missile', 'rocket', 'gun', 'turret', 'cannon',
      'doomsday',
      // Tackle/EWAR
      'scram', 'disruptor', 'web', 'jammer', 'dampen', 'target breaker',
      'warp', 'scrambler', 'webifier', 'neutralizer', 'nosferatu',
      // Propulsion
      'afterburner', 'microwarpdrive', 'mwd', 'ab', 'propulsion',
      // Active tank
      'repairer', 'shield booster', 'armor repairer', 
      'ancillary', 'repair', 'boost',
      // Capacitor modules (active)
      'capacitor booster', 'cap booster', 'booster',
      // Utility
      'probe launcher', 'scanner', 'cloak', 'cyno', 'jump drive',
      'tractor beam', 'salvager', 'analyzer', 'codebreaker',
      // Capacitor warfare
      'neutralizer', 'nosferatu', 'nos', 'neut', 'energy vampire',
      // Remote assistance  
      'remote rep', 'remote boost', 'remote armor', 'remote shield',
      'capacitor transmitter', 'energy transfer',
      // Active EWAR/Support modules
      'sensor booster', 'tracking computer', 'omnidirectional tracking link',
      'sensor dampener', 'tracking disruptor', 'ecm', 'burst jammer'
    ];

    // Check if module is passive
    for (const passive of passiveModules) {
      if (moduleName.includes(passive)) {
        return {
          type: 'passive',
          description: 'Always active - provides constant bonuses'
        };
      }
    }

    // Check if module is active
    for (const active of activeModules) {
      if (moduleName.includes(active)) {
        // Get activation time from attributes if available
        let activationTime = null;
        if (moduleInfo.attributes) {
          for (const attr of moduleInfo.attributes) {
            if (attr.attributeID === 73) { // activationTime
              activationTime = (attr.value / 1000).toFixed(1); // Convert from ms to seconds
              break;
            }
          }
        }
        
        // Special handling for doomsday weapons
        if (moduleName.includes('doomsday')) {
          return {
            type: 'active',
            description: 'DOOMSDAY WEAPON - Can ONLY target CAPITAL ships (carriers, dreadnoughts, titans, supercarriers). CANNOT target subcapital ships (frigates, destroyers, cruisers, battlecruisers, battleships)',
            activationTime: activationTime,
            targetRestriction: 'CAPITAL_ONLY'
          };
        }
        
        // Special handling for High Angle Weapons (HAW)
        const hawKeywords = ['quad mega', 'dual giga', 'tera neutron', '3500mm', 'xl torpedo launcher'];
        if (hawKeywords.some(keyword => moduleName.includes(keyword))) {
          return {
            type: 'active',
            description: 'HIGH ANGLE WEAPON (HAW) - Capital weapon optimized for fighting subcapital ships. Excellent tracking compared to standard capital weapons',
            activationTime: activationTime,
            weaponClass: 'HAW_CAPITAL'
          };
        }
        
        // Special handling for Breacher Pod Launchers
        if (moduleName.includes('breacher pod launcher')) {
          return {
            type: 'active',
            description: 'BREACHER POD LAUNCHER - Unique Deathless Circle weapon. Fires pods that apply damage-over-time effects that IGNORE ALL RESISTANCES. Damage uses lower of flat HP or percentage HP values',
            activationTime: activationTime,
            weaponClass: 'BREACHER_POD'
          };
        }
        
        return {
          type: 'active',
          description: 'Must be manually activated to provide effects',
          activationTime: activationTime
        };
      }
    }

    // Default classification based on group ID if available
    if (moduleInfo.group_id) {
      // Weapon groups are always active
      const weaponGroups = [55, 74, 76, 394, 507, 771, 524, 26, 27]; // Various weapon group IDs
      if (weaponGroups.includes(moduleInfo.group_id)) {
        return {
          type: 'active',
          description: 'Weapon system - must be activated to fire'
        };
      }
    }

    return null; // Unknown classification
  }

  getCargoAmmoAnalysis(currentStats, _targetStats) {
    let analysis = "";
    
    if (currentStats._cargoAmmoUsed && currentStats._cargoAmmoUsed.length > 0) {
      analysis += "UNLOADED WEAPONS STATUS:\n";
      for (const weaponAmmo of currentStats._cargoAmmoUsed) {
        const ammoCharacteristics = this.getAmmoCharacteristics(weaponAmmo.ammo);
        analysis += `- ${weaponAmmo.weapon} is currently unloaded\n`;
        analysis += `- Available in cargo: ${weaponAmmo.ammo} (${ammoCharacteristics})\n`;
        analysis += `  Damage profile: EM: ${weaponAmmo.damage.em}, Thermal: ${weaponAmmo.damage.thermal}, Kinetic: ${weaponAmmo.damage.kinetic}, Explosive: ${weaponAmmo.damage.explosive}\n`;
      }
      analysis += "\nNOTE: Multiple ammo types may be available in cargo for tactical selection.\n";
      analysis += "Consider ammo choice based on target characteristics:\n";
      analysis += "- Target ship size and speed (tracking requirements)\n";
      analysis += "- Expected engagement range (optimal vs falloff considerations)\n";  
      analysis += "- Target's likely resistance profile (damage type effectiveness)\n";
      analysis += "- Your tactical approach (kiting vs brawling)\n\n";
    }
    
    return analysis;
  }

  getAvailableCargoAmmoDetails(_currentStats, _targetStats) {
    // This method is now deprecated - cargo ammo details are handled in the main cargo formatting
    // Keeping empty to avoid breaking existing code
    return "";
  }

  identifyWeaponSystem(weaponName) {
    const name = weaponName.toLowerCase();
    
    if (name.includes('railgun') || name.includes('rail')) return 'railgun';
    if (name.includes('blaster')) return 'blaster';
    if (name.includes('autocannon') || name.includes('auto cannon')) return 'autocannon';
    if (name.includes('artillery')) return 'artillery';
    if (name.includes('pulse laser') || name.includes('pulse')) return 'pulse_laser';
    if (name.includes('beam laser') || name.includes('beam')) return 'beam_laser';
    if (name.includes('launcher') || name.includes('missile')) return 'missile';
    
    return 'unknown';
  }

  getAmmoTypesByWeaponSystem(weaponType) {
    const ammoTypes = {
      'railgun': [
        'Thorium Charge M', 'Iridium Charge M', 'Iron Charge M', 'Lead Charge M',
        'Antimatter Charge M', 'Caldari Navy Antimatter Charge M', 'Void M',
        'Javelin M', 'Spike M'
      ],
      'blaster': [
        'Thorium Charge M', 'Iridium Charge M', 'Iron Charge M', 'Lead Charge M', 
        'Antimatter Charge M', 'Caldari Navy Antimatter Charge M', 'Void M',
        'Null M', 'Neutron M'
      ],
      'autocannon': [
        'Republic Fleet EMP M', 'EMP M', 'Fusion M', 'Republic Fleet Fusion M',
        'Phased Plasma M', 'Titanium Sabot M', 'Barrage M', 'Hail M'
      ],
      'artillery': [
        'Republic Fleet EMP M', 'EMP M', 'Fusion M', 'Republic Fleet Fusion M', 
        'Phased Plasma M', 'Titanium Sabot M', 'Barrage M', 'Tremor M'
      ],
      'pulse_laser': [
        'Multifrequency M', 'Imperial Navy Multifrequency M', 'Infrared M',
        'Standard M', 'Microwave M', 'Radio M', 'Scorch M'
      ],
      'beam_laser': [
        'Multifrequency M', 'Imperial Navy Multifrequency M', 'Infrared M',
        'Standard M', 'Microwave M', 'Radio M', 'Aurora M'
      ]
    };
    
    return ammoTypes[weaponType] || ['Unknown ammo type'];
  }

  getAmmoCharacteristics(ammoName) {
    const name = ammoName.toLowerCase();
    
    // HYBRID CHARGES (Railguns & Blasters)
    if (name.includes('javelin')) {
      return "28 damage per shot, tracking modifier +25%, optimal range modifier -75%";
    }
    if (name.includes('spike')) {
      return "16 damage per shot, tracking modifier -75%, optimal range modifier +80%";
    }
    if (name.includes('antimatter')) {
      return "27.6 damage per shot, tracking modifier 0%, optimal range modifier -50%";
    }
    if (name.includes('void')) {
      return "35 damage per shot, tracking modifier 0%, optimal range modifier -75%";
    }
    if (name.includes('null')) {
      return "24 damage per shot, tracking modifier +25%, optimal range modifier -50%";
    }
    if (name.includes('neutron')) {
      return "35 damage per shot, tracking modifier 0%, optimal range modifier -75%";
    }
    if (name.includes('thorium') || name.includes('iridium') || name.includes('iron') || name.includes('lead')) {
      return "18-20 damage per shot, tracking modifier 0%, optimal range modifier 0% to -15%";
    }
    
    // PROJECTILE CHARGES (Autocannons & Artillery)
    if (name.includes('barrage')) {
      return "22 damage per shot, tracking modifier +37.5%, optimal range modifier +60%";
    }
    if (name.includes('hail')) {
      return "28 damage per shot, tracking modifier -50%, optimal range modifier -50%";
    }
    if (name.includes('tremor')) {
      return "16 damage per shot, tracking modifier -75%, optimal range modifier +200%";
    }
    if (name.includes('emp')) {
      return "18 damage per shot, tracking modifier 0%, optimal range modifier 0%";
    }
    if (name.includes('fusion')) {
      return "22 damage per shot, tracking modifier +12.5%, optimal range modifier 0%";
    }
    if (name.includes('phased plasma')) {
      return "19 damage per shot, tracking modifier +25%, optimal range modifier -25%";
    }
    if (name.includes('titanium sabot')) {
      return "14 damage per shot, tracking modifier +50%, optimal range modifier -50%";
    }
    
    // FREQUENCY CRYSTALS (Pulse & Beam Lasers)
    if (name.includes('multifrequency')) {
      return "30 damage per shot, tracking modifier +12.5%, optimal range modifier -75%";
    }
    if (name.includes('scorch')) {
      return "18 damage per shot, tracking modifier -50%, optimal range modifier +50%";
    }
    if (name.includes('aurora')) {
      return "16 damage per shot, tracking modifier -50%, optimal range modifier +100%";
    }
    if (name.includes('infrared')) {
      return "24 damage per shot, tracking modifier +12.5%, optimal range modifier -50%";
    }
    if (name.includes('standard') || name.includes('microwave') || name.includes('radio')) {
      return "20 damage per shot, tracking modifier 0%, optimal range modifier +25%";
    }
    
    // FACTION/NAVY VARIANTS
    if (name.includes('caldari navy') || name.includes('republic fleet') || name.includes('imperial navy')) {
      return "faction variant with ~15% higher damage than tech I version, same tracking/range modifiers";
    }
    
    return "check in-game attributes for damage, tracking, and range modifier values";
  }

  async getDamageInfo(itemInfo) {
    if (!itemInfo || !itemInfo.attributes) return null;
    
    const itemName = (itemInfo.name || '').toLowerCase();
    
    // Check if this is a non-combat drone type that doesn't deal damage
    const ewarDroneTypes = {
      // ECM drones (Caldari)
      'hornet ec-': 'ECM drone (jams enemy targeting)',
      'wasp ec-': 'ECM drone (jams enemy targeting)',
      'hornet ec': 'ECM drone (jams enemy targeting)',
      'wasp ec': 'ECM drone (jams enemy targeting)',
      // Tracking Disruption drones (Amarr)
      'acolyte td-': 'Tracking Disruption drone',
      'infiltrator td-': 'Tracking Disruption drone',
      // Sensor Dampening drones (Gallente)
      'hobgoblin sd-': 'Sensor Dampening drone',
      'hammerhead sd-': 'Sensor Dampening drone',
      // Target Painting drones (Minmatar)
      'warrior tp-': 'Target Painting drone',
      'valkyrie tp-': 'Target Painting drone',
      // Other EWAR drones
      'energy vampire': 'Energy Neutralizer drone',
      'nos': 'Energy Neutralizer drone',
      'neut': 'Energy Neutralizer drone',
      'web': 'Stasis Webifier drone'
    };
    
    // Check if this is an EWAR drone
    for (const [droneType, description] of Object.entries(ewarDroneTypes)) {
      if (itemName.includes(droneType)) {
        return description;
      }
    }
    
    // Check for logistics drones
    if (itemName.includes('repair') || itemName.includes('logistics')) {
      return 'Logistics drone (repairs friendly ships)';
    }
    
    // Check for mining drones
    if (itemName.includes('mining') || itemName.includes('harvester')) {
      return 'Mining drone (extracts ore)';
    }
    
    // Check for salvage drones
    if (itemName.includes('salvage')) {
      return 'Salvage drone (extracts salvage from wrecks)';
    }
    
    const damages = {
      em: 0,
      thermal: 0, 
      kinetic: 0,
      explosive: 0
    };
    
    // Extract damage values from attributes for combat drones
    for (const attr of itemInfo.attributes) {
      switch (attr.attributeID) {
        case 114: damages.em = attr.value || 0; break;
        case 116: damages.explosive = attr.value || 0; break;
        case 117: damages.kinetic = attr.value || 0; break;
        case 118: damages.thermal = attr.value || 0; break;
      }
    }
    
    // Find the primary damage type for combat drones
    const total = damages.em + damages.thermal + damages.kinetic + damages.explosive;
    if (total === 0) return null;
    
    const primaryDamage = Object.entries(damages)
      .filter(([_type, value]) => value > 0)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (primaryDamage && primaryDamage[1] > 0) {
      const damageType = primaryDamage[0].toUpperCase();
      const percentage = Math.round((primaryDamage[1] / total) * 100);
      return `${percentage}% ${damageType} damage`;
    }
    
    return null;
  }

  async getWeaponAttributes(itemInfo, staticData) {
    if (!itemInfo || !itemInfo.attributes || !itemInfo.group_id) return null;

    const attributes = {};
    const isTurret = staticData.isTurretWeapon(itemInfo.group_id);
    const isMissile = staticData.isMissileWeapon(itemInfo.group_id);
    const isEWAR = this.isEWARModule(itemInfo);

    if (isTurret) {
      for (const attr of itemInfo.attributes) {
        switch (attr.attributeID) {
          case 769: attributes.optimalRange = attr.value; break; // Optimal Range
          case 517: attributes.falloff = attr.value; break;     // Falloff
          case 767: attributes.trackingSpeed = attr.value; break; // Tracking Speed
        }
      }
    } else if (isMissile) {
      for (const attr of itemInfo.attributes) {
        switch (attr.attributeID) {
          case 847: attributes.explosionVelocity = attr.value; break; // Explosion Velocity
          case 646: attributes.explosionRadius = attr.value; break;   // Explosion Radius
          case 858: attributes.maxVelocity = attr.value; break;       // Max Velocity
          case 859: attributes.flightTime = attr.value; break;        // Flight Time (determines max range)
          case 89:  attributes.maxRange = attr.value; break;          // Max Range (direct attribute)
          // Calculate effective range from flight time and velocity if max range not available
        }
      }
      
      // Calculate missile range if not directly available
      if (!attributes.maxRange && attributes.flightTime && attributes.maxVelocity) {
        attributes.maxRange = (attributes.flightTime / 1000) * attributes.maxVelocity; // flightTime in seconds * velocity in m/s = meters
      }
    } else if (isEWAR) {
      // EWAR modules (neutralizers, scramblers, webs, etc.)
      for (const attr of itemInfo.attributes) {
        switch (attr.attributeID) {
          case 769: attributes.optimalRange = attr.value; break; // Optimal Range
          case 517: attributes.falloff = attr.value; break;     // Falloff (for some EWAR)
        }
      }
    }
    return Object.keys(attributes).length > 0 ? attributes : null;
  }

  isEWARModule(itemInfo) {
    if (!itemInfo) return false;
    
    const moduleName = (itemInfo.name || '').toLowerCase();
    const ewarModules = [
      'neutralizer', 'nosferatu', 'nos', 'neut', 'energy vampire',
      'scram', 'scrambler', 'disruptor', 'warp disruptor',
      'web', 'webifier', 'stasis web',
      'jammer', 'ecm', 'multispectral', 'ladar', 'radar', 'magnetometric', 'gravimetric',
      'sensor dampener', 'dampener', 'tracking disruptor', 'tracking computer',
      'target painter', 'painter'
    ];
    
    return ewarModules.some(ewar => moduleName.includes(ewar));
  }

  async getRangeBonus(moduleInfo) {
    if (!moduleInfo) return null;
    
    const moduleName = (moduleInfo.name || '').toLowerCase();
    
    // Missile Guidance Computer
    if (moduleName.includes('missile guidance computer')) {
      return '[RANGE BOOST: +missile range when active with range script]';
    }
    
    // Tracking Computer
    if (moduleName.includes('tracking computer')) {
      return '[RANGE BOOST: +turret range when active with range script]';
    }
    
    // Omnidirectional Tracking Link (for drones)
    if (moduleName.includes('omnidirectional tracking link')) {
      return '[RANGE BOOST: +drone range when active with range script]';
    }
    
    // Sensor Booster
    if (moduleName.includes('sensor booster')) {
      return '[RANGE BOOST: +targeting range when active with range script]';
    }
    
    // Range-extending rigs
    if (moduleName.includes('bay loading accelerator')) {
      return '[PASSIVE RANGE BOOST: +missile range]';
    }
    
    if (moduleName.includes('ionic field projector')) {
      return '[PASSIVE RANGE BOOST: +missile range]';
    }
    
    // Signal amplifiers for lock range
    if (moduleName.includes('signal amplifier')) {
      return '[PASSIVE RANGE BOOST: +targeting range]';
    }
    
    return null;
  }

  async getScriptAnalysis(cargo, staticData) {
    if (!cargo || cargo.length === 0) return '';
    
    const scripts = [];
    for (const item of cargo) {
      const itemName = item.name.toLowerCase();
      
      if (itemName.includes('script')) {
        let scriptEffect = '';
        
        if (itemName.includes('missile range script')) {
          scriptEffect = 'MISSILE RANGE SCRIPT: +missile range when loaded in Missile Guidance Computer';
        } else if (itemName.includes('missile precision script')) {
          scriptEffect = 'MISSILE PRECISION SCRIPT: +missile application when loaded in Missile Guidance Computer';
        } else if (itemName.includes('range script')) {
          scriptEffect = 'RANGE SCRIPT: +weapon range when loaded in compatible module';
        } else if (itemName.includes('tracking script')) {
          scriptEffect = 'TRACKING SCRIPT: +weapon tracking when loaded in compatible module';
        } else if (itemName.includes('optimal range script')) {
          scriptEffect = 'OPTIMAL RANGE SCRIPT: +turret optimal range when loaded in Tracking Computer';
        } else if (itemName.includes('tracking speed script')) {
          scriptEffect = 'TRACKING SPEED SCRIPT: +turret tracking when loaded in Tracking Computer';
        }
        
        if (scriptEffect) {
          scripts.push(`- ${item.name}: ${scriptEffect}`);
        }
      }
    }
    
    if (scripts.length > 0) {
      return `\nAVAILABLE SCRIPTS:\n${scripts.join('\n')}`;
    }
    
    return '';
  }

  formatWeaponAttributes(attributes) {
    const parts = [];
    
    // Range attributes (turrets and EWAR)
    if (attributes.optimalRange !== undefined) parts.push(`Opt: ${(attributes.optimalRange / 1000).toFixed(1)}km`);
    if (attributes.falloff !== undefined) parts.push(`Falloff: ${(attributes.falloff / 1000).toFixed(1)}km`);
    
    // Turret-specific attributes
    if (attributes.trackingSpeed !== undefined) parts.push(`Tracking: ${attributes.trackingSpeed.toFixed(2)} rad/s`);
    
    // Missile attributes
    if (attributes.maxRange !== undefined) parts.push(`Max Range: ${(attributes.maxRange / 1000).toFixed(1)}km`);
    if (attributes.explosionVelocity !== undefined) parts.push(`Explosion Vel: ${attributes.explosionVelocity.toFixed(0)} m/s`);
    if (attributes.explosionRadius !== undefined) parts.push(`Explosion Radius: ${attributes.explosionRadius.toFixed(0)}m`);
    if (attributes.flightTime !== undefined) parts.push(`Flight Time: ${(attributes.flightTime / 1000).toFixed(1)}s`);
    
    return parts.length > 0 ? `(${parts.join(', ')})` : '';
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
      // Handle null, undefined, or empty analysis
      if (!analysis || typeof analysis !== 'string') {
        throw new Error('Invalid analysis input');
      }
      
      // Try to extract JSON from the response  
      let jsonText = analysis.trim();
      
      // Remove markdown code blocks if present
      const codeBlockMatch = analysis.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      } else {
        // Try to find JSON object in text
        const jsonMatch = analysis.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonText = jsonMatch[0].trim();
        }
      }
      
      // Additional validation before parsing
      if (!jsonText || jsonText.length === 0) {
        throw new Error('No JSON content found');
      }
      
      const parsed = JSON.parse(jsonText);
      
      // Ensure all required fields are present with defaults
      return {
        winChance: parsed.winChance || "50%",
        timeToKill: parsed.timeToKill || "Unknown",
        majorAdvantages: parsed.majorAdvantages || [],
        majorDisadvantages: parsed.majorDisadvantages || [],
        ammoRecommendations: parsed.ammoRecommendations || [],
        moduleRecommendations: parsed.moduleRecommendations || [],
        tactics: {
          range: parsed.tactics?.range || "Optimal weapon range",
          movement: parsed.tactics?.movement || "Tactical positioning", 
          engagement: parsed.tactics?.engagement || "Standard engagement",
          disengagement: parsed.tactics?.disengagement || "Disengage when threatened"
        },
        summary: parsed.summary || "Analysis completed with fallback data"
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      // Return fallback analysis structure
      return {
        winChance: "50%",
        timeToKill: "Unknown", 
        majorAdvantages: ["Analysis unavailable"],
        majorDisadvantages: ["Analysis unavailable"],
        ammoRecommendations: ["Use optimal ammunition"],
        moduleRecommendations: ["Activate modules as needed"],
        tactics: {
          range: "Maintain optimal range",
          movement: "Use tactical positioning",
          engagement: "Engage carefully", 
          disengagement: "Disengage if threatened"
        },
        summary: "AI analysis failed - using fallback recommendations"
      };
    }
  }

  parseTextAnalysis(analysis) {
    // Fallback text parsing for when JSON isn't returned
    
    
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
    const dpsRatio = currentStats.dps?.total / (targetStats.dps?.total || 1) || 1;
    const ehpRatio = currentStats.ehp?.total / (targetStats.ehp?.total || 1) || 1;
    const speedRatio = currentStats.speed / (targetStats.speed || 1) || 1;
    
    const winChance = Math.max(10, Math.min(90, 
      (dpsRatio * 40) + (ehpRatio * 30) + (speedRatio * 20) + 10
    ));
    
    const timeToKill = targetStats.ehp?.total / (currentStats.dps?.total || 1) || 0;
    
    return {
      winChance: `${Math.round(winChance)}%`,
      timeToKill: `${Math.round(timeToKill)} seconds`,
      majorAdvantages: dpsRatio > 1.2 ? ["Higher DPS"] : speedRatio > 1.2 ? ["Speed advantage"] : ["Balanced engagement"],
      majorDisadvantages: dpsRatio < 0.8 ? ["Lower DPS"] : ehpRatio < 0.8 ? ["Lower EHP"] : ["Fairly matched"],
      ammoRecommendations: ["Use best available ammunition for target type"],
      moduleRecommendations: ["Activate defensive modules as needed"],
      tactics: {
        range: "Maintain optimal range for your weapon systems",
        movement: speedRatio > 1.2 ? "Use speed advantage to control engagement" : "Focus on tracking and positioning",
        engagement: dpsRatio > 1.2 ? "Engage aggressively" : "Engage cautiously, look for tactical advantage",
        disengagement: "Disengage if taking heavy damage without dealing significant damage in return"
      },
      summary: `Mathematical analysis indicates ${Math.round(winChance)}% estimated win chance. Focus on leveraging your ${dpsRatio > 1.2 ? 'DPS' : speedRatio > 1.2 ? 'speed' : 'positioning'} advantage.`
    };
  }

  markdownToHtml(text) {
    if (!text) return '';
    return text
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  /**
   * Determine the typical tanking profile for a ship based on its name and bonuses
   */
  getShipTankingProfile(shipName) {
    if (!shipName) return 'Unknown';
    
    const name = shipName.toLowerCase();
    
    // Minmatar ships - most are shield tanked
    if (name.includes('rupture') || name.includes('stabber') || name.includes('hurricane') || 
        name.includes('cyclone') || name.includes('typhoon') || name.includes('maelstrom')) {
      return 'Shield-tanked';
    }
    
    // Minmatar ships that are armor tanked
    if (name.includes('vagabond') || name.includes('muninn') || name.includes('sacrilege')) {
      return 'Armor-tanked';
    }
    
    // Caldari ships - typically shield tanked
    if (name.includes('merlin') || name.includes('kestrel') || name.includes('caracal') || 
        name.includes('moa') || name.includes('drake') || name.includes('raven') || 
        name.includes('rokh') || name.includes('scorpion') || name.includes('tengu')) {
      return 'Shield-tanked';
    }
    
    // Gallente ships - mixed tanking
    if (name.includes('incursus') || name.includes('thorax') || name.includes('brutix') || 
        name.includes('megathron') || name.includes('dominix') || name.includes('proteus')) {
      return 'Armor-tanked';
    }
    if (name.includes('atron') || name.includes('catalyst') || name.includes('vexor') || 
        name.includes('myrmidon') || name.includes('hyperion')) {
      return 'Shield or Armor-tanked'; // Versatile
    }
    
    // Amarr ships - typically armor tanked
    if (name.includes('punisher') || name.includes('omen') || name.includes('harbinger') || 
        name.includes('apocalypse') || name.includes('abaddon') || name.includes('legion')) {
      return 'Armor-tanked';
    }
    
    // T3 Strategic Cruisers - versatile
    if (name.includes('loki') || name.includes('tengu') || name.includes('proteus') || name.includes('legion')) {
      return 'Versatile (Shield or Armor)';
    }
    
    // Faction/pirate ships
    if (name.includes('gila') || name.includes('rattlesnake') || name.includes('barghest')) {
      return 'Shield-tanked';
    }
    if (name.includes('ashimmu') || name.includes('bhaalgorn') || name.includes('vindicator')) {
      return 'Armor-tanked';
    }
    
    return 'Unknown tanking profile';
  }

  weaponClassification(weaponName) {
    if (!weaponName) return null;
    
    const name = weaponName.toLowerCase();
    
    // High Angle Weapons (HAW) - capital anti-subcapital weapons
    if (name.includes('quad mega') || name.includes('dual giga') || 
        name.includes('tera neutron') || name.includes('3500mm') || 
        name.includes('xl torpedo launcher')) {
      return 'HAW_CAPITAL';
    }
    
    // Hybrid weapons
    if (name.includes('railgun') || name.includes('blaster')) {
      return 'HYBRID_TURRET';
    }
    
    // Energy weapons  
    if (name.includes('pulse laser') || name.includes('beam laser') || 
        name.includes('pulse') || name.includes('beam')) {
      return 'ENERGY_TURRET';
    }
    
    // Projectile weapons
    if (name.includes('autocannon') || name.includes('artillery')) {
      return 'PROJECTILE_TURRET';
    }
    
    // Missile weapons
    if (name.includes('launcher') || name.includes('missile')) {
      return 'MISSILE_LAUNCHER';
    }
    
    return null;
  }
}

module.exports = { AIAnalyzer };
