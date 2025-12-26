const fs = require('fs-extra');
const path = require('path');
const log = require('./logger');

class StaticData {
  constructor() {
    this.staticDataPath = path.join(__dirname, '../staticdata');
    this.typesData = new Map();
    this.groupsData = new Map();
    this.typeDogmaData = new Map();
    this.itemNamesMap = new Map();
    this.dogmaAttributesData = new Map();
    this.dogmaEffectsData = new Map();
    this.loaded = false;
  }

  async loadStaticData() {
    if (this.loaded) return;
    log.info('Loading EVE static data...');

    try {
      log.debug('Loading EVE static data files...');

      // Load types data from all type files
      for (let i = 0; i <= 5; i++) {
        const typesFile = path.join(this.staticDataPath, `types.${i}.json`);
        if (await fs.pathExists(typesFile)) {
          const typesJson = await fs.readJson(typesFile);
          for (const [typeId, typeData] of Object.entries(typesJson)) {
            this.typesData.set(parseInt(typeId), typeData);
          }
        }
      }

      // Populate itemNamesMap for quick lookups
      for (const [typeId, typeData] of this.typesData.entries()) {
        const typeName = typeData['typeName_en-us'] || typeData.typeName_en || typeData.name;
        if (typeName) {
          this.itemNamesMap.set(typeName.toLowerCase(), typeId);
        }
      }

      // Load groups data
      const groupsFile = path.join(this.staticDataPath, 'groups.0.json');
      if (await fs.pathExists(groupsFile)) {
        const groupsJson = await fs.readJson(groupsFile);
        log.debug(`groups.0.json loaded, size: ${Object.keys(groupsJson).length}`);
        for (const [groupId, groupData] of Object.entries(groupsJson)) {
          this.groupsData.set(parseInt(groupId), groupData);
        }
        log.debug(`groupsData map size: ${this.groupsData.size}`);
      }

      // Load type dogma data
      for (let i = 0; i <= 2; i++) {
        const dogmaFile = path.join(this.staticDataPath, `typedogma.${i}.json`);
        if (await fs.pathExists(dogmaFile)) {
          const dogmaJson = await fs.readJson(dogmaFile);
          for (const [typeId, dogmaData] of Object.entries(dogmaJson)) {
            this.typeDogmaData.set(parseInt(typeId), dogmaData);
          }
        }
      }

      // Load dogma attributes
      const attributesFile = path.join(this.staticDataPath, 'dogmaattributes.0.json');
      if (await fs.pathExists(attributesFile)) {
        const attributesJson = await fs.readJson(attributesFile);
        for (const [attrId, attrData] of Object.entries(attributesJson)) {
          this.dogmaAttributesData.set(parseInt(attrId), attrData);
        }
      }

      // Load dogma effects
      const effectsFile = path.join(this.staticDataPath, 'dogmaeffects.0.json');
      if (await fs.pathExists(effectsFile)) {
        const effectsJson = await fs.readJson(effectsFile);
        for (const [effectId, effectData] of Object.entries(effectsJson)) {
          this.dogmaEffectsData.set(parseInt(effectId), effectData);
        }
      }

      this.loaded = true;
      log.info(`Loaded static data: ${this.typesData.size} types, ${this.groupsData.size} groups, ${this.typeDogmaData.size} dogma entries, ${this.dogmaEffectsData.size} effects`);
    } catch (error) {
      log.error('Error loading static data', { error: error.message, stack: error.stack });
    }
  }

