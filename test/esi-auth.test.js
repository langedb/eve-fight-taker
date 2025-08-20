const { expect } = require('chai');
const { ESIAuth } = require('../lib/esi-auth');

describe('ESIAuth', () => {
  let esiAuth;

  beforeEach(() => {
    const config = {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/callback',
      scopes: ['esi-fittings.read_fittings.v1']
    };
    esiAuth = new ESIAuth(config);
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(esiAuth.clientId).to.equal('test-client-id');
      expect(esiAuth.clientSecret).to.equal('test-client-secret');
      expect(esiAuth.redirectUri).to.equal('http://localhost:3000/callback');
      expect(esiAuth.scopes).to.deep.equal(['esi-fittings.read_fittings.v1']);
    });

    it('should throw error with missing required config', () => {
      expect(() => new ESIAuth({})).to.throw();
      expect(() => new ESIAuth({ clientId: 'test' })).to.throw();
      expect(() => new ESIAuth({ clientId: 'test', clientSecret: 'secret' })).to.throw();
    });

    it('should use default scopes if none provided', () => {
      const minimalConfig = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback'
      };
      const esiAuth = new ESIAuth(minimalConfig);
      expect(esiAuth.scopes).to.be.an('array');
      expect(esiAuth.scopes.length).to.be.greaterThan(0);
    });
  });

  describe('generateAuthUrl()', () => {
    it('should generate valid authorization URL', () => {
      const authUrl = esiAuth.generateAuthUrl();
      
      expect(authUrl).to.be.a('string');
      expect(authUrl).to.include('https://login.eveonline.com/v2/oauth/authorize');
      expect(authUrl).to.include('response_type=code');
      expect(authUrl).to.include('client_id=test-client-id');
      expect(authUrl).to.include('redirect_uri=');
      expect(authUrl).to.include('scope=');
      expect(authUrl).to.include('state=');
    });

    it('should include all specified scopes', () => {
      const authUrl = esiAuth.generateAuthUrl();
      expect(authUrl).to.include('esi-fittings.read_fittings.v1');
    });

    it('should generate unique state parameter', () => {
      const url1 = esiAuth.generateAuthUrl();
      const url2 = esiAuth.generateAuthUrl();
      
      const state1 = new URL(url1).searchParams.get('state');
      const state2 = new URL(url2).searchParams.get('state');
      
      expect(state1).to.not.equal(state2);
    });

    it('should properly encode redirect URI', () => {
      const authUrl = esiAuth.generateAuthUrl();
      expect(authUrl).to.include(encodeURIComponent('http://localhost:3000/callback'));
    });
  });

  describe('validateState()', () => {
    it('should validate correct state', () => {
      const authUrl = esiAuth.generateAuthUrl();
      const state = new URL(authUrl).searchParams.get('state');
      
      expect(esiAuth.validateState(state)).to.be.true;
    });

    it('should reject invalid state', () => {
      esiAuth.generateAuthUrl(); // Generate a state
      expect(esiAuth.validateState('invalid-state')).to.be.false;
      expect(esiAuth.validateState('')).to.be.false;
      expect(esiAuth.validateState(null)).to.be.false;
    });

    it('should reject state when none was generated', () => {
      // Don't generate auth URL first
      expect(esiAuth.validateState('any-state')).to.be.false;
    });
  });

  describe('URL encoding and decoding', () => {
    it('should handle special characters in scopes', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['esi-fittings.read_fittings.v1', 'esi-universe.read_structures.v1']
      };
      const esiAuth = new ESIAuth(config);
      
      const authUrl = esiAuth.generateAuthUrl();
      expect(authUrl).to.include('esi-fittings.read_fittings.v1');
      expect(authUrl).to.include('esi-universe.read_structures.v1');
    });

    it('should handle special characters in redirect URI', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/auth/callback?param=value',
        scopes: ['esi-fittings.read_fittings.v1']
      };
      const esiAuth = new ESIAuth(config);
      
      const authUrl = esiAuth.generateAuthUrl();
      // Should properly encode the redirect URI
      expect(authUrl).to.include(encodeURIComponent('http://localhost:3000/auth/callback?param=value'));
    });
  });

  describe('configuration validation', () => {
    it('should validate client ID format', () => {
      expect(() => new ESIAuth({
        clientId: '',
        clientSecret: 'secret',
        redirectUri: 'http://localhost:3000/callback'
      })).to.throw();
    });

    it('should validate redirect URI format', () => {
      expect(() => new ESIAuth({
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'invalid-uri'
      })).to.throw();
    });

    it('should accept valid HTTP and HTTPS redirect URIs', () => {
      expect(() => new ESIAuth({
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'http://localhost:3000/callback'
      })).to.not.throw();

      expect(() => new ESIAuth({
        clientId: 'client',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/callback'
      })).to.not.throw();
    });
  });

  describe('scope management', () => {
    it('should handle empty scopes array', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: []
      };
      
      expect(() => new ESIAuth(config)).to.not.throw();
    });

    it('should handle duplicate scopes', () => {
      const config = {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['esi-fittings.read_fittings.v1', 'esi-fittings.read_fittings.v1']
      };
      
      const esiAuth = new ESIAuth(config);
      const authUrl = esiAuth.generateAuthUrl();
      
      // Should handle duplicates gracefully
      expect(authUrl).to.include('esi-fittings.read_fittings.v1');
    });
  });

  describe('state security', () => {
    it('should generate cryptographically random state', () => {
      const states = new Set();
      
      // Generate multiple states and ensure they're all unique
      for (let i = 0; i < 100; i++) {
        const authUrl = esiAuth.generateAuthUrl();
        const state = new URL(authUrl).searchParams.get('state');
        expect(states.has(state)).to.be.false;
        states.add(state);
      }
    });

    it('should generate state of sufficient length', () => {
      const authUrl = esiAuth.generateAuthUrl();
      const state = new URL(authUrl).searchParams.get('state');
      expect(state.length).to.be.greaterThan(10); // Should be reasonably long
    });
  });

  describe('error handling', () => {
    it('should handle malformed configuration gracefully', () => {
      expect(() => new ESIAuth(null)).to.throw();
      expect(() => new ESIAuth(undefined)).to.throw();
      expect(() => new ESIAuth('not-an-object')).to.throw();
    });

    it('should provide helpful error messages', () => {
      try {
        new ESIAuth({});
      } catch (error) {
        expect(error.message).to.include('clientId');
      }

      try {
        new ESIAuth({ clientId: 'test' });
      } catch (error) {
        expect(error.message).to.include('clientSecret');
      }
    });
  });

  describe('integration scenarios', () => {
    it('should support the complete auth flow simulation', () => {
      // Step 1: Generate auth URL
      const authUrl = esiAuth.generateAuthUrl();
      expect(authUrl).to.be.a('string');
      
      // Step 2: Extract state from URL
      const state = new URL(authUrl).searchParams.get('state');
      expect(state).to.be.a('string');
      
      // Step 3: Validate state (simulating callback)
      expect(esiAuth.validateState(state)).to.be.true;
      
      // Step 4: State should not validate twice (security measure)
      expect(esiAuth.validateState(state)).to.be.false;
    });
  });
});