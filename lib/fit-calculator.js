const axios = require('axios');
const { StaticData } = require('./static-data');

class FitCalculator {
  constructor() {
    this.esiBaseUrl = 'https://esi.evetech.net/latest';
    this.itemCache = new Map();
    this.staticData = new StaticData();
  }

  async getItemInfo(typeId) {
    if (this.itemCache.has(typeId)) {
      return this.itemCache.get(typeId);
    }

    try {
      const response = await axios.get(`${this.esiBaseUrl}/universe/types/${typeId}/`);
      const itemInfo = response.data;
      
      // Try to get dogma attributes (optional)
      try {
        const dogmaResponse = await axios.get(`${this.esiBaseUrl}/dogma/types/${typeId}/`);
        itemInfo.attributes = dogmaResponse.data.attributes || [];
        itemInfo.effects = dogmaResponse.data.effects || [];
      } catch (dogmaError) {
        console.warn(`Dogma data not available for ${typeId}, using defaults`);
        itemInfo.attributes = [];
        itemInfo.effects = [];
      }
      
      this.itemCache.set(typeId, itemInfo);
      return itemInfo;
    } catch (error) {
      console.error(`Error fetching item info for ${typeId}:`, error);
      return null;
    }
  }

  parseEFT(eftText) {
    const lines = eftText.split('\n').map(line => line.trim());
    
    if (lines.length === 0 || !lines[0]) {
      throw new Error('Empty EFT text');
    }

    // Parse header [ShipType, FitName]
    const headerMatch = lines[0].match(/^\[([^,]+),\s*(.+)\]$/);
    if (!headerMatch) {
      throw new Error('Invalid EFT format: header not found');
    }

    const shipType = headerMatch[1].trim();
    const fitName = headerMatch[2].trim();

    const fit = {
      shipType,
      fitName,
      modules: {
        high: [],
        med: [],
        low: [],
        rig: [],
        subsystem: []
      },
      drones: [],
      cargo: [],
      implants: []
    };

    let currentSection = 'modules';
    let moduleSlot = 'high';

    // Parse the rest of the lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line === '') {
        // Empty line indicates section change
        if (currentSection === 'modules') {
          if (moduleSlot === 'high') moduleSlot = 'med';
          else if (moduleSlot === 'med') moduleSlot = 'low';
          else if (moduleSlot === 'low') moduleSlot = 'rig';
          else if (moduleSlot === 'rig') moduleSlot = 'subsystem';
          else currentSection = 'drones';
        } else if (currentSection === 'drones') {
          currentSection = 'cargo';
        } else if (currentSection === 'cargo') {
          currentSection = 'implants';
        }
        continue;
      }