  async getItemInfo(typeId) {
    await this.loadStaticData();

    const typeData = this.typesData.get(typeId);
    if (!typeData) return null;

    let dogmaData = this.typeDogmaData.get(typeId);
    const groupData = this.groupsData.get(typeData.groupID);

    // Override Cenotaph's base shield resistances
    if (typeId === 85086) { // Cenotaph
      const shieldResistances = {
        271: 0,   // EM
        987: 0.2, // Thermal
        273: 0.4, // Kinetic
        272: 0.5  // Explosive
      };

      if (dogmaData && dogmaData.dogmaAttributes) {
        for (const attrId in shieldResistances) {
          const existingAttr = dogmaData.dogmaAttributes.find(attr => attr.attributeID === parseInt(attrId));
          if (existingAttr) {
            existingAttr.value = shieldResistances[attrId];
          } else {
            dogmaData.dogmaAttributes.push({ attributeID: parseInt(attrId), value: shieldResistances[attrId] });
          }
        }
      } else if (dogmaData) {
        dogmaData.dogmaAttributes = [];
        for (const attrId in shieldResistances) {
          dogmaData.dogmaAttributes.push({ attributeID: parseInt(attrId), value: shieldResistances[attrId] });
        }
      } else {
        // If dogmaData doesn't exist, create it with just the resistances
        dogmaData = { dogmaAttributes: [] };
        for (const attrId in shieldResistances) {
          dogmaData.dogmaAttributes.push({ attributeID: parseInt(attrId), value: shieldResistances[attrId] });
        }
      }
    }

    return {
      type_id: typeId,
      typeID: typeId, // Add this for compatibility
      name: typeData['typeName_en-us'] || typeData.typeName_en || typeData.name || `Type ${typeId}`,
      description: typeData['description_en-us'] || typeData.description_en || typeData.description || '',
      group_id: typeData.groupID,
      groupID: typeData.groupID, // Add this for compatibility
      group_name: groupData?.['groupName_en-us'] || groupData?.groupName_en || groupData?.name || '',
      category_id: groupData?.categoryID,
      attributes: dogmaData?.dogmaAttributes || [],
      effects: dogmaData?.dogmaEffects || [],
      published: typeData.published !== false
    };
  }

  async searchItemByName(itemName) {
    if (!itemName || typeof itemName !== 'string') {
      return null;
    }

    const searchName = itemName.toLowerCase();
    const typeId = this.itemNamesMap.get(searchName);
    if (typeId) {
      return await this.getItemInfo(typeId);
    }

    return null;
  }

  getDogmaAttribute(attributeId) {
    return this.dogmaAttributesData.get(attributeId);
  }

  getDogmaEffect(effectId) {
    return this.dogmaEffectsData.get(effectId);
  }

  // Alias for searchItemByName to maintain compatibility
  async findItemByName(itemName) {
    return await this.searchItemByName(itemName);
  }

  isTurretWeapon(groupId) {
    // Turret weapon group IDs from EVE static data (category 7 = Module)
    const turretGroups = [
      53,   // Energy Weapon
      55,   // Projectile Weapon
      74,   // Hybrid Weapon
      1986, // Precursor Weapon (Triglavian Entropic Disintegrators)
      4060  // Vorton Projector (EDENCOM)
    ];
    return turretGroups.includes(groupId);
  }

  isMissileWeapon(groupId) {
    // Missile launcher group IDs from EVE static data (category 7 = Module)
    const missileGroups = [
      56,   // Missile Launcher (basic/generic)
      506,  // Missile Launcher Cruise
      507,  // Missile Launcher Rocket
      508,  // Missile Launcher Torpedo
      509,  // Missile Launcher Light
      510,  // Missile Launcher Heavy
      511,  // Missile Launcher Rapid Light
      512,  // Missile Launcher Defender
      524,  // Missile Launcher XL Torpedo
      771,  // Missile Launcher Heavy Assault
      862,  // Missile Launcher Bomb
      1245, // Missile Launcher Rapid Heavy
      1673, // Missile Launcher Rapid Torpedo
      1674, // Missile Launcher XL Cruise
      4807  // Breacher Pod Launchers
    ];
    return missileGroups.includes(groupId);
  }

