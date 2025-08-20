const { ModifiedAttributeStore } = require('./modified-attribute-store');

class FitSimulator {
  constructor(fit, staticData) {
    this.fit = fit;
    this.staticData = staticData;
    this.shipAttributes = null; // Will be an instance of ModifiedAttributeStore
    this.moduleAttributes = new Map(); // Map<moduleName, ModifiedAttributeStore>
    this.droneAttributes = new Map(); // Map<droneName, ModifiedAttributeStore>
    this.chargeAttributes = new Map(); // Map<chargeName, ModifiedAttributeStore>
  }

  async _initializeAttributes() {
    // Initialize ship attributes
    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
    if (shipInfo) {
      this.shipAttributes = new ModifiedAttributeStore(shipInfo.attributes);
    }

    // Initialize module attributes
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo) {
          this.moduleAttributes.set(module.name, new ModifiedAttributeStore(moduleInfo.attributes));
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
    await this._initializeAttributes(); // Attributes are initialized here

    const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);

    // Apply ship-specific signature radius bonuses first
    await this._applyShipSignatureRadiusBonuses(shipInfo);

    // Shield Management skill (5% per level)
    const shieldManagementLevel = this.getSkillLevel();
    this.boostAttribute(shipInfo.name, 263, 0.05 * shieldManagementLevel); // 263 = shieldCapacity

    // Shield Upgrades skill (5% per level to shield capacity from modules)
    // const shieldUpgradesLevel = this.getSkillLevel();
    // This skill affects modules, so it will be applied when processing modules

