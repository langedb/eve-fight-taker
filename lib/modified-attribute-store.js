// const { log } = require('console'); // Unused import

class ModifiedAttributeStore {
  constructor(baseAttributes) {
    this.baseAttributes = new Map(); // Stores original base values
    this.modifiedAttributes = new Map(); // Stores the final calculated values
    this.modifiers = new Map(); // Stores all applied modifiers for each attribute
    this.forcedValues = new Map(); // Stores forced attribute values (highest priority)
    this.preAssigns = new Map(); // Stores pre-assigned values (override base)

    // Initialize with base attributes
    if (baseAttributes) {
      baseAttributes.forEach(attr => {
        this.baseAttributes.set(attr.attributeID, attr.value);
        this.modifiedAttributes.set(attr.attributeID, attr.value); // Start with base value
        // console.log(`DEBUG: ModifiedAttributeStore: Setting base attribute ${attr.attributeID} to ${attr.value}`);
      });
    }
    
    // Ensure damageMultiplier (64) has a base value of 1 if not set or 0
    if (!this.baseAttributes.has(64) || this.baseAttributes.get(64) === 0) {
      this.baseAttributes.set(64, 1);
      this.modifiedAttributes.set(64, 1);
    }
  }

  // Method to apply a modifier following PyFA's methodology
  // type: 'preIncrease', 'multiply', 'postIncrease', 'preAssign', 'force'
  // stackingGroup: for stacking penalties (e.g., 'default', 'postMul', 'postDiv')
  // position: 'pre' or 'post' for additive modifiers
  applyModifier(attributeID, value, type = 'multiply', stackingGroup = null, position = 'pre') {
    if (!this.modifiers.has(attributeID)) {
      this.modifiers.set(attributeID, []);
    }
    
    // Handle forced values (highest priority, prevents further modifications)
    if (type === 'force') {
      this.forcedValues.set(attributeID, value);
      this.modifiedAttributes.set(attributeID, value);
      return;
    }
    
    // Handle pre-assignments (override base value)
    if (type === 'preAssign') {
      this.preAssigns.set(attributeID, value);
      this._recalculateAttribute(attributeID);
      return;
    }
    
    // Handle legacy 'add' type by mapping to position-based increases
    if (type === 'add') {
      type = position === 'post' ? 'postIncrease' : 'preIncrease';
    }
    
    // Handle 'set' type as an alias for 'force'
    if (type === 'set') {
      this.forcedValues.set(attributeID, value);
      this.modifiedAttributes.set(attributeID, value);
      return;
    }
    
    this.modifiers.get(attributeID).push({ value, type, stackingGroup, position });
    this._recalculateAttribute(attributeID);
  }

  // Convenience methods matching PyFA's API
  increase(attributeID, increase, position = 'pre') {
    const type = position === 'post' ? 'postIncrease' : 'preIncrease';
    this.applyModifier(attributeID, increase, type, null, position);
  }

  multiply(attributeID, multiplier, stackingPenalties = true, stackingGroup = 'default') {
    const group = stackingPenalties ? stackingGroup : null;
    this.applyModifier(attributeID, multiplier, 'multiply', group);
  }

  boost(attributeID, boostFactor, stackingGroup = 'default') {
    // Convert boost (percentage) to multiplier: boost of 0.1 = multiplier of 1.1
    const multiplier = 1 + boostFactor;
    this.multiply(attributeID, multiplier, true, stackingGroup);
  }

  force(attributeID, value) {
    this.applyModifier(attributeID, value, 'force');
  }

  preAssign(attributeID, value) {
    this.applyModifier(attributeID, value, 'preAssign');
  }