  /**
   * Generic method to get items by category
   */
  getItemsByCategory(categoryId) {
    const items = [];
    for (const [groupId, groupData] of this.groupsData.entries()) {
      if (groupData.categoryID === categoryId) {
        for (const [typeId, typeData] of this.typesData.entries()) {
          if (typeData.groupID === groupId && typeData.published !== false) {
            items.push({
              typeId: typeId,
              name: typeData['typeName_en-us'] || typeData.typeName_en || typeData.name,
              groupId: groupId,
              categoryId: categoryId
            });
          }
        }
      }
    }
    return items;
  }

  /**
   * Generic method to get items by group IDs
   */
  getItemsByGroups(groupIds) {
    const items = [];
    for (const groupId of groupIds) {
      for (const [typeId, typeData] of this.typesData.entries()) {
        if (typeData.groupID === groupId && typeData.published !== false) {
          items.push({
            typeId: typeId,
            name: typeData['typeName_en-us'] || typeData.typeName_en || typeData.name,
            groupId: groupId
          });
        }
      }
    }
    return items;
  }

  /**
   * Check if an item belongs to specific groups
   */
  isItemInGroups(typeId, groupIds) {
    const typeData = this.typesData.get(typeId);
    return typeData && groupIds.includes(typeData.groupID);
  }

  /**
   * Check if an item belongs to specific category
   */
  isItemInCategory(typeId, categoryId) {
    const typeData = this.typesData.get(typeId);
    if (!typeData) return false;
    const groupData = this.groupsData.get(typeData.groupID);
    return groupData && groupData.categoryID === categoryId;
  }

  /**
   * Get faction for ship based on static data instead of hard-coded names
   */
  getShipFaction(shipName) {
    // This would ideally use faction data from static files
    // For now, keeping basic functionality but making it more maintainable
    const shipLower = shipName.toLowerCase();

    // Could be enhanced to use faction data from static files
    if (shipLower.includes('amarr') || ['punisher', 'tormentor', 'executioner'].some(name => shipLower.includes(name))) {
      return 'amarr';
    }
    if (shipLower.includes('caldari') || ['merlin', 'kestrel', 'condor'].some(name => shipLower.includes(name))) {
      return 'caldari';
    }
    if (shipLower.includes('gallente') || ['incursus', 'tristan', 'atron'].some(name => shipLower.includes(name))) {
      return 'gallente';
    }
    if (shipLower.includes('minmatar') || ['rifter', 'breacher', 'slasher'].some(name => shipLower.includes(name))) {
      return 'minmatar';
    }
    return 'unknown';
  }

  /**
   * Get weapon compatibility groups dynamically from static data
   */
  getWeaponAmmoCompatibility() {
    return {
      // Projectile weapons and their compatible ammo
      projectile: {
        weaponGroups: [55], // Projectile Weapon
        ammoGroups: [83, 372, 376] // Projectile Ammo, Advanced Autocannon Ammo, Advanced Artillery Ammo
      },
      // Hybrid weapons and their compatible charges
      hybrid: {
        weaponGroups: [74], // Hybrid Weapon
        ammoGroups: [85, 373, 377] // Hybrid Charge, Advanced Railgun Charge, Advanced Blaster Charge
      },
      // Energy weapons and their compatible crystals
      energy: {
        weaponGroups: [53], // Energy Weapon
        ammoGroups: [86, 374, 375] // Frequency Crystal, Advanced Beam Laser Crystal, Advanced Pulse Laser Crystal
      },
      // Precursor weapons (Triglavian) and their charges
      precursor: {
        weaponGroups: [1986], // Precursor Weapon (Entropic Disintegrators)
        ammoGroups: [1987, 1989] // Exotic Plasma Charge, Advanced Exotic Plasma Charge
      },
      // Vorton Projectors (EDENCOM) and their charges
      vorton: {
        weaponGroups: [4060], // Vorton Projector
        ammoGroups: [4061, 4062] // Advanced Condenser Pack, Condenser Pack
      },
      // Missile launchers and their compatible missiles
      missile: {
        weaponGroups: [56, 506, 507, 508, 509, 510, 511, 512, 524, 771, 862, 1245, 1673, 1674, 4807],
        // All missile ammo groups from EVE static data (category 8 = Charge)
        ammoGroups: [
          89,   // Torpedo
          384,  // Light Missile
          385,  // Heavy Missile
          386,  // Cruise Missile
          387,  // Rocket
          476,  // XL Torpedo
          648,  // Advanced Rocket
          653,  // Advanced Light Missile
          654,  // Advanced Heavy Assault Missile
          655,  // Advanced Heavy Missile
          656,  // Advanced Cruise Missile
          657,  // Advanced Torpedo
          772,  // Heavy Assault Missile
          1010, // Compact XL Torpedo
          1019, // XL Cruise Missile
          1677, // Advanced XL Torpedo
          1678  // Advanced XL Cruise Missile
        ]
      }
    };
  }