    // Shield Rigging skill (10% per level to shield capacity from rigs)
    // const shieldRiggingLevel = this.getSkillLevel();
    // This skill affects rigs, so it will be applied when processing modules

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
      this.boostAttribute(droneName, 64, 0.05 * dronesSkillLevel); // 64 = damageMultiplier
      // Combat Drone Operation skill (damage bonus) - 5% per level  
      this.boostAttribute(droneName, 64, 0.05 * combatDroneOperationSkillLevel); // 64 = damageMultiplier
    }

    // Apply weapon skill bonuses to all weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (!moduleInfo) continue;
        
        // Apply gunnery skill bonuses (2% RoF per level)
        if (this.isGunneryWeapon(moduleInfo)) {
          const rofBonus = 0.02 * gunnerySkillLevel; // 10% at level V
          this.boostAttribute(module.name, 51, -rofBonus); // 51 = speed/cycle time
          
          // Apply specialization skills (2% damage per level)
          const damageBonus = 0.02 * 5; // Assume specialization at V
          this.boostAttribute(module.name, 64, damageBonus); // 64 = damageMultiplier
        }
        
        // Apply missile skill bonuses
        if (this.isMissileWeapon(moduleInfo)) {
          const rofBonus = 0.02 * missileLauncherOperationSkillLevel; // 10% at level V
          this.boostAttribute(module.name, 51, -rofBonus); // 51 = speed/cycle time
          
          // Apply specialization skills (2% damage per level)
          const damageBonus = 0.02 * 5; // Assume specialization at V
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + damageBonus, 'multiply', 'missileSpecialization');
          
          // Apply Warhead Upgrades (2% missile damage per level)
          const warheadUpgradesBonus = 0.02 * 5; // 10% at level V
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + warheadUpgradesBonus, 'multiply', 'warheadUpgrades');
        }
      }
    }

    // Apply Ballistic Control System bonuses (10% per module to missile damage and rate of fire)
    const ballisticControlSystemGroupId = 367; // Group ID for Ballistic Control Systems
    const bcsBonusPerModule = 0.10; // 10% bonus per module

    // First, count all BCS modules across all slots
    let totalBcsModules = 0;
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && moduleInfo.group_id === ballisticControlSystemGroupId) {
          totalBcsModules++;
        }
      }
    }

    // Apply cumulative BCS bonuses to all missile weapons (with stacking penalties)
    if (totalBcsModules > 0) {
      for (const targetSlotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
        for (const targetModule of this.fit.modules[targetSlotType]) {
          const targetModuleInfo = await this.staticData.searchItemByName(targetModule.name);
          if (targetModuleInfo && this.isMissileWeapon(targetModuleInfo)) {
            // Apply BCS bonuses with stacking penalties - each BCS module is a separate modifier with the same stacking group
            for (let i = 0; i < totalBcsModules; i++) {
              this.moduleAttributes.get(targetModule.name).applyModifier(64, 1 + bcsBonusPerModule, 'multiply', 'bcs');
            }
          }
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
              this.moduleAttributes.get(module.name).applyModifier(64, 1 + caldariCruiserBonus, 'multiply', 'shipSkill');
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
              this.moduleAttributes.get(module.name).applyModifier(64, 1 + racialDamageBonus, 'multiply', 'racialBonus');
            }
          }
        }
      }
    }
    
    // Apply module effects to ship attributes
    await this.applyModuleEffects();
    
    // Apply ship role bonuses
    if (shipInfo) {
      await this.applyShipRoleBonuses(shipInfo);
    }
  }
  
  async applyShipRoleBonuses(shipInfo) {
    // Apply role bonuses based on ship attributes
    // Role bonus for Command/Black Ops cruisers (scan resolution)
    const roleBonusCBC = shipInfo.attributes.find(attr => attr.attributeID === 2043);
    if (roleBonusCBC && roleBonusCBC.value > 0) {
      // Apply scan resolution bonus (percentage bonus)
      const bonusPercent = roleBonusCBC.value / 100; // Convert to decimal
      this.boostAttribute(shipInfo.name, 564, bonusPercent, 'scanResolution'); // 564 = scan resolution
    }
    
    // Apply T3 Strategic Cruiser bonuses
    await this.applyT3StrategicCruiserBonuses(shipInfo);
  }

  async applyT3StrategicCruiserBonuses(shipInfo) {
    // Check if this is a T3 Strategic Cruiser
    if (!this.isT3StrategicCruiser(shipInfo.name)) {
      return;
    }

    const strategicCruiserSkillLevel = 5; // Assume Strategic Cruiser Operation at V
    const subsystemSkillLevel = 5; // Assume all subsystem skills at V

    // Apply T3 hull bonuses based on ship type
    if (shipInfo.name.toLowerCase().includes('loki')) {
      await this.applyLokiBonuses(strategicCruiserSkillLevel, subsystemSkillLevel);
    } else if (shipInfo.name.toLowerCase().includes('tengu')) {
      await this.applyTenguBonuses(strategicCruiserSkillLevel, subsystemSkillLevel);
    } else if (shipInfo.name.toLowerCase().includes('proteus')) {
      await this.applyProteusBonuses(strategicCruiserSkillLevel, subsystemSkillLevel);
    } else if (shipInfo.name.toLowerCase().includes('legion')) {
      await this.applyLegionBonuses(strategicCruiserSkillLevel, subsystemSkillLevel);
    }
  }

  async applyLokiBonuses(strategicCruiserSkillLevel, _subsystemSkillLevel) {
    // Loki hull bonuses (per level of Strategic Cruiser Operation):
    // - 5% bonus to missile and projectile weapon damage per level
    const hullDamageBonus = 0.05 * strategicCruiserSkillLevel; // 25% at level V

    // Apply hull bonus to all missile and projectile weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && (this.isMissileWeapon(moduleInfo) || this.isProjectileWeapon(moduleInfo))) {
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + hullDamageBonus, 'multiply', 't3HullBonus');
        }
      }
    }

    // Apply subsystem bonuses based on fitted subsystems
    await this.applyLokiSubsystemBonuses(5); // All-V skills assumption
  }

  async applyLokiSubsystemBonuses(subsystemSkillLevel) {
    // Check for Loki Offensive subsystems that affect weapons
    for (const module of this.fit.modules.subsystem) {
      const subsystemInfo = await this.staticData.searchItemByName(module.name);
      if (!subsystemInfo) continue;

      // Launcher Efficiency Configuration bonuses
      if (module.name.includes('Launcher Efficiency Configuration')) {
        // Per level of Caldari Defensive Systems skill:
        // - 10% bonus to missile launcher rate of fire
        const rofBonus = 0.10 * subsystemSkillLevel; // 50% at level V
        
        // Per level of Minmatar Offensive Systems skill:
        // - 5% bonus to missile launcher damage
        const damageBonus = 0.05 * subsystemSkillLevel; // 25% at level V

        // Apply to all missile launchers
        for (const slotType of ['high', 'med', 'low']) {
          for (const weaponModule of this.fit.modules[slotType]) {
            const weaponInfo = await this.staticData.searchItemByName(weaponModule.name);
            if (weaponInfo && this.isMissileWeapon(weaponInfo)) {
              // Apply rate of fire bonus (negative because lower cycle time = faster)
              this.moduleAttributes.get(weaponModule.name).applyModifier(51, 1 - rofBonus, 'multiply', 't3SubsystemROF');
              // Apply damage bonus
              this.moduleAttributes.get(weaponModule.name).applyModifier(64, 1 + damageBonus, 'multiply', 't3SubsystemDamage');
            }
          }
        }
      }

      // Apply subsystem signature radius bonuses (attribute 552)
      // Subsystem signature radius values are flat additive bonuses in meters
      const subsystemSigRadiusAttr = subsystemInfo.attributes.find(attr => attr.attributeID === 552);
      if (subsystemSigRadiusAttr && subsystemSigRadiusAttr.value !== 0) {
        const sigRadiusAddition = subsystemSigRadiusAttr.value; // Flat addition in meters
        this.shipAttributes.increase(552, sigRadiusAddition, 'pre');
      }

      // Covert Reconfiguration bonuses (if fitted)
      if (module.name.includes('Covert Reconfiguration')) {
        // Per level of Gallente Defensive Systems skill:
        // - 4% bonus to shield resistances
        const shieldResistanceBonus = 0.04 * subsystemSkillLevel; // 20% at level V
        
        const shipInfo = await this.staticData.searchItemByName(this.fit.shipType);
        if (shipInfo) {
          // Apply to all shield resistances (using new API)
          this.shipAttributes.increase(271, shieldResistanceBonus, 'pre'); // EM
          this.shipAttributes.increase(272, shieldResistanceBonus, 'pre'); // Explosive  
          this.shipAttributes.increase(273, shieldResistanceBonus, 'pre'); // Kinetic
          this.shipAttributes.increase(274, shieldResistanceBonus, 'pre'); // Thermal
        }
      }
    }
  }

  async applyTenguBonuses(strategicCruiserSkillLevel, _subsystemSkillLevel) {
    // Tengu hull bonuses (per level of Strategic Cruiser Operation):
    // - 5% bonus to missile damage per level
    const hullDamageBonus = 0.05 * strategicCruiserSkillLevel; // 25% at level V

    // Apply hull bonus to all missile weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && this.isMissileWeapon(moduleInfo)) {
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + hullDamageBonus, 'multiply', 't3HullBonus');
        }
      }
    }
  }

  async applyProteusBonuses(strategicCruiserSkillLevel, _subsystemSkillLevel) {
    // Proteus hull bonuses (per level of Strategic Cruiser Operation):
    // - 5% bonus to hybrid turret damage per level
    const hullDamageBonus = 0.05 * strategicCruiserSkillLevel; // 25% at level V

    // Apply hull bonus to all hybrid weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && this.isHybridWeapon(moduleInfo)) {
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + hullDamageBonus, 'multiply', 't3HullBonus');
        }
      }
    }
  }

  async applyLegionBonuses(strategicCruiserSkillLevel, _subsystemSkillLevel) {
    // Legion hull bonuses (per level of Strategic Cruiser Operation):
    // - 5% bonus to energy turret damage per level
    const hullDamageBonus = 0.05 * strategicCruiserSkillLevel; // 25% at level V

    // Apply hull bonus to all energy weapons
    for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
      for (const module of this.fit.modules[slotType]) {
        const moduleInfo = await this.staticData.searchItemByName(module.name);
        if (moduleInfo && this.isEnergyWeapon(moduleInfo)) {
          this.moduleAttributes.get(module.name).applyModifier(64, 1 + hullDamageBonus, 'multiply', 't3HullBonus');
        }
      }
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