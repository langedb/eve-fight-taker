const { ModifiedAttributeStore } = require('./modified-attribute-store');

class FitSimulator {
  constructor(fit, staticData) {
    this.fit = fit;
    this.staticData = staticData;
    this.shipAttributes = null; // Will be an instance of ModifiedAttributeStore
    this.moduleAttributes = new Map(); // Map<moduleName, ModifiedAttributeStore>
    this.droneAttributes = new Map(); // Map<droneName, ModifiedAttributeStore>
    this.chargeAttributes = new Map(); // Map<chargeName, ModifiedAttributeStore>
    
    // PyFA-style fit-wide bonus tracking
    this.fitBonuses = {
      character: {
        // Skill bonuses (applied once per character)
        gunneryROF: 0.02 * 5,          // Gunnery skill 10% at V
        gunnerySpecialization: 0.02 * 5, // Weapon specializations 10% at V 
        missileROF: 0.02 * 5,          // Missile Launcher Operation 10% at V
        missileSpecialization: 0.02 * 5, // Missile specializations 10% at V
        warheadUpgrades: 0.02 * 5,      // Warhead Upgrades 10% at V
        drones: 0.05 * 5,              // Drones skill 25% at V
        combatDroneOperation: 0.05 * 5  // Combat Drone Operation 25% at V
      },
      ship: {
        // Ship hull bonuses (applied once per ship)
        caldariCruiserMissile: 0,       // Will be calculated if applicable
        t3HullDamage: 0,                // T3 Strategic Cruiser hull bonus
        t3SubsystemROF: 0,              // T3 subsystem ROF bonus
        t3SubsystemDamage: 0            // T3 subsystem damage bonus
      },
      modules: {
        // Module bonuses (calculated once, applied with stacking penalties)
        bcsCount: 0,                    // Number of BCS modules
        bcsBonusPerModule: 0.10         // 10% bonus per BCS module
      }
    };
  }

