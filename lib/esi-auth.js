const axios = require('axios');
const crypto = require('crypto');

class ESIAuth {
  constructor(options) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.redirectUri = options.redirectUri;
    this.baseUrl = 'https://esi.evetech.net/latest';
    this.oauthUrl = 'https://login.eveonline.com/v2/oauth';
  }

  getAuthorizationUrl() {
    const state = crypto.randomBytes(16).toString('hex');
    const scopes = [
      'esi-location.read_location.v1',
      'esi-location.read_ship_type.v1',
      'esi-fittings.read_fittings.v1'
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: this.redirectUri,
      client_id: this.clientId,
      scope: scopes,
      state: state
    });

    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  async exchangeCodeForTokens(code) {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await axios.post(`${this.oauthUrl}/token`, 
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: this.redirectUri
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  }

  async refreshAccessToken(refreshToken) {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    
    const response = await axios.post(`${this.oauthUrl}/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }),
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data;
  }

  async getCharacterInfo(accessToken) {
    // First, verify the token and get character ID
    const verifyResponse = await axios.get(`${this.oauthUrl}/verify`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const characterId = verifyResponse.data.CharacterID;

    // Get character details
    const characterResponse = await axios.get(`${this.baseUrl}/characters/${characterId}/`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return {
      id: characterId,
      name: characterResponse.data.name,
      corporation_id: characterResponse.data.corporation_id
    };
  }

  async getCurrentShip(accessToken) {
    const character = await this.getCharacterInfo(accessToken);
    
    const response = await axios.get(`${this.baseUrl}/characters/${character.id}/ship/`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    return response.data;
  }

  async getShipFitting(accessToken, shipTypeId) {
    const character = await this.getCharacterInfo(accessToken);
    
    // Get character fittings
    const fittingsResponse = await axios.get(`${this.baseUrl}/characters/${character.id}/fittings/`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    // Find fitting for the current ship
    const fitting = fittingsResponse.data.find(f => f.ship_type_id === shipTypeId);
    
    return fitting || null;
  }

  async getItemInfo(itemId) {
    const response = await axios.get(`${this.baseUrl}/universe/types/${itemId}/`);
    return response.data;
  }
}

module.exports = { ESIAuth };