/**
 * Tank calculation helper functions for eve-fight-taker
 * Calculates active tank (HP/s) from shield boosters and armor repairers
 */

// EVE Group IDs for tank modules
const SHIELD_BOOSTER_GROUPS = [
  40,    // Shield Booster
  295,   // Shield Booster (Medium)
  298,   // Shield Booster (Large)
  1156,  // Shield Booster (X-Large)
  608,   // Ancillary Shield Booster
];

const ARMOR_REPAIRER_GROUPS = [
  62,    // Armor Repair Unit
  1161,  // Ancillary Armor Repairer
];

// EVE Attribute IDs
const ATTR_SHIELD_BONUS = 68;        // Shield HP repaired per cycle
const ATTR_ARMOR_DAMAGE_AMOUNT = 84; // Armor HP repaired per cycle  
const ATTR_DURATION = 73;            // Cycle time in ms

/**
 * Check if a module is a shield booster
 */
function isShieldBooster(moduleInfo) {
  if (!moduleInfo) return false;
  return SHIELD_BOOSTER_GROUPS.includes(moduleInfo.group_id);
}

/**
 * Check if a module is an armor repairer
 */
function isArmorRepairer(moduleInfo) {
  if (!moduleInfo) return false;
  return ARMOR_REPAIRER_GROUPS.includes(moduleInfo.group_id);
}

/**
 * Calculate tank stats from a module
 * @param {Object} module - The module object
 * @param {Object} moduleInfo - Module static data info
 * @param {Object} fitSimulator - FitSimulator instance for modified attributes
 * @returns {Object} Tank contribution { shield: HP/s, armor: HP/s }
 */
async function calculateModuleTank(module, moduleInfo, fitSimulator) {
  const tank = { shield: 0, armor: 0 };
  
  if (!moduleInfo || module.offline) return tank;
  
  if (isShieldBooster(moduleInfo)) {
    // Get shield HP per cycle (attribute 68)
    const shieldBonus = await fitSimulator.getModifiedAttribute(module.name, ATTR_SHIELD_BONUS) || 0;
    // Get cycle time in ms (attribute 73)
    const cycleTime = await fitSimulator.getModifiedAttribute(module.name, ATTR_DURATION) || 1000;
    
    if (shieldBonus > 0 && cycleTime > 0) {
      // Calculate HP/s: (HP per cycle) / (cycle time in seconds)
      tank.shield = shieldBonus / (cycleTime / 1000);
    }
  }
  
  if (isArmorRepairer(moduleInfo)) {
    // Get armor HP per cycle (attribute 84)
    const armorBonus = await fitSimulator.getModifiedAttribute(module.name, ATTR_ARMOR_DAMAGE_AMOUNT) || 0;
    // Get cycle time in ms (attribute 73)
    const cycleTime = await fitSimulator.getModifiedAttribute(module.name, ATTR_DURATION) || 1000;
    
    if (armorBonus > 0 && cycleTime > 0) {
      // Calculate HP/s: (HP per cycle) / (cycle time in seconds)
      tank.armor = armorBonus / (cycleTime / 1000);
    }
  }
  
  return tank;
}

module.exports = {
  isShieldBooster,
  isArmorRepairer,
  calculateModuleTank,
  SHIELD_BOOSTER_GROUPS,
  ARMOR_REPAIRER_GROUPS,
};
