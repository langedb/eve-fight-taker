const fs = require('fs-extra');
const path = require('path');

class StaticData {
  constructor() {
    this.staticDataPath = path.join(__dirname, '../staticdata');
    this.typesData = new Map();
    this.groupsData = new Map();
    this.typeDogmaData = new Map();
    this.dogmaAttributesData = new Map();
    this.loaded = false;
  }

  async loadStaticData() {
    if (this.loaded) return;

    try {
      console.log('Loading EVE static data...');
      
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

      // Load groups data
      const groupsFile = path.join(this.staticDataPath, 'groups.0.json');
      if (await fs.pathExists(groupsFile)) {
        const groupsJson = await fs.readJson(groupsFile);
        for (const [groupId, groupData] of Object.entries(groupsJson)) {
          this.groupsData.set(parseInt(groupId), groupData);
        }
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

      this.loaded = true;
      console.log(`Loaded static data: ${this.typesData.size} types, ${this.groupsData.size} groups, ${this.typeDogmaData.size} dogma entries`);
    } catch (error) {
      console.error('Error loading static data:', error);
    }
  }

  async getItemInfo(typeId) {
    await this.loadStaticData();
    
    const typeData = this.typesData.get(typeId);
    if (!typeData) return null;

    const dogmaData = this.typeDogmaData.get(typeId);
    const groupData = this.groupsData.get(typeData.groupID);

    return {
      type_id: typeId,
      name: typeData['typeName_en-us'] || typeData.typeName_en || typeData.name || `Type ${typeId}`,
      description: typeData['description_en-us'] || typeData.description_en || typeData.description || '',
      group_id: typeData.groupID,
      group_name: groupData?.['name_en-us'] || groupData?.name_en || groupData?.name || '',
      attributes: dogmaData?.dogmaAttributes || [],
      effects: dogmaData?.dogmaEffects || [],
      published: typeData.published !== false
    };
  }

  async searchItemByName(itemName) {
    await this.loadStaticData();
    
    if (!itemName || typeof itemName !== 'string') {
      return null;
    }
    
    const searchName = itemName.toLowerCase();
    for (const [typeId, typeData] of this.typesData.entries()) {
      const typeName = typeData['typeName_en-us'] || typeData.typeName_en || typeData.name || '';
      if (typeName.toLowerCase() === searchName) {
        return await this.getItemInfo(typeId);
      }
    }
    
    // Fuzzy search if exact match not found
    for (const [typeId, typeData] of this.typesData.entries()) {
      const typeName = typeData['typeName_en-us'] || typeData.typeName_en || typeData.name || '';
      if (typeName.toLowerCase().includes(searchName)) {
        return await this.getItemInfo(typeId);
      }
    }
    
    return null;
  }

  getDogmaAttribute(attributeId) {
    return this.dogmaAttributesData.get(attributeId);
  }

  

  

  isTurretWeapon(groupId) {
    // Comprehensive list of turret weapon group IDs
    const turretGroups = [
      74,  // Hybrid Turrets
      76,  // Projectile Turrets
      394, // Energy Turrets
      55,  // Energy Weapon (generic)
      3,   // Projectile Weapon (generic)
      41,  // Hybrid Weapon (generic)
      533, // Small Autocannon
      534, // Medium Autocannon
      535, // Large Autocannon
      536, // Small Artillery
      537, // Medium Artillery
      538, // Large Artillery
      539, // Small Beam Laser
      540, // Medium Beam Laser
      541, // Large Beam Laser
      542, // Small Pulse Laser
      543, // Medium Pulse Laser
      544, // Large Pulse Laser
      545, // Small Blaster
      546, // Medium Blaster
      547, // Large Blaster
      548, // Small Railgun
      549, // Medium Railgun
      550  // Large Railgun
    ];
    return turretGroups.includes(groupId);
  }

  isMissileWeapon(groupId) {
    // Comprehensive list of missile launcher group IDs
    const missileGroups = [
      507, // Missile Launchers (generic)
      771, // Heavy Assault Missile Launchers
      524, // Cruise Missile Launchers
      26,  // Light Missile Launchers
      27,  // Heavy Missile Launchers
      511, // Rapid Light Missile Launchers
      530, // Rocket Launchers
      531, // Light Missile Launchers
      532, // Heavy Missile Launchers
      551, // Cruise Missile Launchers
      552, // Torpedo Launchers
      553  // Heavy Assault Missile Launchers
    ];
    return missileGroups.includes(groupId);
  }

  isAmarrShip(shipName) {
    const amarrShips = ['punisher', 'tormentor', 'executioner', 'inquisitor', 'crucifier', 'magnate', 'coercer', 'omen', 'maller', 'harbinger', 'prophecy', 'apocalypse', 'armageddon', 'abaddon'];
    return amarrShips.some(ship => shipName.includes(ship));
  }

  isCaldariShip(shipName) {
    const caldariShips = ['merlin', 'kestrel', 'condor', 'bantam', 'griffin', 'corax', 'caracal', 'moa', 'naga', 'ferox', 'drake', 'scorpion', 'raven', 'rokh'];
    return caldariShips.some(ship => shipName.includes(ship));
  }

  isGallenteShip(shipName) {
    const gallenteShips = ['incursus', 'tristan', 'atron', 'navitas', 'maulus', 'catalyst', 'vexor', 'thorax', 'brutix', 'megathron', 'dominix', 'hyperion'];
    return gallenteShips.some(ship => shipName.includes(ship));
  }

  isMinmatarShip(shipName) {
    const minmatarShips = ['rifter', 'breacher', 'slasher', 'burst', 'vigil', 'thrasher', 'stabber', 'rupture', 'hurricane', 'typhoon', 'maelstrom', 'tempest'];
    return minmatarShips.some(ship => shipName.includes(ship));
  }
}

module.exports = { StaticData };