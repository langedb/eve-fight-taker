const axios = require('axios');
const log = require('./logger');
const { StaticData } = require('./static-data');
const { FitCalculator } = require('./fit-calculator');
const { rateLimitHandler } = require('./rate-limit-handler');

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
      log.error(`Error fetching killmail metadata ${killID}`, { error: error.message });
      throw error;
    }
  }

  // Fetch full killmail data from ESI API
  async fetchKillmailFromESI(killID, hash) {
    try {
      const esiUrl = `https://esi.evetech.net/latest/killmails/${killID}/${hash}/`;
      const response = await rateLimitHandler.executeRequest(() =>
        axios.get(esiUrl, {
          headers: {
            'User-Agent': 'EVE Fight Taker - github.com/user/eve-fight-taker'
          },
          timeout: 10000
        })
      );

      return response.data;
    } catch (error) {
      log.error(`Error fetching killmail from ESI ${killID}/${hash}`, { error: error.message });
      throw error;
    }
  }

  // Convert killmail JSON to EFT format using existing FitCalculator logic
  async killmailToEFT(killmail) {
    try {
      log.debug('Killmail structure', { keys: Object.keys(killmail) });

      if (!killmail.victim) {
        throw new Error('Killmail does not contain victim data. This killmail may be incomplete or only contain metadata.');
      }

      const victim = killmail.victim;

      // Transform killmail data to ESI fitting format
      const items = (victim.items || []).map(item => ({
        type_id: item.item_type_id,
        flag: item.flag,
        quantity: (item.quantity_destroyed || 0) + (item.quantity_dropped || 0)
      }));

      const esiFitting = {
        ship_type_id: victim.ship_type_id,
        name: 'zKillboard Fit',
        items: items
      };

      // Use existing FitCalculator esiToEFT method
      const fitCalculator = new FitCalculator();
      const eftText = await fitCalculator.esiToEFT(esiFitting);

      return eftText;
    } catch (error) {
      log.error('Error converting killmail to EFT', { error: error.message });
      throw error;
    }
  }


  // Get ship name from static data
  async getShipName(shipTypeId) {
    await this.ensureStaticData();
    try {
      const shipInfo = await this.staticData.getItemInfo(shipTypeId);
      return shipInfo ? shipInfo.name : 'Unknown Ship';
    } catch (error) {
      log.error(`Error fetching ship name for ${shipTypeId}`, { error: error.message });
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
      log.error(`Error fetching item name for ${itemTypeId}`, { error: error.message });
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

      log.debug(`Parsing zKillboard killmail: ${killID}`);

      // Step 1: Get killmail metadata from zKillboard to get the hash
      const zkillData = await this.fetchKillmailMetadata(killID);

      if (!zkillData.zkb || !zkillData.zkb.hash) {
        throw new Error('No hash found in zKillboard data');
      }

      const hash = zkillData.zkb.hash;
      log.debug(`Got hash from zKillboard: ${hash}`);

      // Step 2: Get full killmail data from ESI
      const killmail = await this.fetchKillmailFromESI(killID, hash);
      log.debug('Got killmail from ESI', { keys: Object.keys(killmail) });

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
      log.error('Error parsing zKillboard URL', { error: error.message });
      throw error;
    }
  }
}

module.exports = { ZKillboardParser };