  // Recalculates a single attribute based on all its modifiers following PyFA's order of operations
  _recalculateAttribute(attributeID) {
    // console.log(`ModifiedAttributeStore: Recalculating attribute ${attributeID}`);
    // Check for forced values first (highest priority)
    if (this.forcedValues.has(attributeID)) {
      this.modifiedAttributes.set(attributeID, this.forcedValues.get(attributeID));
      return;
    }

    // Start with base value or pre-assigned value
    let currentValue = this.preAssigns.get(attributeID) || this.baseAttributes.get(attributeID) || 0;
    
    const attributeModifiers = this.modifiers.get(attributeID) || [];

    // Separate modifiers by type following PyFA's methodology
    const preIncreases = [];
    const postIncreases = [];
    const nonStackingMultipliers = [];
    const stackingModifiers = new Map(); // Map<stackingGroup, Array<modifier>>

    attributeModifiers.forEach(mod => {
      if (mod.type === 'preIncrease') {
        preIncreases.push(mod.value);
      } else if (mod.type === 'postIncrease') {
        postIncreases.push(mod.value);
      } else if (mod.type === 'multiply') {
        if (mod.stackingGroup) {
          if (!stackingModifiers.has(mod.stackingGroup)) {
            stackingModifiers.set(mod.stackingGroup, []);
          }
          stackingModifiers.get(mod.stackingGroup).push(mod.value);
        } else {
          nonStackingMultipliers.push(mod.value);
        }
      }
    });

    // PyFA's order of operations:
    // 1. Pre-increases (flat additions before multiplication)
    preIncreases.forEach(val => {
      currentValue += val;
    });

    // 2. Non-stacking multipliers
    nonStackingMultipliers.forEach(val => {
      currentValue *= val;
    });

    // 3. Stacking penalized multipliers (by stacking group)
    stackingModifiers.forEach((multipliers, group) => {
      // Sort multipliers for stacking penalty (largest bonus/penalty first)
      multipliers.sort((a, b) => {
        // For bonuses (>1), sort descending. For penalties (<1), sort ascending
        if (a >= 1 && b >= 1) {
          return b - a; // Largest bonus first
        } else if (a < 1 && b < 1) {
          return a - b; // Smallest penalty first  
        } else {
          return b - a; // Mixed: bonuses before penalties
        }
      });

      // Apply stacking penalties using PyFA's formula
      for (let i = 0; i < multipliers.length; i++) {
        const multiplier = multipliers[i];
        
        // PyFA's stacking penalty calculation
        // Penalty factor: exp(-((pos-1)/2.22292081)**2) for most groups
        // Note: Different penalty groups use different formulas
        let penaltyFactor;
        if (group === 'postDiv') {
          // Special handling for postDiv group (used by some T3D modes)
          penaltyFactor = Math.exp(-Math.pow((i) / 2.22292081, 2));
        } else {
          // Standard stacking penalty formula used by most groups
          penaltyFactor = Math.exp(-Math.pow((i) / 2.22292081, 2));
        }
        
        // Apply the penalized multiplier
        const penalizedEffect = 1 + (multiplier - 1) * penaltyFactor;
        currentValue *= penalizedEffect;
      }
    });

    // 4. Post-increases (flat additions after multiplication)
    postIncreases.forEach(val => {
      currentValue += val;
    });

    this.modifiedAttributes.set(attributeID, currentValue);
  }

  // Get the final calculated value for an attribute
  get(attributeID) {
    let value = this.modifiedAttributes.get(attributeID);
    // Special handling for damageMultiplier (attributeID 64) to default to 1 if not explicitly set or 0
    if (attributeID === 64 && (value === undefined || value === null || value === 0)) {
      return 1;
    }
    // For other attributes, return 0 if not found
    if (value === undefined || value === null) {
      return 0;
    }
    return value;
  }

  // Get the base value for an attribute
  getBase(attributeID) {
    return this.baseAttributes.get(attributeID);
  }

  // Recalculate all attributes (useful after multiple changes)
  recalculateAll() {
    this.baseAttributes.forEach((value, attributeID) => {
      this._recalculateAttribute(attributeID);
    });
  }
}

module.exports = { ModifiedAttributeStore };