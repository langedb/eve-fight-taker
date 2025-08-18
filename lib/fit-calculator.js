const axios = require('axios');

class FitCalculator {
  constructor() {
    this.esiBaseUrl = 'https://esi.evetech.net/latest';
    this.itemCache = new Map();
  }

  async getItemInfo(typeId) {
    if (this.itemCache.has(typeId)) {
      return this.itemCache.get(typeId);
    }

    try {
      const response = await axios.get(`${this.esiBaseUrl}/universe/types/${typeId}/`);
      const itemInfo = response.data;
      
      // Get dogma attributes for the item
      const dogmaResponse = await axios.get(`${this.esiBaseUrl}/dogma/types/${typeId}/`);
      itemInfo.attributes = dogmaResponse.data.attributes || [];
      itemInfo.effects = dogmaResponse.data.effects || [];
      
      this.itemCache.set(typeId, itemInfo);
      return itemInfo;
    } catch (error) {
      console.error(`Error fetching item info for ${typeId}:`, error);
      return null;
    }
  }

  parseEFT(eftText) {
    const lines = eftText.split('\n').map(line => line.trim()).filter(line => line);
    
    if (lines.length === 0) {
      throw new Error('Empty EFT text');
    }

    // Parse header [ShipType, FitName]
    const headerMatch = lines[0].match(/^\[([^,]+),\s*(.+)\]$/);
    if (!headerMatch) {
      throw new Error('Invalid EFT format: header not found');
    }

    const shipType = headerMatch[1].trim();
    const fitName = headerMatch[2].trim();

    const fit = {
      shipType,
      fitName,
      modules: {
        high: [],
        med: [],
        low: [],
        rig: [],
        subsystem: []
      },
      drones: [],
      cargo: [],
      implants: []
    };

    let currentSection = 'modules';
    let moduleSlot = 'high';

    // Parse the rest of the lines
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (!line) {
        // Empty line indicates section change
        if (currentSection === 'modules') {
          if (moduleSlot === 'high') moduleSlot = 'med';
          else if (moduleSlot === 'med') moduleSlot = 'low';
          else if (moduleSlot === 'low') moduleSlot = 'rig';
          else if (moduleSlot === 'rig') moduleSlot = 'subsystem';
          else currentSection = 'drones';
        } else if (currentSection === 'drones') {
          currentSection = 'cargo';
        } else if (currentSection === 'cargo') {
          currentSection = 'implants';
        }
        continue;
      }

      if (currentSection === 'modules') {
        const moduleInfo = this.parseModuleLine(line);
        if (moduleInfo) {
          fit.modules[moduleSlot].push(moduleInfo);
        }
      } else if (currentSection === 'drones') {
        const droneInfo = this.parseDroneLine(line);
        if (droneInfo) {
          fit.drones.push(droneInfo);
        }
      } else if (currentSection === 'cargo') {
        const cargoInfo = this.parseCargoLine(line);
        if (cargoInfo) {
          fit.cargo.push(cargoInfo);
        }
      } else if (currentSection === 'implants') {
        const implantInfo = this.parseImplantLine(line);
        if (implantInfo) {
          fit.implants.push(implantInfo);
        }
      }
    }

