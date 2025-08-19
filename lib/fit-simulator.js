

class FitSimulator {
  constructor(fit, staticData) {
    this.fit = fit;
    this.staticData = staticData;
    this.modifiedAttributes = new Map(); // Cache for modified attributes
  }

  async _initializeAttributes() {
    // Initialize ship attributes
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
    if (shipInfo) {
      this.modifiedAttributes.set(shipInfo.name, JSON.parse(JSON.stringify(shipInfo.attributes)));
    }

    // Initialize module attributes
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo) {
          this.modifiedAttributes.set(module.name, JSON.parse(JSON.stringify(moduleInfo.attributes)));
        }
      }
    }

    // Initialize charge attributes
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        if (module.charge) {
          const chargeInfo = await this.staticData.searchItemByName(module.charge);
          if (chargeInfo) {
            this.modifiedAttributes.set(module.charge, JSON.parse(JSON.stringify(chargeInfo.attributes)));
          }
        }
      }
    }

    // Initialize drone attributes
    for (const drone of this.fit.drones) {
      console.log(`DEBUG: Processing drone: ${JSON.stringify(drone)}`); // NEW LOG
      let droneName = drone.name;
      console.log(`DEBUG: Initial droneName: ${droneName}`); // NEW LOG
      const quantityMatch = droneName.match(/^(.+?)\s+x(\d+)$/);
      if (quantityMatch) {
        droneName = quantityMatch[1].trim();
        console.log(`DEBUG: Parsed droneName: ${droneName}`); // NEW LOG
      }
      const droneInfo = await this.staticData.searchItemByName(droneName);
      console.log(`DEBUG: droneInfo for ${droneName}: ${JSON.stringify(droneInfo)}`); // NEW LOG
      if (droneInfo) {
        console.log(`DEBUG: Setting attributes for droneName: ${droneName}`);
        this.modifiedAttributes.set(droneName, JSON.parse(JSON.stringify(droneInfo.attributes)));
        console.log(`DEBUG: Map size after setting: ${this.modifiedAttributes.size}`); // NEW LOG
        console.log(`DEBUG: Map content after setting:`, this.modifiedAttributes); // NEW LOG
      } else {
        console.warn(`Could not find droneInfo for ${droneName}`);
      }
    }

    // Initialize cargo attributes (for ammo lookup)
    for (const cargoItem of this.fit.cargo) {
      const cargoInfo = await this.staticData.searchItemByName(cargoItem.name);
      if (cargoInfo) {
        this.modifiedAttributes.set(cargoItem.name, JSON.parse(JSON.stringify(cargoInfo.attributes)));
      }
    }
  }

  async getModifiedAttribute(itemName, attributeID) {
    const itemAttributes = this.modifiedAttributes.get(itemName);
    if (!itemAttributes) {
      return null;
    }

    const attribute = itemAttributes.find(attr => attr.attributeID === attributeID);
    return attribute ? attribute.value : null;
  }

  boostAttribute(itemName, attributeID, bonusValue) {
    const itemAttributes = this.modifiedAttributes.get(itemName);
    if (!itemAttributes) {
      return;
    }

    const attribute = itemAttributes.find(attr => attr.attributeID === attributeID);
    if (attribute) {
      // For cycle time attributes, we need to reduce the value (faster firing)
      if (attributeID === 51 && bonusValue < 0) { // speed/cycle time attribute
        attribute.value *= (1 + bonusValue); // bonusValue is negative, so this reduces cycle time
      } else {
        attribute.value *= (1 + bonusValue);
      }
    }
  }

  getSkillLevel() {
    // For now, assume all relevant skills are at level 5
    return 5;
  }

  async applyEffects() {
    await this._initializeAttributes(); // Attributes are initialized here

    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    // Apply skill bonuses
    // Gunnery Skills
    const gunnerySkillLevel = this.getSkillLevel('Gunnery');

    // Missile Skills
    const missileLauncherOperationSkillLevel = this.getSkillLevel('Missile Launcher Operation');

    // Drone Skills
    const dronesSkillLevel = this.getSkillLevel('Drones');
    const combatDroneOperationSkillLevel = this.getSkillLevel('Combat Drone Operation');
    
    for (const drone of this.fit.drones) {
      let droneName = drone.name;
      

      const quantityMatch = droneName.match(/^(.+?)\s+x(\d+)$/);
      if (quantityMatch) {
        droneName = quantityMatch[1].trim();
        drone.quantity = parseInt(quantityMatch[2]);
      }

      const droneInfo = await this.staticData.searchItemByName(droneName);
      if (!droneInfo) continue;

      // Drones skill (damage bonus) - 5% per level
      this.boostAttribute(droneName, 64, 0.05 * dronesSkillLevel);
      // Combat Drone Operation skill (damage bonus) - 5% per level  
      this.boostAttribute(droneName, 64, 0.05 * combatDroneOperationSkillLevel);
    }

    // Apply weapon skill bonuses to all weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (!moduleInfo) continue;
        
        // Apply gunnery skill bonuses (2% RoF per level)
        if (this.isGunneryWeapon(moduleInfo)) {
          const rofBonus = 0.02 * gunnerySkillLevel; // 10% at level V
          this.boostAttribute(module.name, 51, -rofBonus); // Reduce cycle time (faster firing)
          
          // Apply specialization skills (2% damage per level)
          const damageBonus = 0.02 * 5; // Assume specialization at V
          this.boostAttribute(module.name, 64, damageBonus);
        }
        
        // Apply missile skill bonuses
        if (this.isMissileWeapon(moduleInfo)) {
          const rofBonus = 0.02 * missileLauncherOperationSkillLevel; // 10% at level V
          this.boostAttribute(module.name, 51, -rofBonus); // Reduce cycle time (faster firing)
          
          // Apply specialization skills (2% damage per level)
          const damageBonus = 0.02 * 5; // Assume specialization at V
          this.boostAttribute(module.name, 64, damageBonus);
          
          // Apply Warhead Upgrades (2% missile damage per level)
          const warheadUpgradesBonus = 0.02 * 5; // 10% at level V
          this.boostAttribute(module.name, 64, warheadUpgradesBonus);
        }
      }
    }
    
    // Apply Ship Skill Bonuses
    if (shipInfo) {
      const shipSkillLevel = 5; // Assume all ship skills at V
      
      // Caldari Cruiser skill bonus (5% missile damage per level)
      if (this.isCaldariShip(shipInfo.name.toLowerCase()) && this.isCruiser(shipInfo.name.toLowerCase())) {
        // Applying Caldari Cruiser bonus
        const caldariCruiserBonus = 0.05 * shipSkillLevel; // 25% at V
        for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
          for (const module of this.fit.modules[slotType]) {
            const moduleInfo = await this.staticData.searchItemByName(module.name);
            if (moduleInfo && this.isMissileWeapon(moduleInfo)) {
              // Applying Caldari Cruiser bonus to missile module
              this.boostAttribute(module.name, 64, caldariCruiserBonus);
            }
          }
        }
      }
      
      // Apply Ship Racial Bonus (additional racial bonuses beyond ship skills)
      if (this.isCaldariShip(shipInfo.name.toLowerCase())) {
        const racialDamageBonus = 0.05 * 5; // 25% at V
        for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
          for (const module of this.fit.modules[slotType]) {
            const moduleInfo = await this.staticData.searchItemByName(module.name);
            if (moduleInfo && this.isMissileWeapon(moduleInfo)) {
              this.boostAttribute(module.name, 64, racialDamageBonus); // Extra racial damage bonus
            }
          }
        }
      }
    }

    // Apply Ballistic Control System bonuses (10% per module)
    const ballisticControlSystemGroupId = 367; // Group ID for Ballistic Control Systems
    const bcsDamageBonus = 0.10; // 10% bonus per module

    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && moduleInfo.group_id === ballisticControlSystemGroupId) {
          // Apply BCS bonus to missile weapons
          for (const targetSlotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
            for (const targetModule of this.fit.modules[targetSlotType]) {
              const targetModuleInfo = await this.staticData.searchItemByName(targetModule.name);
              if (targetModuleInfo && this.isMissileWeapon(targetModuleInfo)) {
                this.boostAttribute(targetModule.name, 64, bcsDamageBonus); // Damage bonus
              }
            }
          }
        }
      }
    }
  }
  
  isMissileWeapon(moduleInfo) {
    const missileGroupIds = [507, 508, 509, 510, 511, 771, 812]; // Missile launcher group IDs
    return missileGroupIds.includes(moduleInfo.group_id);
  }
  
  isGunneryWeapon(moduleInfo) {
    const gunneryGroupIds = [55, 56, 60, 74, 258, 1496]; // Turret group IDs  
    return gunneryGroupIds.includes(moduleInfo.group_id);
  }
  
  isCaldariShip(shipName) {
    const caldariShips = ['caracal', 'raven', 'drake', 'osprey', 'condor', 'kestrel', 'merlin', 'bantam', 'cormorant', 'ferox', 'moa', 'blackbird', 'scorpion', 'typhoon', 'golem'];
    return caldariShips.some(ship => shipName.toLowerCase().includes(ship));
  }
  
  isCruiser(shipName) {
    const cruiserNames = ['caracal', 'osprey', 'moa', 'blackbird', 'bellicose', 'stabber', 'rupture', 'scythe', 'thorax', 'celestis', 'vexor', 'exequror', 'omen', 'arbitrator', 'augoror', 'maller'];
    return cruiserNames.some(cruiser => shipName.toLowerCase().includes(cruiser));
  }
}

module.exports = { FitSimulator };