  async _initializeAttributes() {
    // Initialize ship attributes
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
    if (shipInfo) {
      this.shipAttributes = new ModifiedAttributeStore(shipInfo.attributes);
    }

    // Initialize module attributes with unique keys for each module instance
    let moduleInstanceCounter = 0;
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo) {
          const moduleKey = `${module.name}_${moduleInstanceCounter++}`;
          module.uniqueKey = moduleKey; // Store the unique key on the module for later reference
          this.moduleAttributes.set(moduleKey, new ModifiedAttributeStore(moduleInfo.attributes));
        }
      }
    }

    // Initialize charge attributes
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        if (module.charge) {
          // Clean up the charge name before searching
          const baseChargeName = module.charge.replace(/\s+x\d+$/, '');
          const cleanedChargeName = baseChargeName.split(',')[0].trim();

          const chargeInfo = await this.staticData.searchItemByName(cleanedChargeName);
          if (chargeInfo) {
            const initialChargeAttributes = new Map();
            // Explicitly set base damage attributes, ensuring they are not 0 if they have a value
            initialChargeAttributes.set(114, chargeInfo.attributes.find(attr => attr.attributeID === 114)?.value || 0); // EM
            initialChargeAttributes.set(116, chargeInfo.attributes.find(attr => attr.attributeID === 116)?.value || 0); // Explosive
            initialChargeAttributes.set(117, chargeInfo.attributes.find(attr => attr.attributeID === 117)?.value || 0); // Kinetic
            initialChargeAttributes.set(118, chargeInfo.attributes.find(attr => attr.attributeID === 118)?.value || 0); // Thermal
            
            // Copy all other attributes as well
            for (const attr of chargeInfo.attributes) {
              if (!initialChargeAttributes.has(attr.attributeID)) {
                initialChargeAttributes.set(attr.attributeID, attr.value);
              }
            }

            this.chargeAttributes.set(cleanedChargeName, new ModifiedAttributeStore(Array.from(initialChargeAttributes.entries()).map(([attributeID, value]) => ({ attributeID, value }))));
          }
        }
      }
    }

    // Initialize drone attributes
    for (const drone of this.fit.drones) {
      let droneName = drone.name;
      const quantityMatch = droneName.match(/^(.+?)\s+x(\d+)$/);
      if (quantityMatch) {
        droneName = quantityMatch[1].trim();
      }
      const droneInfo = await this.staticData.searchItemByName(droneName);
      if (droneInfo) {
        this.droneAttributes.set(droneName, new ModifiedAttributeStore(droneInfo.attributes));
      } else {
        console.warn(`Could not find droneInfo for ${droneName}`);
      }
    }

    // Initialize cargo attributes (for ammo lookup)
    for (const cargoItem of this.fit.cargo) {
      const cargoInfo = await this.staticData.searchItemByName(cargoItem.name);
      if (cargoInfo) {
        this.moduleAttributes.set(cargoItem.name, new ModifiedAttributeStore(cargoInfo.attributes)); // Treat cargo as modules for attribute storage
      }
    }
  }

  async getModifiedAttribute(itemName, attributeID) {
    let store = null;
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    if (itemName === shipInfo.name) {
      store = this.shipAttributes;
    } else if (this.moduleAttributes.has(itemName)) {
      store = this.moduleAttributes.get(itemName);
    } else if (this.droneAttributes.has(itemName)) {
      store = this.droneAttributes.get(itemName);
    } else if (this.chargeAttributes.has(itemName)) {
      store = this.chargeAttributes.get(itemName);
    } else {
      // Try to find by unique key if not found by name
      for (const [key, value] of this.moduleAttributes.entries()) {
        if (key.startsWith(itemName + '_')) {
          store = value;
          break;
        }
      }
    }

    if (!store) {
      return null;
    }

    const value = store.get(attributeID);
    return value;
  }

  async boostAttribute(itemName, attributeID, bonusValue, stackingGroup = null) {
    let store = null;
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    if (itemName === shipInfo.name) {
      store = this.shipAttributes;
    } else if (this.moduleAttributes.has(itemName)) {
      store = this.moduleAttributes.get(itemName);
    } else if (this.droneAttributes.has(itemName)) {
      store = this.droneAttributes.get(itemName);
    } else if (this.chargeAttributes.has(itemName)) {
      store = this.chargeAttributes.get(itemName);
    } else {
      // Try to find by unique key if not found by name
      for (const [key, value] of this.moduleAttributes.entries()) {
        if (key.startsWith(itemName.split('_')[0] + '_') || key === itemName) {
          store = value;
          break;
        }
      }
    }

    if (!store) {
      return;
    }

    // Define resistance attribute IDs
    const resistanceAttributes = new Set([
      271, // shieldEmDamageResonance
      987, // shieldThermalDamageResonance
      273, // shieldKineticDamageResonance
      272, // shieldExplosiveDamageResonance
      267, // armorEmDamageResonance
      268, // armorThermalDamageResonance
      269, // armorKineticDamageResonance
      270, // armorExplosiveDamageResonance
      109, // hullEmDamageResonance
      110, // hullThermalDamageResonance
      111, // hullKineticDamageResonance
      113  // hullExplosiveDamageResonance
    ]);

    if (resistanceAttributes.has(attributeID)) {
      // For resistances, bonusValue is a percentage (e.g., 0.05 for 5% bonus)
      // We apply this as an additive modifier to the resistance value
      store.increase(attributeID, bonusValue, 'pre');
    } else {
      // For other attributes, bonusValue is a percentage increase (e.g., 0.05 for 5% increase)
      // Use the boost method which handles the conversion properly
      store.boost(attributeID, bonusValue, stackingGroup);
    }
  }
  
  async modifyAttributeAbsolute(itemName, attributeID, newValue) {
    let store = null;
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    if (itemName === shipInfo.name) {
      store = this.shipAttributes;
    } else if (this.moduleAttributes.has(itemName)) {
      store = this.moduleAttributes.get(itemName);
    } else if (this.droneAttributes.has(itemName)) {
      store = this.droneAttributes.get(itemName);
    } else if (this.chargeAttributes.has(itemName)) {
      store = this.chargeAttributes.get(itemName);
    }

    if (!store) {
      return;
    }

    store.preAssign(attributeID, newValue);
  }

  getSkillLevel() {
    // For now, assume all relevant skills are at level 5
    return 5;
  }

  async applyEffects() {
    await this._initializeAttributes();
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    // Phase 1: Calculate fit-wide bonuses (PyFA approach)
    await this._calculateFitBonuses(shipInfo);
    
    // Phase 2: Apply module effects (signature radius, shield bonuses, etc.)
    await this._applyModuleBonuses();
    
    // Phase 3: Apply calculated fit-wide bonuses to individual items
    await this._applyFitBonusesToItems(shipInfo);
  }

  // Phase 1: Calculate all fit-wide bonuses once (PyFA approach)
  async _calculateFitBonuses(shipInfo) {
    // Calculate ship hull bonuses
    await this._calculateShipHullBonuses(shipInfo);
    
    // Calculate T3 Strategic Cruiser bonuses
    if (this.isT3StrategicCruiser(shipInfo.name)) {
      await this._calculateT3Bonuses(shipInfo);
    }
    
    // Calculate module bonuses (BCS count, etc.)
    await this._calculateModuleBonuses();
  }
  
  async _calculateShipHullBonuses(shipInfo) {
    if (!shipInfo) return;
    
    const shipSkillLevel = 5; // Assume all ship skills at V
    
    // Caldari Cruiser skill bonus (5% missile damage per level)
    if (this.isCaldariShip(shipInfo.name.toLowerCase()) && this.isCruiser(shipInfo.name.toLowerCase())) {
      this.fitBonuses.ship.caldariCruiserMissile = 0.05 * shipSkillLevel; // 25% at V
    }
  }
  
  async _calculateT3Bonuses(shipInfo) {
    const strategicCruiserSkillLevel = 5;
    
    // Calculate T3 hull bonuses based on ship type
    if (shipInfo.name.toLowerCase().includes('loki')) {
      // Loki: 5% missile and projectile weapon damage per level
      this.fitBonuses.ship.t3HullDamage = 0.05 * strategicCruiserSkillLevel; // 25% at V
    } else if (shipInfo.name.toLowerCase().includes('tengu')) {
      // Tengu: 5% missile weapon damage per level
      this.fitBonuses.ship.t3HullDamage = 0.05 * strategicCruiserSkillLevel; // 25% at V
    } else if (shipInfo.name.toLowerCase().includes('proteus')) {
      // Proteus: 5% hybrid turret damage per level
      this.fitBonuses.ship.t3HullDamage = 0.05 * strategicCruiserSkillLevel; // 25% at V
    } else if (shipInfo.name.toLowerCase().includes('legion')) {
      // Legion: 5% energy turret damage per level
      this.fitBonuses.ship.t3HullDamage = 0.05 * strategicCruiserSkillLevel; // 25% at V
    }
    
    // Calculate T3 subsystem bonuses
    await this._calculateT3SubsystemBonuses();
  }
  
  async _calculateT3SubsystemBonuses() {
    const subsystemSkillLevel = 5;
    
    for (const module of this.fit.modules.subsystem) {
      if (module.name.includes('Launcher Efficiency Configuration')) {
        // Loki Offensive subsystem: 10% ROF bonus, 5% damage bonus per level
        this.fitBonuses.ship.t3SubsystemROF = 0.10 * subsystemSkillLevel; // 50% at V
        this.fitBonuses.ship.t3SubsystemDamage = 0.05 * subsystemSkillLevel; // 25% at V
      }
      // Add other T3 subsystem bonuses here as needed
    }
  }
  
  async _calculateModuleBonuses() {
    const ballisticControlSystemGroupId = 367;
    let bcsCount = 0;
    
    // Count BCS modules across all slots
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && moduleInfo.group_id === ballisticControlSystemGroupId) {
          bcsCount++;
        }
      }
    }
    
    this.fitBonuses.modules.bcsCount = bcsCount;
  }

  // Phase 3: Apply calculated fit-wide bonuses to individual items (PyFA approach)
  async _applyFitBonusesToItems(shipInfo) {
    // Apply pre-calculated bonuses to weapons (NO LOOPS - PyFA style)
    await this._applyPreCalculatedBonuses();
    
    // Apply drone bonuses
    await this._applyDroneBonuses();
    
    // Apply shield management skill
    const shieldManagementLevel = this.getSkillLevel();
    this.boostAttribute(shipInfo.name, 263, 0.05 * shieldManagementLevel);
    
    // Apply ship-specific signature radius bonuses
    await this._applyShipSignatureRadiusBonuses(shipInfo);
  }
  
  async _applyPreCalculatedBonuses() {
    // Apply pre-calculated bonuses to each weapon type ONCE (PyFA style)
    // This replaces the old per-weapon bonus application with single global application
    
    const weaponsToApplyBonuses = [];
    
    // Collect all weapons that need bonuses applied
    for (const slotType of ['high', 'med', 'low']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (!moduleInfo) continue;
        
        if (this.isMissileWeapon(moduleInfo) || this.isGunneryWeapon(moduleInfo)) {
          weaponsToApplyBonuses.push({ module, moduleInfo });
        }
      }
    }
    
    // Apply bonuses to each weapon ONCE (not in loops)
    for (const { module, moduleInfo } of weaponsToApplyBonuses) {
      await this._applySingleWeaponBonuses(module, moduleInfo);
    }
  }
  
  async _applySingleWeaponBonuses(module, moduleInfo) {
    // Apply all relevant bonuses to a single weapon ONCE (PyFA approach)
    
    const moduleKey = module.uniqueKey || module.name;
    
    // Character skill bonuses
    if (this.isGunneryWeapon(moduleInfo)) {
      this.boostAttribute(moduleKey, 51, -this.fitBonuses.character.gunneryROF);
      this.boostAttribute(moduleKey, 64, this.fitBonuses.character.gunnerySpecialization);
    }
    
    if (this.isMissileWeapon(moduleInfo)) {
      // ROF bonus from Missile Launcher Operation
      this.boostAttribute(moduleKey, 51, -this.fitBonuses.character.missileROF);
      
      // Damage bonuses from missile skills (apply ONCE per weapon)
      this.moduleAttributes.get(moduleKey).applyModifier(64, 1 + this.fitBonuses.character.missileSpecialization, 'multiply', 'missileSpecialization');
      this.moduleAttributes.get(moduleKey).applyModifier(64, 1 + this.fitBonuses.character.warheadUpgrades, 'multiply', 'warheadUpgrades');
      
      // Ship hull bonuses (apply ONCE per weapon)
      if (this.fitBonuses.ship.caldariCruiserMissile > 0) {
        this.moduleAttributes.get(moduleKey).applyModifier(64, 1 + this.fitBonuses.ship.caldariCruiserMissile, 'multiply', 'shipSkill');
      }
      
      // T3 subsystem bonuses (apply ONCE per weapon)
      if (this.fitBonuses.ship.t3SubsystemROF > 0) {
        this.moduleAttributes.get(moduleKey).applyModifier(51, 1 - this.fitBonuses.ship.t3SubsystemROF, 'multiply', 't3SubsystemROF');
      }
      if (this.fitBonuses.ship.t3SubsystemDamage > 0) {
        this.moduleAttributes.get(moduleKey).applyModifier(64, 1 + this.fitBonuses.ship.t3SubsystemDamage, 'multiply', 't3SubsystemDamage');
      }
      
      // BCS module bonuses (apply ONCE per weapon, but with proper stacking for multiple BCS)
      if (this.fitBonuses.modules.bcsCount > 0) {
        for (let i = 0; i < this.fitBonuses.modules.bcsCount; i++) {
          this.moduleAttributes.get(moduleKey).applyModifier(
            64, 
            1 + this.fitBonuses.modules.bcsBonusPerModule, 
            'multiply', 
            'bcs'
          );
        }
      }
    }
    
    // Apply T3 hull bonuses based on weapon type compatibility
    if (this.fitBonuses.ship.t3HullDamage > 0) {
      const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
      let applyT3HullBonus = false;
      
      if (shipInfo.name.toLowerCase().includes('loki')) {
        applyT3HullBonus = this.isMissileWeapon(moduleInfo) || this.isProjectileWeapon(moduleInfo);
      } else if (shipInfo.name.toLowerCase().includes('tengu')) {
        applyT3HullBonus = this.isMissileWeapon(moduleInfo);
      } else if (shipInfo.name.toLowerCase().includes('proteus')) {
        applyT3HullBonus = this.isHybridWeapon(moduleInfo);
      } else if (shipInfo.name.toLowerCase().includes('legion')) {
        applyT3HullBonus = this.isEnergyWeapon(moduleInfo);
      }
      
      if (applyT3HullBonus) {
        this.moduleAttributes.get(moduleKey).applyModifier(64, 1 + this.fitBonuses.ship.t3HullDamage, 'multiply', 't3HullBonus');
      }
    }
  }


  // BCS bonus application moved to _applySingleWeaponBonuses to avoid per-weapon loops
  
  async _applyDroneBonuses() {
    // Apply drone skill bonuses to all drones
    for (const drone of this.fit.drones) {
      let droneName = drone.name;
      const quantityMatch = droneName.match(/^(.+?)\s+x(\d+)$/);
      if (quantityMatch) {
        droneName = quantityMatch[1].trim();
        drone.quantity = parseInt(quantityMatch[2]);
      }

      const droneInfo = await this.staticData.searchItemByName(droneName);
      if (!droneInfo) continue;

      // Apply pre-calculated drone skill bonuses
      this.boostAttribute(droneName, 64, this.fitBonuses.character.drones);
      this.boostAttribute(droneName, 64, this.fitBonuses.character.combatDroneOperation);
    }
  }

  // Removed old redundant methods - functionality moved to _calculateFitBonuses and _applyFitBonusesToItems

  async _applyModuleBonuses() {
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
    
    // Apply module effects to ship attributes
    await this.applyModuleEffects();
    
    // Apply ship role bonuses
    if (shipInfo) {
      await this.applyShipRoleBonuses(shipInfo);
    }
  }

  // Removed placeholder methods - functionality integrated into _calculateT3Bonuses
  
  async applyShipRoleBonuses(shipInfo) {
    // Apply role bonuses based on ship attributes
    // Role bonus for Command/Black Ops cruisers (scan resolution)
    const roleBonusCBC = shipInfo.attributes.find(attr => attr.attributeID === 2043);
    if (roleBonusCBC && roleBonusCBC.value > 0) {
      // Apply scan resolution bonus (percentage bonus)
      const bonusPercent = roleBonusCBC.value / 100; // Convert to decimal
      this.boostAttribute(shipInfo.name, 564, bonusPercent, 'scanResolution'); // 564 = scan resolution
    }
  }
  
  async applyModuleEffects() {
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
    if (!shipInfo) return;

    // Apply module effects to ship attributes
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (!moduleInfo) continue;
        
        // Check for scan resolution modifiers
        const scanResModifier = moduleInfo.attributes.find(attr => attr.attributeID === 564);
        if (scanResModifier && scanResModifier.value !== 0) {
          // Apply absolute modifier to ship scan resolution
          this.boostAttribute(shipInfo.name, 564, scanResModifier.value / 100); // 564 = scan resolution
        }
        
        // Check for signature radius modifiers
        // NOTE: Attribute 552 on modules/subsystems should NOT be processed here
        // as it's handled separately in subsystem processing
        // Regular modules don't have attribute 552 - this is only on subsystems
        // and should be processed as flat additions, not percentage bonuses
        
        // Attr 554: signatureRadiusBonus (percentage bonus, like MWD +500%)
        const sigRadiusBonusAttr = moduleInfo.attributes.find(attr => attr.attributeID === 554);
        if (sigRadiusBonusAttr && sigRadiusBonusAttr.value !== 0) {
          // Values like 500 mean +500% when module is active
          // TODO: For now we skip MWD signature penalties since we don't model active/inactive states
          // MWDs should only apply their signature radius penalty when actively running
          const isMWD = moduleInfo.name && (
            moduleInfo.name.toLowerCase().includes('microwarpdrive') || 
            moduleInfo.name.toLowerCase().includes('mwd')
          );
          if (!isMWD) {
            const percentBonus = sigRadiusBonusAttr.value / 100;
            this.boostAttribute(shipInfo.name, 552, percentBonus, 'signatureRadiusBonus');
          }
        }
        
        // Attr 983: signatureRadiusAdd (flat addition, like shield extenders +20m)
        const sigRadiusAddAttr = moduleInfo.attributes.find(attr => attr.attributeID === 983);
        if (sigRadiusAddAttr && sigRadiusAddAttr.value !== 0) {
          // This is a flat addition in meters, applied as post-increase
          this.shipAttributes.increase(552, sigRadiusAddAttr.value, 'post');
        }
        
        // Rig drawback penalties (attribute 1138: drawback)
        // Rig drawbacks affect signature radius with a penalty (typically 10% per rig)
        const rigDrawbackAttr = moduleInfo.attributes.find(attr => attr.attributeID === 1138);
        if (rigDrawbackAttr && rigDrawbackAttr.value !== 0) {
          // Rig drawbacks are penalties to signature radius
          // Value of 10 means 10% penalty = 1.10 multiplier to signature radius
          const drawbackPenalty = rigDrawbackAttr.value / 100;
          this.boostAttribute(shipInfo.name, 552, drawbackPenalty, 'rigDrawback');
        }
        
        // Shield HP bonus from rigs (attribute 337: shieldCapacityBonus)
        const shieldBonusAttr = moduleInfo.attributes.find(attr => attr.attributeID === 337);
        if (shieldBonusAttr) {
          let shieldBonus = shieldBonusAttr.value / 100;
          const shieldRiggingSkillLevel = this.getSkillLevel(); // Assume level 5
          const shieldRiggingBonus = 0.10 * shieldRiggingSkillLevel;
          shieldBonus *= (1 + shieldRiggingBonus);
          this.boostAttribute(shipInfo.name, 263, shieldBonus, 'shieldCapacity'); // 263 = shieldCapacity
        }

        // Shield resistance bonuses from modules (e.g., Shield Hardener)
        // Attribute IDs for resistance bonuses: 984 (EM), 985 (Thermal), 986 (Kinetic), 987 (Explosive)
        // const shieldResistances = {
        //   271: 0, // EM
        //   987: 0, // Thermal
        //   273: 0, // Kinetic
        //   272: 0  // Explosive
        // };

        const shieldEMResBonus = moduleInfo.attributes.find(attr => attr.attributeID === 984 || attr.attributeID === 1092);
        if (shieldEMResBonus) this.boostAttribute(shipInfo.name, 271, Math.abs(shieldEMResBonus.value) / 100, 'shieldResistance');
        const shieldThermalResBonus = moduleInfo.attributes.find(attr => attr.attributeID === 985 || attr.attributeID === 1093);
        if (shieldThermalResBonus) this.boostAttribute(shipInfo.name, 987, Math.abs(shieldThermalResBonus.value) / 100, 'shieldResistance');
        const shieldKineticResBonus = moduleInfo.attributes.find(attr => attr.attributeID === 986 || attr.attributeID === 1094);
        if (shieldKineticResBonus) this.boostAttribute(shipInfo.name, 273, Math.abs(shieldKineticResBonus.value) / 100, 'shieldResistance');
        const shieldExplosiveResBonus = moduleInfo.attributes.find(attr => attr.attributeID === 987 || attr.attributeID === 1095);
        if (shieldExplosiveResBonus) this.boostAttribute(shipInfo.name, 272, Math.abs(shieldExplosiveResBonus.value) / 100, 'shieldResistance');

        // Add more module effects as needed (capacitor bonuses, speed bonuses, etc.)
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
  
  isT3StrategicCruiser(shipName) {
    const t3Ships = ['loki', 'tengu', 'proteus', 'legion'];
    return t3Ships.some(ship => shipName.toLowerCase().includes(ship));
  }
  
  isProjectileWeapon(moduleInfo) {
    const projectileGroupIds = [55, 56]; // Projectile turret group IDs (AutoCannon, Artillery)
    return projectileGroupIds.includes(moduleInfo.group_id);
  }
  
  isHybridWeapon(moduleInfo) {
    const hybridGroupIds = [74, 258]; // Hybrid turret group IDs (Blaster, Railgun)
    return hybridGroupIds.includes(moduleInfo.group_id);
  }
  
  isEnergyWeapon(moduleInfo) {
    const energyGroupIds = [60, 1496]; // Energy turret group IDs (Pulse Laser, Beam Laser)
    return energyGroupIds.includes(moduleInfo.group_id);
  }

  // Apply ship-specific signature radius bonuses matching PyFA's implementation
  async _applyShipSignatureRadiusBonuses(shipInfo) {
    const shipName = shipInfo.name.toLowerCase();
    
    // Electronic Attack Ship bonuses (examples: Griffin Navy Issue, Maulus Navy Issue)
    if (shipName.includes('griffin navy') || shipName.includes('maulus navy') || 
        shipName.includes('crucifier navy') || shipName.includes('vigil fleet')) {
      // Elite Bonus Electronic Attack Ship skill (5% signature radius reduction per level)
      const easSkillLevel = this.getSkillLevel('Electronic Attack Ships');
      this.boostAttribute(shipInfo.name, 552, -0.05 * easSkillLevel, 'shipBonus');
    }
    
    // Interceptor bonuses (examples: Stiletto, Ares, Malediction, Crow)
    if (shipName.includes('stiletto') || shipName.includes('ares') || 
        shipName.includes('malediction') || shipName.includes('crow') ||
        shipName.includes('claw') || shipName.includes('taranis')) {
      // Interceptors often have bonuses to propulsion module signature penalty reduction
      // This bonus applies to propulsion modules, will be handled in module processing
    }
    
    // Interdictor bonuses (examples: Sabre, Flycatcher, Eris, Heretic)
    if (shipName.includes('sabre') || shipName.includes('flycatcher') || 
        shipName.includes('eris') || shipName.includes('heretic')) {
      // Similar to interceptors, affects propulsion modules
    }
    
    // Expedition Frigate bonuses (examples: Astero, Stratios, Nestor)
    if (shipName.includes('astero') || shipName.includes('stratios') || shipName.includes('nestor')) {
      // These ships have specialized signature radius bonuses
      // Usually handled through ship effects in static data
    }
    
    // Logistics Frigate bonuses (examples: Kirin, Thalia, Deacon, Scalpel) 
    if (shipName.includes('kirin') || shipName.includes('thalia') || 
        shipName.includes('deacon') || shipName.includes('scalpel')) {
      // Often have signature radius bonuses
    }
    
    // Minmatar ship bonuses (many Minmatar ships have signature radius bonuses to propulsion modules)
    if (this.staticData.isMinmatarShip(shipName)) {
      // Check specific Minmatar ship types
      if (shipName.includes('loki')) {
        // T3 Strategic Cruiser bonuses handled separately in T3 bonus method
        return;
      }
      
      // Many Minmatar ships have propulsion module signature radius bonuses
      // These will be applied during module processing
    }
    
    // Navy Destroyer bonuses
    if (shipName.includes('coercer navy') || shipName.includes('catalyst navy') ||
        shipName.includes('cormorant navy') || shipName.includes('thrasher fleet')) {
      // Navy destroyers often have specialized bonuses
    }
  }

  // Apply Navigation skill bonuses affecting signature radius
  async _applyNavigationSkillBonuses() {
    // High Speed Maneuvering skill affects MWD signature radius penalty
    // Evasive Maneuvering skill affects ship agility (indirectly affects some signature calculations)
    
    // These bonuses are typically applied to specific modules during module processing
    // rather than to the ship's base signature radius
  }
}

module.exports = { FitSimulator };