      if (currentSection === 'modules') {
        const moduleInfo = this.parseModuleLine(line);
        if (moduleInfo) {
          fit.modules[moduleSlot].push(moduleInfo);
        }
      } else if (currentSection === 'drones') {
        const droneInfo = this.parseDroneLine(line);
        if (droneInfo) {
          fit.drones.push(droneInfo);
        }
      } else if (currentSection === 'cargo') {
        const cargoInfo = this.parseCargoLine(line);
        if (cargoInfo) {
          fit.cargo.push(cargoInfo);
        }
      } else if (currentSection === 'implants') {
        const implantInfo = this.parseImplantLine(line);
        if (implantInfo) {
          fit.implants.push(implantInfo);
        }
      }
    }

    return fit;
  }

  parseModuleLine(line) {
    // Skip empty slots
    if (!line || line.toLowerCase().includes('[empty')) {
      return null;
    }

    // Handle offline modules
    const offline = line.includes('/offline');
    const cleanLine = line.replace('/offline', '').trim();

    // Handle charged modules
    const parts = cleanLine.split(',');
    const moduleName = parts[0].trim();
    const chargeName = parts[1] ? parts[1].trim() : null;

    if (!moduleName) {
      return null;
    }

    return {
      name: moduleName,
      charge: chargeName,
      offline: offline
    };
  }

  parseDroneLine(line) {
    const match = line.match(/^(.+?)\s+x(\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        quantity: parseInt(match[2])
      };
    }
    
    // If no quantity specified, assume 1
    if (line.trim()) {
      return {
        name: line.trim(),
        quantity: 1
      };
    }
    
    return null;
  }

  parseCargoLine(line) {
    const match = line.match(/^(.+?)\s+x(\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        quantity: parseInt(match[2])
      };
    }
    return null;
  }

  parseImplantLine(line) {
    return {
      name: line.trim()
    };
  }

  async calculateFitStats(fit) {
    const stats = {
      dps: { total: 0, em: 0, thermal: 0, kinetic: 0, explosive: 0 },
      volley: { total: 0, em: 0, thermal: 0, kinetic: 0, explosive: 0 },
      ehp: { hull: 0, armor: 0, shield: 0, total: 0 },
      tank: { hull: 0, armor: 0, shield: 0, total: 0 },
      speed: 0,
      agility: 0,
      signatureRadius: 0,
      scanResolution: 0,
      lockRange: 0,
      capacitor: { amount: 0, recharge: 0, stable: false }
    };

    try {
      // Get ship base stats
      const shipInfo = await this.getItemByName(fit.shipType);
      if (!shipInfo) {
        console.warn(`Ship type not found: ${fit.shipType}, using mock stats`);
        return this.generateMockFitStats(fit.shipType);
      }

      // Calculate base ship stats
      await this.calculateShipBaseStats(shipInfo, stats);

      // Process modules and their effects
      for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
        for (const module of fit.modules[slotType]) {
          if (!module.offline) {
            await this.applyModuleStats(module, stats, shipInfo);
          }
        }
      }

      // Process drones
      for (const drone of fit.drones) {
        await this.applyDroneStats(drone, stats);
      }

      // Process subsystem modules that might be misplaced drones
      const droneKeywords = ['bouncer', 'hobgoblin', 'hammerhead', 'warrior', 'vespa', 'hornet', 'acolyte', 'infiltrator', 'praetor'];
      for (const module of fit.modules.subsystem) {
        const moduleName = module.name.toLowerCase();
        const isDrone = droneKeywords.some(keyword => moduleName.includes(keyword));
        
        if (isDrone) {
          console.log(`Processing misplaced drone in subsystem slot: ${module.name}`);
          // Create a temporary drone object for processing
          const tempDrone = {
            name: module.name,
            quantity: 1 // Will be parsed from name in applyDroneStats
          };
          await this.applyDroneStats(tempDrone, stats);
        }
      }

      return stats;
    } catch (error) {
      console.error('Error calculating fit stats:', error);
      throw error;
    }
  }

  async getItemByName(itemName) {
    try {
      // First try static data lookup
      const staticItem = await this.staticData.searchItemByName(itemName);
      if (staticItem) {
        console.log(`Found ${itemName} in static data with ID ${staticItem.type_id}`);
        return staticItem;
      }
      
      console.warn(`Item ${itemName} not found in static data`);
      return null;
    } catch (error) {
      console.error(`Error searching for item ${itemName}:`, error);
      return null;
    }
  }

  async calculateShipBaseStats(shipInfo, stats) {
    // Extract base stats from ship attributes
    for (const attr of (shipInfo.attributes || [])) {
      switch (attr.attributeID) {
        case 9: // HP
          stats.ehp.hull = attr.value;
          break;
        case 265: // Armor HP
          stats.ehp.armor = attr.value;
          break;
        case 263: // Shield capacity
          stats.ehp.shield = attr.value;
          break;
        case 37: // Max velocity
          stats.speed = attr.value;
          break;
        case 70: // Agility
          stats.agility = attr.value;
          break;
        case 552: // Signature radius
          stats.signatureRadius = attr.value;
          break;
        case 564: // Scan resolution
          stats.scanResolution = attr.value;
          break;
        case 76: // Max targeting range
          stats.lockRange = attr.value;
          break;
        case 482: // Capacitor capacity
          stats.capacitor.amount = attr.value;
          break;
        case 55: // Capacitor recharge time
          stats.capacitor.recharge = attr.value;
          break;
      }
    }

    stats.ehp.total = stats.ehp.hull + stats.ehp.armor + stats.ehp.shield;
  }

  async applyModuleStats(module, stats, shipInfo = null) {
    const moduleInfo = await this.getItemByName(module.name);
    if (!moduleInfo) return;

    // Check if this is a weapon that uses charges/ammo
    const chargeInfo = module.charge ? await this.getItemByName(module.charge) : null;
    
    // For weapons, damage usually comes from the charge/ammo, not the weapon itself
    let damageSource = chargeInfo && chargeInfo.attributes ? chargeInfo : moduleInfo;
    let cycleTime = 1000; // Default 1 second in milliseconds
    let damageMultiplier = 1; // Base damage multiplier

    // Get base cycle time and multipliers from weapon module
    for (const attr of (moduleInfo.attributes || [])) {
      switch (attr.attributeID) {
        case 51: // Rate of fire / cycle time
          cycleTime = attr.value || 1000;
          break;
        case 64: // Damage multiplier 
          damageMultiplier = attr.value || 1;
          break;
      }
    }

    // Apply skill bonuses for all-V skills (level 5)
    const skillLevel = 5; // All skills at level 5
    const skillBonuses = this.getSkillBonuses(moduleInfo, shipInfo, skillLevel);
    
    // Apply rate of fire skill bonus (typically reduces cycle time)
    if (skillBonuses.rateOfFire) {
      cycleTime *= (1 + skillBonuses.rateOfFire);
    }
    
    // Apply damage skill bonus
    if (skillBonuses.damage) {
      damageMultiplier *= (1 + skillBonuses.damage);
    }

    // Get damage from charge/ammo or module
    let emDamage = 0, thermalDamage = 0, kineticDamage = 0, explosiveDamage = 0;
    
    for (const attr of (damageSource.attributes || [])) {
      switch (attr.attributeID) {
        case 114: // EM damage
          emDamage = attr.value || 0;
          break;
        case 116: // Thermal damage
          thermalDamage = attr.value || 0;
          break;
        case 117: // Kinetic damage
          kineticDamage = attr.value || 0;
          break;
        case 118: // Explosive damage
          explosiveDamage = attr.value || 0;
          break;
      }
    }

    // Apply damage multiplier and calculate DPS
    if (emDamage || thermalDamage || kineticDamage || explosiveDamage) {
      const dpsMultiplier = (1000 / cycleTime) * damageMultiplier;
      
      stats.dps.em += emDamage * dpsMultiplier;
      stats.dps.thermal += thermalDamage * dpsMultiplier;
      stats.dps.kinetic += kineticDamage * dpsMultiplier;
      stats.dps.explosive += explosiveDamage * dpsMultiplier;
      
      stats.volley.em += emDamage * damageMultiplier;
      stats.volley.thermal += thermalDamage * damageMultiplier;
      stats.volley.kinetic += kineticDamage * damageMultiplier;
      stats.volley.explosive += explosiveDamage * damageMultiplier;
    }

    // Calculate total DPS (this is simplified)
    stats.dps.total = stats.dps.em + stats.dps.thermal + stats.dps.kinetic + stats.dps.explosive;
    stats.volley.total = stats.volley.em + stats.volley.thermal + stats.volley.kinetic + stats.volley.explosive;
  }

  getSkillBonuses(moduleInfo, shipInfo, skillLevel) {
    const bonuses = {
      rateOfFire: 0,
      damage: 0,
      tracking: 0,
      range: 0,
      falloff: 0,
      cap: 0
    };

    if (!moduleInfo) return bonuses;

    // Common weapon skill bonuses (typical values for level 5 skills)
    const moduleGroupId = moduleInfo.group_id;
    const moduleName = (moduleInfo.name || '').toLowerCase();

    // Turret weapon skill bonuses
    if (this.isTurretWeapon(moduleGroupId)) {
      // Gunnery skill: 2% rate of fire bonus per level
      bonuses.rateOfFire = -0.02 * skillLevel; // Negative because it reduces cycle time

      // Weapon specialization skills: 2% damage per level
      if (this.hasWeaponSpecialization(moduleName)) {
        bonuses.damage = 0.02 * skillLevel;
      }

      // Motion prediction: 5% tracking per level  
      bonuses.tracking = 0.05 * skillLevel;

      // Sharpshooter: 5% optimal range per level
      bonuses.range = 0.05 * skillLevel;

      // Trajectory analysis: 5% falloff per level
      bonuses.falloff = 0.05 * skillLevel;
    }

    // Missile weapon skill bonuses
    if (this.isMissileWeapon(moduleGroupId)) {
      // Missile launcher operation: 2% rate of fire bonus per level
      bonuses.rateOfFire = -0.02 * skillLevel;

      // Missile specialization skills: 2% damage per level
      if (this.hasWeaponSpecialization(moduleName)) {
        bonuses.damage = 0.02 * skillLevel;
      }
    }

    // Ship-specific skill bonuses
    if (shipInfo && shipInfo.group_id) {
      const shipBonuses = this.getShipSkillBonuses(shipInfo, skillLevel);
      bonuses.damage += shipBonuses.damage;
      bonuses.rateOfFire += shipBonuses.rateOfFire;
    }

    return bonuses;
  }

  isTurretWeapon(groupId) {
    // Turret weapon group IDs (simplified)
    const turretGroups = [
      74,  // Hybrid Turrets
      76,  // Projectile Turrets  
      394, // Energy Turrets
      55,  // Energy Weapon
      3,   // Projectile Weapon
      41   // Hybrid Weapon
    ];
    return turretGroups.includes(groupId);
  }

  isMissileWeapon(groupId) {
    // Missile launcher group IDs (simplified)
    const missileGroups = [
      507, // Missile Launchers
      771, // Missile Launcher Heavy Assault
      524, // Missile Launcher Cruise
      26,  // Missile Launcher Light
      27,  // Missile Launcher Heavy
    ];
    return missileGroups.includes(groupId);
  }

  hasWeaponSpecialization(weaponName) {
    // Check if this weapon type has specialization skills
    const specializationWeapons = [
      'pulse laser', 'beam laser', 'autocannon', 'artillery', 
      'railgun', 'blaster', 'rocket', 'light missile', 'heavy missile',
      'cruise missile', 'torpedo'
    ];
    return specializationWeapons.some(weapon => weaponName.includes(weapon));
  }

  getShipSkillBonuses(shipInfo, skillLevel) {
    const bonuses = { damage: 0, rateOfFire: 0 };
    
    // Racial ship skills typically give 5% damage bonus per level
    // This is a simplified implementation - real EVE has complex trait systems
    const shipName = (shipInfo.name || '').toLowerCase();
    
    // Amarr ships - typically laser damage bonus
    if (this.isAmarrShip(shipName)) {
      bonuses.damage = 0.05 * skillLevel;
    }
    // Caldari ships - typically missile/hybrid damage bonus  
    else if (this.isCaldariShip(shipName)) {
      bonuses.damage = 0.05 * skillLevel;
    }
    // Gallente ships - typically hybrid/drone damage bonus
    else if (this.isGallenteShip(shipName)) {
      bonuses.damage = 0.05 * skillLevel;
    }
    // Minmatar ships - typically projectile damage bonus
    else if (this.isMinmatarShip(shipName)) {
      bonuses.damage = 0.05 * skillLevel;
    }

    return bonuses;
  }

  isAmarrShip(shipName) {
    const amarrShips = ['punisher', 'tormentor', 'executioner', 'inquisitor', 'crucifier'];
    return amarrShips.some(ship => shipName.includes(ship));
  }

  isCaldariShip(shipName) {
    const caldariShips = ['merlin', 'kestrel', 'condor', 'bantam', 'griffin'];
    return caldariShips.some(ship => shipName.includes(ship));
  }

  isGallenteShip(shipName) {
    const gallenteShips = ['incursus', 'tristan', 'atron', 'navitas', 'maulus'];
    return gallenteShips.some(ship => shipName.includes(ship));
  }

  isMinmatarShip(shipName) {
    const minmatarShips = ['rifter', 'breacher', 'slasher', 'burst', 'vigil', 'dragoon'];
    return minmatarShips.some(ship => shipName.includes(ship));
  }

  async applyDroneStats(drone, stats) {
    // Handle drone names that include quantity like "Bouncer I x10"
    let droneName = drone.name;
    let droneQuantity = drone.quantity || 1;
    
    // Parse quantity from name if it includes "x##"
    const quantityMatch = droneName.match(/^(.+?)\s+x(\d+)$/);
    if (quantityMatch) {
      droneName = quantityMatch[1].trim();
      droneQuantity = parseInt(quantityMatch[2]);
    }
    
    const droneInfo = await this.getItemByName(droneName);
    if (!droneInfo) {
      console.log(`Drone not found: ${droneName} (original: ${drone.name})`);
      return;
    }

    console.log(`Calculating drone stats for: ${droneName} x${droneQuantity}`);
    
    let droneRawDamage = 0;
    let droneRateOfFire = 1000; // Default 1 second
    let damageBonusMultiplier = 1;

    // Get drone damage and rate of fire
    for (const attr of (droneInfo.attributes || [])) {
      switch (attr.attributeID) {
        case 114: // EM damage
        case 116: // Thermal damage  
        case 117: // Kinetic damage
        case 118: // Explosive damage
          if (attr.value > 0) {
            droneRawDamage += attr.value;
            console.log(`  ${attr.attributeID === 114 ? 'EM' : attr.attributeID === 116 ? 'Thermal' : attr.attributeID === 117 ? 'Kinetic' : 'Explosive'} damage: ${attr.value}`);
          }
          break;
        case 51: // Rate of fire / cycle time
          droneRateOfFire = attr.value || 1000;
          console.log(`  Rate of fire: ${droneRateOfFire}ms`);
          break;
        case 64: // Damage multiplier
          damageBonusMultiplier = attr.value || 1;
          console.log(`  Damage multiplier: ${damageBonusMultiplier}`);
          break;
      }
    }

    // Calculate DPS: (damage per shot * damage multiplier * 1000ms/cycle time) * quantity
    const droneDPS = (droneRawDamage * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
    
    console.log(`  Total raw damage per drone: ${droneRawDamage}`);
    console.log(`  DPS per drone: ${droneRawDamage * damageBonusMultiplier * (1000 / droneRateOfFire)}`);
    console.log(`  Total DPS for ${droneQuantity} drones: ${droneDPS}`);

    // Check for known drone damage type overrides first (static data may be incorrect)
    const droneTypeOverrides = {
      'bouncer': 'explosive',
      'warrior': 'explosive', 
      'valkyrie': 'explosive',
      'infiltrator': 'explosive',
      'hammerhead': 'thermal',
      'vespa': 'kinetic',
      'hornet': 'kinetic',
      'berserker': 'kinetic',
      'hobgoblin': 'thermal',
      'ogre': 'thermal',
      'praetor': 'em',
      'acolyte': 'em',
      'curator': 'em'
    };
    
    let damageBrokenDown = false;
    const droneNameLower = droneName.toLowerCase();
    
    // Check for drone type override first
    for (const [droneType, damageType] of Object.entries(droneTypeOverrides)) {
      if (droneNameLower.includes(droneType)) {
        const dps = (droneRawDamage * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
        stats.dps[damageType] += dps;
        damageBrokenDown = true;
        console.log(`  Applied ${damageType} damage override for ${droneType}: ${dps} DPS`);
        break;
      }
    }
    
    // If no override found, use static data attributes
    if (!damageBrokenDown) {
      for (const attr of (droneInfo.attributes || [])) {
        let dps = 0;
        switch (attr.attributeID) {
          case 114: // EM damage
            if (attr.value > 0) {
              dps = (attr.value * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
              stats.dps.em += dps;
              damageBrokenDown = true;
            }
            break;
          case 116: // Thermal damage
            if (attr.value > 0) {
              dps = (attr.value * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
              stats.dps.thermal += dps;
              damageBrokenDown = true;
            }
            break;
          case 117: // Kinetic damage
            if (attr.value > 0) {
              dps = (attr.value * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
              stats.dps.kinetic += dps;
              damageBrokenDown = true;
            }
            break;
          case 118: // Explosive damage
            if (attr.value > 0) {
              dps = (attr.value * damageBonusMultiplier * (1000 / droneRateOfFire)) * droneQuantity;
              stats.dps.explosive += dps;
              damageBrokenDown = true;
            }
            break;
        }
      }
    }
    
    // Fallback if damage couldn't be broken down by type
    if (!damageBrokenDown && droneDPS > 0) {
      stats.dps.explosive += droneDPS; // Default to explosive as fallback
    }
    stats.dps.total = stats.dps.em + stats.dps.thermal + stats.dps.kinetic + stats.dps.explosive;
    
    console.log(`  Updated total DPS: ${stats.dps.total}`);
  }

  generateMockFitStats(shipName) {
    // Generate realistic mock stats based on ship name
    const shipClass = this.guessShipClass(shipName);
    
    let baseStats = {
      dps: { em: 50, thermal: 75, kinetic: 100, explosive: 75, total: 300 },
      ehp: { hull: 2500, armor: 4000, shield: 3500, total: 10000 },
      tank: { hull: 0, armor: 50, shield: 25, total: 75 },
      speed: 250,
      agility: 3.5,
      signatureRadius: 45,
      scanResolution: 200,
      lockRange: 50000,
      capacitor: { amount: 1000, recharge: 300, stable: true }
    };

    // Adjust based on ship class
    if (shipClass === 'frigate') {
      baseStats.speed = 350;
      baseStats.signatureRadius = 35;
      baseStats.ehp.total = 5000;
      baseStats.dps.total = 150;
    } else if (shipClass === 'destroyer') {
      baseStats.speed = 300;
      baseStats.signatureRadius = 65;
      baseStats.ehp.total = 7500;
      baseStats.dps.total = 250;
    } else if (shipClass === 'cruiser') {
      baseStats.speed = 200;
      baseStats.signatureRadius = 125;
      baseStats.ehp.total = 15000;
      baseStats.dps.total = 400;
    }

    return baseStats;
  }

  guessShipClass(shipName) {
    const frigates = ['Rifter', 'Punisher', 'Incursus', 'Merlin', 'Atron', 'Condor', 'Executioner', 'Tormentor', 'Tristan'];
    const destroyers = ['Catalyst', 'Cormorant', 'Thrasher', 'Coercer', 'Dragoon'];
    const cruisers = ['Caracal', 'Vexor', 'Thorax', 'Rupture', 'Hurricane', 'Myrmidon', 'Brutix', 'Drake'];
    
    if (frigates.includes(shipName)) return 'frigate';
    if (destroyers.includes(shipName)) return 'destroyer';
    if (cruisers.includes(shipName)) return 'cruiser';
    return 'frigate'; // default
  }
}

module.exports = { FitCalculator };