const { expect } = require('chai');
const { StaticData } = require('../lib/static-data');

describe('StaticData', () => {
  let staticData;

  before(async () => {
    staticData = new StaticData();
    await staticData.loadStaticData();
  });

  describe('loadStaticData()', () => {
    it('should load static data successfully', () => {
      expect(staticData.types).to.be.a('map');
      expect(staticData.groups).to.be.a('map');
      expect(staticData.dogmaAttributes).to.be.a('map');
      expect(staticData.typeDogma).to.be.a('map');
    });

    it('should load a reasonable number of types', () => {
      expect(staticData.types.size).to.be.greaterThan(10000);
    });

    it('should load groups data', () => {
      expect(staticData.groups.size).to.be.greaterThan(100);
    });

    it('should load dogma attributes', () => {
      expect(staticData.dogmaAttributes.size).to.be.greaterThan(1000);
    });
  });

  describe('searchItemByName()', () => {
    it('should find existing items by exact name', async () => {
      const result = await staticData.searchItemByName('Rifter');
      expect(result).to.not.be.null;
      expect(result.name).to.equal('Rifter');
      expect(result.type_id).to.be.a('number');
    });

    it('should return null for non-existent items', async () => {
      const result = await staticData.searchItemByName('NonExistentItem12345');
      expect(result).to.be.null;
    });

    it('should handle case-insensitive search', async () => {
      const result = await staticData.searchItemByName('rifter');
      expect(result).to.not.be.null;
      expect(result.name).to.equal('Rifter');
    });

    it('should find missile items', async () => {
      const result = await staticData.searchItemByName('Scourge Light Missile');
      expect(result).to.not.be.null;
      expect(result.name).to.equal('Scourge Light Missile');
    });

    it('should find weapon items', async () => {
      const result = await staticData.searchItemByName('Light Missile Launcher II');
      expect(result).to.not.be.null;
      expect(result.name).to.equal('Light Missile Launcher II');
    });
  });

  describe('getTypeAttributes()', () => {
    it('should return attributes for valid type ID', () => {
      // Rifter type ID
      const rifterResult = staticData.searchItemByName('Rifter');
      if (rifterResult) {
        const attributes = staticData.getTypeAttributes(rifterResult.type_id);
        expect(attributes).to.be.an('array');
        expect(attributes.length).to.be.greaterThan(0);
        
        // Should have typical ship attributes
        const massAttr = attributes.find(attr => attr.attributeID === 4); // mass
        expect(massAttr).to.exist;
      }
    });

    it('should return empty array for invalid type ID', () => {
      const attributes = staticData.getTypeAttributes(999999999);
      expect(attributes).to.be.an('array');
      expect(attributes.length).to.equal(0);
    });
  });

  describe('getGroupInfo()', () => {
    it('should return group info for valid group ID', () => {
      // Frigate group ID is typically 25
      const groupInfo = staticData.getGroupInfo(25);
      expect(groupInfo).to.not.be.null;
      expect(groupInfo.name).to.be.a('string');
      expect(groupInfo.categoryID).to.be.a('number');
    });

    it('should return null for invalid group ID', () => {
      const groupInfo = staticData.getGroupInfo(999999999);
      expect(groupInfo).to.be.null;
    });
  });

  describe('weapon and charge compatibility', () => {
    it('should find weapon items in appropriate groups', async () => {
      const launcher = await staticData.searchItemByName('Light Missile Launcher II');
      expect(launcher).to.not.be.null;
      expect(launcher.group_id).to.be.a('number');
      
      // Should be in a missile launcher group
      const groupInfo = staticData.getGroupInfo(launcher.group_id);
      expect(groupInfo).to.not.be.null;
      expect(groupInfo.name).to.include('Missile');
    });

    it('should find charge items with damage attributes', async () => {
      const missile = await staticData.searchItemByName('Scourge Light Missile');
      expect(missile).to.not.be.null;
      expect(missile.attributes).to.be.an('array');
      
      // Should have damage attributes (114=EM, 116=Explosive, 117=Kinetic, 118=Thermal)
      const damageAttrs = missile.attributes.filter(attr => 
        [114, 116, 117, 118].includes(attr.attributeID)
      );
      expect(damageAttrs.length).to.be.greaterThan(0);
    });
  });

  describe('performance', () => {
    it('should search items quickly', async () => {
      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await staticData.searchItemByName('Rifter');
      }
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(1000); // Should complete 100 searches in under 1 second
    });
  });
});