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
}

module.exports = { StaticData };