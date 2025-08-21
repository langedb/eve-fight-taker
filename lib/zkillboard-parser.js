const axios = require('axios');
const { StaticData } = require('./static-data');

class ZKillboardParser {
  constructor() {
    this.zkillBaseUrl = 'https://zkillboard.com/api';
    this.staticData = null;
  }

  async ensureStaticData() {
    if (!this.staticData) {
      this.staticData = await StaticData.getInstance();
    }
  }

  // Extract killmail ID from zKillboard URL
  extractKillID(zkillUrl) {
    const match = zkillUrl.match(/zkillboard\.com\/kill\/(\d+)/i);
    return match ? match[1] : null;
  }

  // Fetch killmail metadata from zKillboard API
  async fetchKillmailMetadata(killID) {
    try {
      const response = await axios.get(`${this.zkillBaseUrl}/killID/${killID}/`, {
        headers: {
          'Accept-Encoding': 'gzip',
          'User-Agent': 'EVE Fight Taker - github.com/user/eve-fight-taker'
        },
        timeout: 10000
      });

      if (!response.data || !response.data[0]) {
        throw new Error('Killmail not found on zKillboard');
      }

      return response.data[0];
    } catch (error) {
      console.error(`Error fetching killmail metadata ${killID}:`, error);
      throw error;
    }
  }