    return fit;
  }

  parseModuleLine(line) {
    // Handle offline modules
    const offline = line.includes('/offline');
    const cleanLine = line.replace('/offline', '').trim();

    // Handle charged modules
    const parts = cleanLine.split(',');
    const moduleName = parts[0].trim();
    const chargeName = parts[1] ? parts[1].trim() : null;

    return {
      name: moduleName,
      charge: chargeName,
      offline: offline
    };
  }

  parseDroneLine(line) {
    const match = line.match(/^(.+?)\s+x(\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        quantity: parseInt(match[2])
      };
    }
    return null;
  }

  parseCargoLine(line) {
    const match = line.match(/^(.+?)\s+x(\d+)$/);
    if (match) {
      return {
        name: match[1].trim(),
        quantity: parseInt(match[2])
      };
    }
    return null;
  }

  parseImplantLine(line) {
    return {
      name: line.trim()
    };
  }

  async calculateFitStats(fit) {
    const stats = {
      dps: { total: 0, em: 0, thermal: 0, kinetic: 0, explosive: 0 },
      volley: { total: 0, em: 0, thermal: 0, kinetic: 0, explosive: 0 },
      ehp: { hull: 0, armor: 0, shield: 0, total: 0 },
      tank: { hull: 0, armor: 0, shield: 0, total: 0 },
      speed: 0,
      agility: 0,
      signatureRadius: 0,
      scanResolution: 0,
      lockRange: 0,
      capacitor: { amount: 0, recharge: 0, stable: false }
    };

    try {
      // Get ship base stats
      const shipInfo = await this.getItemByName(fit.shipType);
      if (!shipInfo) {
        throw new Error(`Ship type not found: ${fit.shipType}`);
      }

      // Calculate base ship stats
      await this.calculateShipBaseStats(shipInfo, stats);

      // Process modules and their effects
      for (const slotType of ['high', 'med', 'low', 'rig', 'subsystem']) {
        for (const module of fit.modules[slotType]) {
          if (!module.offline) {
            await this.applyModuleStats(module, stats);
          }
        }
      }

      // Process drones
      for (const drone of fit.drones) {
        await this.applyDroneStats(drone, stats);
      }

      return stats;
    } catch (error) {
      console.error('Error calculating fit stats:', error);
      throw error;
    }
  }

  async getItemByName(itemName) {
    try {
      // Search for item by name
      const searchResponse = await axios.get(`${this.esiBaseUrl}/search/`, {
        params: {
          search: itemName,
          categories: 'inventory_type',
          strict: true
        }
      });

      if (searchResponse.data.inventory_type && searchResponse.data.inventory_type.length > 0) {
        const typeId = searchResponse.data.inventory_type[0];
        return await this.getItemInfo(typeId);
      }

      return null;
    } catch (error) {
      console.error(`Error searching for item: ${itemName}`, error);
      return null;
    }
  }

  async calculateShipBaseStats(shipInfo, stats) {
    // Extract base stats from ship attributes
    for (const attr of shipInfo.attributes) {
      switch (attr.attribute_id) {
        case 9: // HP
          stats.ehp.hull = attr.value;
          break;
        case 265: // Armor HP
          stats.ehp.armor = attr.value;
          break;
        case 263: // Shield capacity
          stats.ehp.shield = attr.value;
          break;
        case 37: // Max velocity
          stats.speed = attr.value;
          break;
        case 70: // Agility
          stats.agility = attr.value;
          break;
        case 552: // Signature radius
          stats.signatureRadius = attr.value;
          break;
        case 564: // Scan resolution
          stats.scanResolution = attr.value;
          break;
        case 76: // Max targeting range
          stats.lockRange = attr.value;
          break;
        case 482: // Capacitor capacity
          stats.capacitor.amount = attr.value;
          break;
        case 55: // Capacitor recharge time
          stats.capacitor.recharge = attr.value;
          break;
      }
    }

    stats.ehp.total = stats.ehp.hull + stats.ehp.armor + stats.ehp.shield;
  }

  async applyModuleStats(module, stats) {
    const moduleInfo = await this.getItemByName(module.name);
    if (!moduleInfo) return;

    // This is a simplified version - in reality, you'd need to process
    // all the dogma effects and attribute modifications
    for (const attr of moduleInfo.attributes) {
      switch (attr.attribute_id) {
        case 114: // EM damage
          stats.dps.em += attr.value || 0;
          stats.volley.em += attr.value || 0;
          break;
        case 116: // Thermal damage
          stats.dps.thermal += attr.value || 0;
          stats.volley.thermal += attr.value || 0;
          break;
        case 117: // Kinetic damage
          stats.dps.kinetic += attr.value || 0;
          stats.volley.kinetic += attr.value || 0;
          break;
        case 118: // Explosive damage
          stats.dps.explosive += attr.value || 0;
          stats.volley.explosive += attr.value || 0;
          break;
      }
    }

    // Calculate total DPS (this is simplified)
    stats.dps.total = stats.dps.em + stats.dps.thermal + stats.dps.kinetic + stats.dps.explosive;
    stats.volley.total = stats.volley.em + stats.volley.thermal + stats.volley.kinetic + stats.volley.explosive;
  }

  async applyDroneStats(drone, stats) {
    const droneInfo = await this.getItemByName(drone.name);
    if (!droneInfo) return;

    // Add drone DPS (simplified calculation)
    for (const attr of droneInfo.attributes) {
      switch (attr.attribute_id) {
        case 114: // EM damage
          stats.dps.em += (attr.value || 0) * drone.quantity;
          break;
        case 116: // Thermal damage  
          stats.dps.thermal += (attr.value || 0) * drone.quantity;
          break;
        case 117: // Kinetic damage
          stats.dps.kinetic += (attr.value || 0) * drone.quantity;
          break;
        case 118: // Explosive damage
          stats.dps.explosive += (attr.value || 0) * drone.quantity;
          break;
      }
    }

    stats.dps.total = stats.dps.em + stats.dps.thermal + stats.dps.kinetic + stats.dps.explosive;
  }
}

module.exports = { FitCalculator };