  /**
   * Get standard attribute IDs used across the game
   */
  getStandardAttributes() {
    return {
      damage: {
        em: 114,
        explosive: 116,
        kinetic: 117,
        thermal: 118,
        multiplier: 64
      },
      weapon: {
        rateOfFire: 51,
        optimalRange: 54,
        falloff: 158,
        trackingSpeed: 160
      },
      missile: {
        velocity: 37,
        flightTime: 281
      },
      ship: {
        hullHP: 9,
        armorHP: 265,
        shieldCapacity: 263,
        maxVelocity: 37,
        agility: 70,
        signatureRadius: 552,
        scanResolution: 564,
        lockRange: 76,
        capacitorAmount: 482,
        capacitorRecharge: 55
      },
      resistances: {
        shield: {
          em: 271,
          thermal: 274,
          kinetic: 273,
          explosive: 272
        },
        armor: {
          em: 267,
          thermal: 268,
          kinetic: 269,
          explosive: 270
        },
        hull: {
          em: 109,
          thermal: 110,
          kinetic: 111,
          explosive: 113
        }
      }
    };
  }

  /**
   * Get stacking penalty values
   */
  getStackingPenalties() {
    return [1.0, 0.869, 0.571, 0.283, 0.106];
  }

  /**
   * Get drone/fighter identification from category instead of keywords
   */
  isDroneOrFighter(typeId) {
    const typeData = this.typesData.get(typeId);
    if (!typeData) return { isDrone: false, isFighter: false };

    const groupData = this.groupsData.get(typeData.groupID);
    if (!groupData) return { isDrone: false, isFighter: false };

    return {
      isDrone: groupData.categoryID === 18, // Drone category
      isFighter: groupData.categoryID === 87 // Fighter category
    };
  }

  /**
   * Get fighter stats from static data instead of hard-coded values
   */
  async getFighterStats(fighterName) {
    const fighterInfo = await this.searchItemByName(fighterName);
    if (!fighterInfo || !this.isDroneOrFighter(fighterInfo.type_id).isFighter) {
      return null;
    }

    const stats = {
      em: 0,
      thermal: 0,
      kinetic: 0,
      explosive: 0,
      total: 0
    };

    // Extract damage values from attributes if available
    for (const attr of fighterInfo.attributes || []) {
      if (attr.attributeID === 114) stats.em = attr.value;
      else if (attr.attributeID === 118) stats.thermal = attr.value;
      else if (attr.attributeID === 117) stats.kinetic = attr.value;
      else if (attr.attributeID === 116) stats.explosive = attr.value;
    }

    stats.total = stats.em + stats.thermal + stats.kinetic + stats.explosive;

    // If no damage attributes found, return null to fall back to existing system
    if (stats.total === 0) {
      return null;
    }

    return stats;
  }