  // Fetch full killmail data from ESI API
  async fetchKillmailFromESI(killID, hash) {
    try {
      const esiUrl = `https://esi.evetech.net/latest/killmails/${killID}/${hash}/`;
      const response = await axios.get(esiUrl, {
        headers: {
          'User-Agent': 'EVE Fight Taker - github.com/user/eve-fight-taker'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching killmail from ESI ${killID}/${hash}:`, error);
      throw error;
    }
  }

  // Convert killmail JSON to EFT format
  async killmailToEFT(killmail) {
    await this.ensureStaticData();
    try {
      console.log('Killmail structure:', Object.keys(killmail));
      
      if (!killmail.victim) {
        throw new Error('Killmail does not contain victim data. This killmail may be incomplete or only contain metadata.');
      }
      
      const victim = killmail.victim;
      
      if (!victim.ship_type_id) {
        throw new Error('Victim data does not contain ship_type_id');
      }
      
      // Get ship name from static data
      const shipName = await this.getShipName(victim.ship_type_id);
      
      // Start building EFT format
      let eftText = `[${shipName}, zKillboard Fit]\n`;
      
      // Process items (modules, charges, etc.)
      const items = victim.items || [];
      
      // Group items by slot type
      const slots = {
        high: [],
        med: [],
        low: [],
        rig: [],
        subsystem: [],
        cargo: [],
        drones: []
      };

      // First pass: collect weapons and modules
      const weaponSlots = new Map(); // Track which slot each weapon is in
      let slotCounters = { high: 0, med: 0, low: 0 };
      
      for (const item of items) {
        const itemName = await this.getItemName(item.item_type_id);
        const quantity = (item.quantity_destroyed || 0) + (item.quantity_dropped || 0);
        const slotType = this.getSlotTypeFromFlag(item.flag);
        
        
        if (slotType && slots[slotType] !== undefined) {
          if (slotType === 'high' || slotType === 'med' || slotType === 'low') {
            // Track weapon position for charge association
            weaponSlots.set(item.flag, { slotType, index: slotCounters[slotType], name: itemName });
            slots[slotType].push(itemName);
            slotCounters[slotType]++;
          } else if (slotType === 'drones') {
            if (quantity > 1) {
              slots[slotType].push(`${itemName} x${quantity}`);
            } else {
              slots[slotType].push(itemName);
            }
          } else if (slotType === 'cargo') {
            if (quantity > 1) {
              slots[slotType].push(`${itemName} x${quantity}`);
            } else {
              slots[slotType].push(itemName);
            }
          } else {
            slots[slotType].push(itemName);
          }
        }
      }
      
      // Second pass: associate charges with weapons
      for (const item of items) {
        const itemName = await this.getItemName(item.item_type_id);
        
        // Check if this is a charge by looking for parent weapon
        if (item.location_flag && weaponSlots.has(item.location_flag)) {
          const weapon = weaponSlots.get(item.location_flag);
          const slotIndex = weapon.index;
          
          // Update the weapon entry to include the charge
          if (slots[weapon.slotType][slotIndex] === weapon.name) {
            slots[weapon.slotType][slotIndex] = `${weapon.name}, ${itemName}`;
          }
        }
      }

      // Build EFT format string
      const eftOrder = ['high', 'med', 'low', 'rig', 'subsystem', 'drones', 'cargo'];
      let firstSection = true;

      for (const sectionName of eftOrder) {
        if (slots[sectionName].length > 0) {
          if (!firstSection) {
            eftText += '\n'; // Add a single empty line between sections
          }
          firstSection = false;
          for (const item of slots[sectionName]) {
            eftText += `${item}\n`;
          }
        }
      }

      return eftText.trim();
    } catch (error) {
      console.error('Error converting killmail to EFT:', error);
      throw error;
    }
  }

  // Get slot type based on EVE item flag
  getSlotTypeFromFlag(flag) {
    // EVE item flags for different slots
    if (flag >= 11 && flag <= 18) return 'low';  // Low slots
    if (flag >= 19 && flag <= 26) return 'med';  // Mid slots
    if (flag >= 27 && flag <= 34) return 'high'; // High slots
    if (flag >= 92 && flag <= 94) return 'rig';  // Rigs
    if (flag === 87) return 'drones'; // Drone bay
    if (flag >= 125 && flag <= 132) return 'subsystem'; // Subsystem slots
    if (flag === 5) return 'cargo'; // Cargo hold
    return null;
  }

  // Check if item flag indicates it's a charge/ammo
  isCharge() {
    // Charges are typically in slots 27-34 but with different sub-flags
    // This is a simplified check - in reality it's more complex
    return false; // For now, we'll handle charges differently
  }

  // Get ship name from static data
  async getShipName(shipTypeId) {
    await this.ensureStaticData();
    try {
      const shipInfo = await this.staticData.getItemInfo(shipTypeId);
      return shipInfo ? shipInfo.name : 'Unknown Ship';
    } catch (error) {
      console.error(`Error fetching ship name for ${shipTypeId}:`, error);
      return 'Unknown Ship';
    }
  }

  // Get item name from static data
  async getItemName(itemTypeId) {
    await this.ensureStaticData();
    try {
      const itemInfo = await this.staticData.getItemInfo(itemTypeId);
      return itemInfo ? itemInfo.name : 'Unknown Item';
    } catch (error) {
      console.error(`Error fetching item name for ${itemTypeId}:`, error);
      return 'Unknown Item';
    }
  }

  // Parse zKillboard URL and return EFT format
  async parseZKillboardURL(zkillUrl) {
    try {
      const killID = this.extractKillID(zkillUrl);
      if (!killID) {
        throw new Error('Invalid zKillboard URL format');
      }

      console.log(`Parsing zKillboard killmail: ${killID}`);
      
      // Step 1: Get killmail metadata from zKillboard to get the hash
      const zkillData = await this.fetchKillmailMetadata(killID);
      
      if (!zkillData.zkb || !zkillData.zkb.hash) {
        throw new Error('No hash found in zKillboard data');
      }
      
      const hash = zkillData.zkb.hash;
      console.log(`Got hash from zKillboard: ${hash}`);
      
      // Step 2: Get full killmail data from ESI
      const killmail = await this.fetchKillmailFromESI(killID, hash);
      console.log('Got killmail from ESI:', Object.keys(killmail));
      
      // Step 3: Convert to EFT format
      const eftText = await this.killmailToEFT(killmail);
      
      return {
        killID: killID,
        eftText: eftText,
        originalUrl: zkillUrl,
        shipTypeId: killmail.victim.ship_type_id,
        pilotName: killmail.victim.character_id ? 'Unknown Pilot' : 'NPC', // Could fetch from ESI
        killTime: killmail.killmail_time,
        zkbValue: zkillData.zkb.totalValue
      };
    } catch (error) {
      console.error('Error parsing zKillboard URL:', error);
      throw error;
    }
  }
}

module.exports = { ZKillboardParser };