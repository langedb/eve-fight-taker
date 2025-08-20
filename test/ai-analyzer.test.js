const { expect } = require('chai');
const { AIAnalyzer } = require('../lib/ai-analyzer');

describe('AIAnalyzer', () => {
  let aiAnalyzer;

  beforeEach(() => {
    // Use a fake API key for testing
    aiAnalyzer = new AIAnalyzer('fake-api-key-for-testing');
  });

  describe('constructor', () => {
    it('should initialize with valid API key', () => {
      expect(aiAnalyzer.genAI).to.exist;
      expect(aiAnalyzer.model).to.exist;
    });

    it('should throw error without API key', () => {
      expect(() => new AIAnalyzer()).to.throw('Google API key is required');
      expect(() => new AIAnalyzer('')).to.throw('Google API key is required');
      expect(() => new AIAnalyzer(null)).to.throw('Google API key is required');
    });
  });

  describe('parseAnalysisResponse()', () => {
    it('should parse valid JSON response', () => {
      const jsonResponse = JSON.stringify({
        winChance: "75%",
        timeToKill: "45 seconds",
        majorAdvantages: ["Superior range", "Better tracking"],
        majorDisadvantages: ["Lower tank"],
        ammoRecommendations: ["Use Barrage for range"],
        moduleRecommendations: ["Activate MWD early"],
        tactics: {
          range: "15-20km",
          movement: "Orbit at speed",
          engagement: "Open at long range",
          disengagement: "Burn away if shields drop"
        },
        summary: "Good matchup with proper kiting"
      });

      const parsed = aiAnalyzer.parseAnalysisResponse(jsonResponse);
      expect(parsed.winChance).to.equal("75%");
      expect(parsed.majorAdvantages).to.be.an('array').with.length(2);
      expect(parsed.tactics).to.be.an('object');
      expect(parsed.tactics.range).to.equal("15-20km");
    });

    it('should handle response with markdown code blocks', () => {
      const markdownResponse = `
\`\`\`json
{
  "winChance": "60%",
  "timeToKill": "30 seconds",
  "majorAdvantages": ["Speed advantage"],
  "majorDisadvantages": ["Weaker tank"],
  "ammoRecommendations": ["Standard ammunition"],
  "moduleRecommendations": ["Use afterburner"],
  "tactics": {
    "range": "5-10km",
    "movement": "Close orbit",
    "engagement": "Rush in fast",
    "disengagement": "Warp out if needed"
  },
  "summary": "Close range brawl"
}
\`\`\`
      `;

      const parsed = aiAnalyzer.parseAnalysisResponse(markdownResponse);
      expect(parsed.winChance).to.equal("60%");
      expect(parsed.majorAdvantages).to.include("Speed advantage");
    });

    it('should return fallback for invalid JSON', () => {
      const invalidResponse = "This is not valid JSON at all";
      const parsed = aiAnalyzer.parseAnalysisResponse(invalidResponse);
      
      expect(parsed.winChance).to.exist;
      expect(parsed.summary).to.include('fallback');
    });

    it('should handle partial JSON responses', () => {
      const partialResponse = `{
        "winChance": "50%",
        "majorAdvantages": ["Some advantage"]
      }`;

      const parsed = aiAnalyzer.parseAnalysisResponse(partialResponse);
      expect(parsed.winChance).to.equal("50%");
      expect(parsed.timeToKill).to.exist; // Should be filled with default
      expect(parsed.tactics).to.exist; // Should be filled with default
    });
  });

  describe('getFallbackAnalysis()', () => {
    it('should generate fallback analysis from stats', () => {
      const currentStats = {
        dps: { total: 250, em: 100, thermal: 150, kinetic: 0, explosive: 0 },
        ehp: { total: 15000, hull: 2000, armor: 8000, shield: 5000 },
        speed: 1200,
        signatureRadius: 40
      };

      const targetStats = {
        dps: { total: 180, em: 0, thermal: 80, kinetic: 100, explosive: 0 },
        ehp: { total: 12000, hull: 1500, armor: 6000, shield: 4500 },
        speed: 800,
        signatureRadius: 120
      };

      const fallback = aiAnalyzer.getFallbackAnalysis(currentStats, targetStats);
      
      expect(fallback.winChance).to.be.a('string');
      expect(fallback.timeToKill).to.be.a('string');
      expect(fallback.majorAdvantages).to.be.an('array');
      expect(fallback.majorDisadvantages).to.be.an('array');
      expect(fallback.summary).to.include('Mathematical analysis');
    });

    it('should calculate time to kill correctly', () => {
      const currentStats = {
        dps: { total: 100 },
        ehp: { total: 10000 },
        speed: 1000,
        signatureRadius: 50
      };

      const targetStats = {
        dps: { total: 200 },
        ehp: { total: 5000 }, // Should take 50 seconds to kill at 100 DPS
        speed: 500,
        signatureRadius: 100
      };

      const fallback = aiAnalyzer.getFallbackAnalysis(currentStats, targetStats);
      expect(fallback.timeToKill).to.include('50');
    });
  });

  describe('markdownToHtml()', () => {
    it('should convert bold markdown to HTML', () => {
      const markdown = "This is **bold text** and normal text";
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<strong>bold text</strong>');
    });

    it('should convert italic markdown to HTML', () => {
      const markdown = "This is *italic text* and normal text";
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<em>italic text</em>');
    });

    it('should convert code blocks to HTML', () => {
      const markdown = "Use `this command` to execute";
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<code>this command</code>');
    });

    it('should handle newlines correctly', () => {
      const markdown = "Line 1\\nLine 2\\nLine 3";
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<br>');
    });

    it('should handle multiple formatting types', () => {
      const markdown = "**Bold** and *italic* with `code`";
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<strong>Bold</strong>');
      expect(html).to.include('<em>italic</em>');
      expect(html).to.include('<code>code</code>');
    });
  });

  describe('weaponClassification()', () => {
    it('should classify weapon types correctly', () => {
      expect(aiAnalyzer.weaponClassification('125mm Railgun II')).to.equal('HYBRID_TURRET');
      expect(aiAnalyzer.weaponClassification('Light Pulse Laser II')).to.equal('ENERGY_TURRET');
      expect(aiAnalyzer.weaponClassification('425mm AutoCannon II')).to.equal('PROJECTILE_TURRET');
      expect(aiAnalyzer.weaponClassification('Light Missile Launcher II')).to.equal('MISSILE_LAUNCHER');
      expect(aiAnalyzer.weaponClassification('Heavy Assault Missile Launcher II')).to.equal('MISSILE_LAUNCHER');
    });

    it('should classify capital weapons', () => {
      expect(aiAnalyzer.weaponClassification('Quad Mega Pulse Laser II')).to.equal('HAW_CAPITAL');
      expect(aiAnalyzer.weaponClassification('Dual Giga Pulse Laser II')).to.equal('HAW_CAPITAL');
      expect(aiAnalyzer.weaponClassification('3500mm Railgun I')).to.equal('HAW_CAPITAL');
      expect(aiAnalyzer.weaponClassification('XL Torpedo Launcher I')).to.equal('HAW_CAPITAL');
    });

    it('should handle unknown weapons', () => {
      expect(aiAnalyzer.weaponClassification('Unknown Weapon System')).to.be.null;
      expect(aiAnalyzer.weaponClassification('')).to.be.null;
      expect(aiAnalyzer.weaponClassification(null)).to.be.null;
    });
  });

  describe('getCargoAmmoAnalysis()', () => {
    it('should analyze cargo ammo usage', () => {
      const statsWithCargoAmmo = {
        _cargoAmmoUsed: [
          {
            weapon: 'Light Missile Launcher II',
            ammo: 'Scourge Light Missile',
            damage: { em: 80, thermal: 0, kinetic: 0, explosive: 0 }
          },
          {
            weapon: '125mm Railgun II',
            ammo: 'Antimatter Charge S',
            damage: { em: 0, thermal: 50, kinetic: 100, explosive: 0 }
          }
        ]
      };

      const analysis = aiAnalyzer.getCargoAmmoAnalysis(statsWithCargoAmmo, {});
      expect(analysis).to.include('UNLOADED WEAPONS STATUS');
      expect(analysis).to.include('Light Missile Launcher II');
      expect(analysis).to.include('Scourge Light Missile');
      expect(analysis).to.include('125mm Railgun II');
      expect(analysis).to.include('Antimatter Charge S');
    });

    it('should return empty string when no cargo ammo used', () => {
      const statsWithoutCargoAmmo = {};
      const analysis = aiAnalyzer.getCargoAmmoAnalysis(statsWithoutCargoAmmo, {});
      expect(analysis).to.equal('');
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle missing or malformed ship data gracefully', () => {
      const malformedShipData = {
        fit: {
          shipType: null,
          modules: {}
        },
        stats: {}
      };

      // Should not throw errors
      expect(() => aiAnalyzer.getFallbackAnalysis({}, {})).to.not.throw();
      expect(() => aiAnalyzer.parseAnalysisResponse('')).to.not.throw();
    });

    it('should handle empty arrays and objects', () => {
      const emptyStats = {
        dps: { total: 0, em: 0, thermal: 0, kinetic: 0, explosive: 0 },
        ehp: { total: 0, hull: 0, armor: 0, shield: 0 },
        speed: 0,
        signatureRadius: 0
      };

      const fallback = aiAnalyzer.getFallbackAnalysis(emptyStats, emptyStats);
      expect(fallback).to.be.an('object');
      expect(fallback.winChance).to.be.a('string');
    });
  });

  describe('damage type analysis', () => {
    it('should analyze damage type effectiveness', () => {
      const currentStats = {
        dps: { total: 200, em: 200, thermal: 0, kinetic: 0, explosive: 0 }
      };
      const targetStats = {
        resistances: { em: 0.2, thermal: 0.5, kinetic: 0.7, explosive: 0.8 }
      };

      const fallback = aiAnalyzer.getFallbackAnalysis(currentStats, targetStats);
      // Should recognize EM damage advantage against low EM resistance
      expect(fallback.majorAdvantages).to.be.an('array');
      expect(fallback.summary).to.be.a('string');
    });
  });
});