  /**
   * Check if item is a weapon module based on group categories
   */
  isWeaponModule(groupId) {
    // Weapon group IDs from EVE static data (category 7 = Module)
    const weaponGroups = [
      // Turret weapons
      53,   // Energy Weapon
      55,   // Projectile Weapon
      74,   // Hybrid Weapon
      1986, // Precursor Weapon (Triglavian Entropic Disintegrators)
      4060, // Vorton Projector (EDENCOM)
      // Missile launchers
      56,   // Missile Launcher (basic/generic)
      506,  // Missile Launcher Cruise
      507,  // Missile Launcher Rocket
      508,  // Missile Launcher Torpedo
      509,  // Missile Launcher Light
      510,  // Missile Launcher Heavy
      511,  // Missile Launcher Rapid Light
      512,  // Missile Launcher Defender
      524,  // Missile Launcher XL Torpedo
      771,  // Missile Launcher Heavy Assault
      862,  // Missile Launcher Bomb
      1245, // Missile Launcher Rapid Heavy
      1673, // Missile Launcher Rapid Torpedo
      1674, // Missile Launcher XL Cruise
      // Other weapon systems
      72,   // Smart Bomb
      4807  // Breacher Pod Launchers
    ];
    return weaponGroups.includes(groupId);
  }

  /**
   * Check if item is a weapon module by type ID
   */
  async isWeaponByTypeId(typeId) {
    const itemInfo = await this.getItemInfo(typeId);
    return itemInfo && this.isWeaponModule(itemInfo.group_id);
  }

  /**
   * Get weapon type group mappings
   */
  getWeaponTypeGroups() {
    return {
      // Turret weapon module groups (category 7 = Module)
      gunnery: [53, 55, 74, 1986, 4060], // All turret-like weapons
      projectile: [55], // Projectile Weapon
      hybrid: [74], // Hybrid Weapon
      energy: [53], // Energy Weapon
      precursor: [1986], // Precursor Weapon (Triglavian)
      vorton: [4060], // Vorton Projector (EDENCOM)
      // Missile launcher module groups
      missile: [56, 506, 507, 508, 509, 510, 511, 512, 524, 771, 862, 1245, 1673, 1674, 4807],
      // Other module groups
      energyWarfare: [71], // Energy Neutralizer
      smartBomb: [72], // Smart Bomb
      drone: [64, 263], // These are attribute IDs, not group IDs (used for drone calculations)
      // Missile ammo groups (category 8 = Charge)
      heavyMissile: [385, 655], // Heavy Missile, Advanced Heavy Missile
      heavyAssaultMissile: [654, 772] // Advanced Heavy Assault Missile, Heavy Assault Missile
    };
  }

  /**
   * Get all ship types grouped by category
   */
  async getShipTypes() {
    await this.loadStaticData();

    const shipGroups = new Map();
    const shipTypes = [];

    // EVE Ship categories - categoryID 6 = Ship
    for (const [groupId, groupData] of this.groupsData.entries()) {
      if (groupData.categoryID === 6) { // Ship category
        const groupName = groupData['groupName_en-us'] || groupData.groupName_en || groupData.name;

        // Get all ships in this group
        const shipsInGroup = [];
        for (const [typeId, typeData] of this.typesData.entries()) {
          if (typeData.groupID === groupId && typeData.published !== false) {
            const shipName = typeData['typeName_en-us'] || typeData.typeName_en || typeData.name;
            if (shipName) {
              shipsInGroup.push({
                typeId: typeId,
                name: shipName,
                groupId: groupId,
                groupName: groupName
              });
            }
          }
        }

        if (shipsInGroup.length > 0) {
          // Sort ships by name
          shipsInGroup.sort((a, b) => a.name.localeCompare(b.name));

          shipGroups.set(groupName, shipsInGroup);
          shipTypes.push({
            groupName: groupName,
            ships: shipsInGroup
          });
        }
      }
    }

    // Sort groups by name
    shipTypes.sort((a, b) => a.groupName.localeCompare(b.groupName));

    return shipTypes;
  }

  static async getInstance() {
    if (!StaticData.instance) {
      const instance = new StaticData();
      await instance.loadStaticData();
      StaticData.instance = instance;
    }
    return StaticData.instance;
  }
}

StaticData.instance = null;

module.exports = { StaticData };
