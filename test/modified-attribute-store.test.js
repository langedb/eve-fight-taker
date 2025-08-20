const { expect } = require('chai');
const { ModifiedAttributeStore } = require('../lib/modified-attribute-store');

describe('ModifiedAttributeStore', () => {
  let store;

  beforeEach(() => {
    const baseAttributes = [
      { attributeID: 9, value: 1000 },    // capacitorCapacity
      { attributeID: 37, value: 260 },    // maxVelocity  
      { attributeID: 263, value: 2500 },  // shieldCapacity
      { attributeID: 109, value: 0.75 }   // shieldEmDamageResonance
    ];
    store = new ModifiedAttributeStore(baseAttributes);
  });

  describe('constructor', () => {
    it('should initialize with base attributes', () => {
      expect(store.get(9)).to.equal(1000);
      expect(store.get(37)).to.equal(260);
      expect(store.get(263)).to.equal(2500);
      expect(store.get(109)).to.equal(0.75);
    });

    it('should set damageMultiplier to 1 if not provided', () => {
      expect(store.get(64)).to.equal(1); // damageMultiplier should default to 1
    });

    it('should override damageMultiplier if it was 0', () => {
      const storeWithZeroDamage = new ModifiedAttributeStore([
        { attributeID: 64, value: 0 }
      ]);
      expect(storeWithZeroDamage.get(64)).to.equal(1);
    });

    it('should preserve non-zero damageMultiplier values', () => {
      const storeWithDamage = new ModifiedAttributeStore([
        { attributeID: 64, value: 1.5 }
      ]);
      expect(storeWithDamage.get(64)).to.equal(1.5);
    });
  });

  describe('applyModifier()', () => {
    it('should apply additive modifiers', () => {
      store.applyModifier(37, 50, 'add'); // Add 50 to velocity
      expect(store.get(37)).to.equal(310);
    });

    it('should apply multiplicative modifiers', () => {
      store.applyModifier(37, 1.5, 'multiply'); // 1.5x velocity
      expect(store.get(37)).to.equal(390); // 260 * 1.5
    });

    it('should apply set modifiers', () => {
      store.applyModifier(37, 500, 'set'); // Set velocity to 500
      expect(store.get(37)).to.equal(500);
    });

    it('should handle multiple additive modifiers', () => {
      store.applyModifier(37, 50, 'add');
      store.applyModifier(37, 30, 'add');
      expect(store.get(37)).to.equal(340); // 260 + 50 + 30
    });

    it('should handle multiple multiplicative modifiers', () => {
      store.applyModifier(37, 1.2, 'multiply');
      store.applyModifier(37, 1.1, 'multiply');
      expect(store.get(37)).to.equal(343.2); // 260 * 1.2 * 1.1
    });
  });

  describe('stacking penalties', () => {
    it('should apply stacking penalties to grouped modifiers', () => {
      // Apply multiple shield resistance bonuses (should stack with penalties)
      store.applyModifier(109, 0.2, 'add', 'shieldResistance');
      store.applyModifier(109, 0.2, 'add', 'shieldResistance');
      store.applyModifier(109, 0.2, 'add', 'shieldResistance');
      
      // With 3 modules giving 0.2 resistance bonus each, stacking penalties should apply
      const result = store.get(109);
      expect(result).to.be.greaterThan(0.75); // More than base
      expect(result).to.be.lessThan(1.35); // Less than 0.75 + 3*0.2 (no stacking)
    });

    it('should apply PyFA-style stacking penalties for damage multipliers', () => {
      // Apply multiple damage bonuses (10% each)
      store.applyModifier(64, 1.1, 'multiply', 'missileDamage');
      store.applyModifier(64, 1.1, 'multiply', 'missileDamage');
      store.applyModifier(64, 1.1, 'multiply', 'missileDamage');
      
      const result = store.get(64);
      expect(result).to.be.greaterThan(1.0); // Should have some bonus
      expect(result).to.be.lessThan(1.331); // Should be less than 1.1^3 due to stacking
    });

    it('should not apply stacking penalties to non-grouped modifiers', () => {
      store.applyModifier(37, 1.2, 'multiply');
      store.applyModifier(37, 1.1, 'multiply');
      expect(store.get(37)).to.equal(343.2); // 260 * 1.2 * 1.1 (no stacking penalty)
    });
  });

  describe('get()', () => {
    it('should return 0 for unknown attributes', () => {
      expect(store.get(99999)).to.equal(0);
    });

    it('should return 1 for damageMultiplier when not set', () => {
      const emptyStore = new ModifiedAttributeStore([]);
      expect(emptyStore.get(64)).to.equal(1);
    });

    it('should return calculated values after modifications', () => {
      store.applyModifier(263, 1.25, 'multiply'); // 25% shield bonus
      expect(store.get(263)).to.equal(3125); // 2500 * 1.25
    });
  });

  describe('getBase()', () => {
    it('should return original base values', () => {
      store.applyModifier(37, 1.5, 'multiply');
      expect(store.getBase(37)).to.equal(260); // Original value
      expect(store.get(37)).to.equal(390); // Modified value
    });

    it('should return undefined for non-existent attributes', () => {
      expect(store.getBase(99999)).to.be.undefined;
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed modifier types in correct order', () => {
      // Apply in order: set, add, multiply (with stacking)
      store.applyModifier(37, 300, 'set');
      store.applyModifier(37, 50, 'add');
      store.applyModifier(37, 1.2, 'multiply');
      store.applyModifier(37, 1.1, 'multiply', 'velocityBonus');
      
      // Should be: set to 300, add 50 = 350, multiply by 1.2 = 420, then apply stacked 1.1
      const result = store.get(37);
      expect(result).to.be.greaterThan(420); // At least base calculation
      expect(result).to.be.lessThan(508); // Less than 420 * 1.1 due to potential stacking
    });

    it('should handle damage multiplier edge cases', () => {
      const emptyStore = new ModifiedAttributeStore([]);
      
      // Apply damage bonuses to an attribute that starts at default 1
      emptyStore.applyModifier(64, 1.1, 'multiply', 'missileDamage');
      emptyStore.applyModifier(64, 1.05, 'multiply', 'skillBonus');
      
      const result = emptyStore.get(64);
      expect(result).to.be.greaterThan(1.0);
      expect(result).to.be.approximately(1.155, 0.01); // 1 * 1.1 * 1.05
    });
  });

  describe('recalculateAll()', () => {
    it('should recalculate all attributes', () => {
      store.applyModifier(37, 1.2, 'multiply');
      store.applyModifier(263, 1.3, 'multiply');
      
      const velocityBefore = store.get(37);
      const shieldBefore = store.get(263);
      
      store.recalculateAll();
      
      expect(store.get(37)).to.equal(velocityBefore);
      expect(store.get(263)).to.equal(shieldBefore);
    });
  });
});