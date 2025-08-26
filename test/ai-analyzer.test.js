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
        winChance: '75%',
        timeToKill: '45 seconds',
        majorAdvantages: ['Superior range', 'Better tracking'],
        majorDisadvantages: ['Lower tank'],
        ammoRecommendations: ['Use Barrage for range'],
        moduleRecommendations: ['Activate MWD early'],
        tactics: {
          range: '15-20km',
          movement: 'Orbit at speed',
          engagement: 'Open at long range',
          disengagement: 'Burn away if shields drop'
        },
        summary: 'Good matchup with proper kiting'
      });

      const parsed = aiAnalyzer.parseAnalysisResponse(jsonResponse);
      expect(parsed.winChance).to.equal('75%');
      expect(parsed.majorAdvantages).to.be.an('array').with.length(2);
      expect(parsed.tactics).to.be.an('object');
      expect(parsed.tactics.range).to.equal('15-20km');
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
      expect(parsed.winChance).to.equal('60%');
      expect(parsed.majorAdvantages).to.include('Speed advantage');
    });

    it('should return fallback for invalid JSON', () => {
      const invalidResponse = 'This is not valid JSON at all';
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
      expect(parsed.winChance).to.equal('50%');
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
      const markdown = 'This is **bold text** and normal text';
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<strong>bold text</strong>');
    });

    it('should convert italic markdown to HTML', () => {
      const markdown = 'This is *italic text* and normal text';
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<em>italic text</em>');
    });

    it('should convert code blocks to HTML', () => {
      const markdown = 'Use `this command` to execute';
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<code>this command</code>');
    });

    it('should handle newlines correctly', () => {
      const markdown = 'Line 1\nLine 2\nLine 3';
      const html = aiAnalyzer.markdownToHtml(markdown);
      expect(html).to.include('<br>');
    });

    it('should handle multiple formatting types', () => {
      const markdown = '**Bold** and *italic* with `code`';
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

  describe('range analysis functionality', () => {
    describe('isEWARModule()', () => {
      it('should identify energy neutralizers', () => {
        const neutModule = { name: 'Small Infectious Scoped Energy Neutralizer' };
        expect(aiAnalyzer.isEWARModule(neutModule)).to.be.true;
      });

      it('should identify scramblers', () => {
        const scramModule = { name: 'Warp Scrambler II' };
        expect(aiAnalyzer.isEWARModule(scramModule)).to.be.true;
      });

      it('should identify webs', () => {
        const webModule = { name: 'Stasis Webifier II' };
        expect(aiAnalyzer.isEWARModule(webModule)).to.be.true;
      });

      it('should identify sensor dampeners', () => {
        const dampModule = { name: 'Remote Sensor Dampener II' };
        expect(aiAnalyzer.isEWARModule(dampModule)).to.be.true;
      });

      it('should identify tracking disruptors', () => {
        const tdModule = { name: 'Remote Tracking Disruptor II' };
        expect(aiAnalyzer.isEWARModule(tdModule)).to.be.true;
      });

      it('should identify missile guidance disruptors', () => {
        const mgdModule = { name: 'Missile Guidance Disruptor II' };
        expect(aiAnalyzer.isEWARModule(mgdModule)).to.be.true;
      });

      it('should identify ECM modules', () => {
        const ecmModule = { name: 'Multispectral ECM II' };
        expect(aiAnalyzer.isEWARModule(ecmModule)).to.be.true;
      });

      it('should identify target painters', () => {
        const tpModule = { name: 'Remote Target Painter II' };
        expect(aiAnalyzer.isEWARModule(tpModule)).to.be.true;
      });

      it('should identify racial ECM modules', () => {
        const ladarModule = { name: 'Ladar ECM II' };
        const radarModule = { name: 'Radar ECM II' };
        const magnetometricModule = { name: 'Magnetometric ECM II' };
        const gravimetricModule = { name: 'Gravimetric ECM II' };

        expect(aiAnalyzer.isEWARModule(ladarModule)).to.be.true;
        expect(aiAnalyzer.isEWARModule(radarModule)).to.be.true;
        expect(aiAnalyzer.isEWARModule(magnetometricModule)).to.be.true;
        expect(aiAnalyzer.isEWARModule(gravimetricModule)).to.be.true;
      });

      it('should not identify weapons as EWAR', () => {
        const weaponModule = { name: 'Light Missile Launcher II' };
        expect(aiAnalyzer.isEWARModule(weaponModule)).to.be.false;
      });

      it('should not identify passive modules as EWAR', () => {
        const shieldModule = { name: 'Large Shield Extender II' };
        const armorModule = { name: 'Energized Adaptive Nano Membrane II' };
        expect(aiAnalyzer.isEWARModule(shieldModule)).to.be.false;
        expect(aiAnalyzer.isEWARModule(armorModule)).to.be.false;
      });
    });

    describe('getRangeBonus()', () => {
      it('should identify missile guidance computer', async () => {
        const mgcModule = { name: 'Missile Guidance Computer II' };
        const bonus = await aiAnalyzer.getRangeBonus(mgcModule);
        expect(bonus).to.include('RANGE BOOST');
        expect(bonus).to.include('missile range');
      });

      it('should identify tracking computer', async () => {
        const tcModule = { name: 'Tracking Computer II' };
        const bonus = await aiAnalyzer.getRangeBonus(tcModule);
        expect(bonus).to.include('RANGE BOOST');
        expect(bonus).to.include('turret range');
      });

      it('should identify range rigs', async () => {
        const rigModule = { name: 'Medium Ionic Field Projector II' };
        const bonus = await aiAnalyzer.getRangeBonus(rigModule);
        expect(bonus).to.include('PASSIVE RANGE BOOST');
        expect(bonus).to.include('missile range');
      });

      it('should return null for non-range modules', async () => {
        const tankModule = { name: 'Large Shield Extender II' };
        const bonus = await aiAnalyzer.getRangeBonus(tankModule);
        expect(bonus).to.be.null;
      });
    });

    describe('getScriptAnalysis()', () => {
      it('should analyze missile range scripts', async () => {
        const cargo = [
          { name: 'Missile Range Script', quantity: 1 },
          { name: 'Missile Precision Script', quantity: 1 }
        ];
        const analysis = await aiAnalyzer.getScriptAnalysis(cargo, null);
        expect(analysis).to.include('AVAILABLE SCRIPTS');
        expect(analysis).to.include('MISSILE RANGE SCRIPT');
        expect(analysis).to.include('MISSILE PRECISION SCRIPT');
        expect(analysis).to.include('missile range when loaded');
      });

      it('should analyze tracking scripts', async () => {
        const cargo = [
          { name: 'Optimal Range Script', quantity: 1 },
          { name: 'Tracking Speed Script', quantity: 1 }
        ];
        const analysis = await aiAnalyzer.getScriptAnalysis(cargo, null);
        expect(analysis).to.include('Optimal Range Script');
        expect(analysis).to.include('Tracking Speed Script');
      });

      it('should return empty string for no scripts', async () => {
        const cargo = [
          { name: 'Nova Fury Heavy Missile', quantity: 500 },
          { name: 'Nanite Repair Paste', quantity: 25 }
        ];
        const analysis = await aiAnalyzer.getScriptAnalysis(cargo, null);
        expect(analysis).to.equal('');
      });
    });

    describe('getWeaponAttributes() with EWAR', () => {
      it('should extract range from EWAR modules', async () => {
        const neutModule = {
          name: 'Small Infectious Scoped Energy Neutralizer',
          group_id: 71, // Energy Neutralizer group
          attributes: [
            { attributeID: 769, value: 6000 }, // 6km optimal range
            { attributeID: 517, value: 2000 }  // 2km falloff
          ]
        };

        const mockStaticData = {
          isTurretWeapon: () => false,
          isMissileWeapon: () => false
        };

        const attributes = await aiAnalyzer.getWeaponAttributes(neutModule, mockStaticData);
        expect(attributes).to.not.be.null;
        expect(attributes.optimalRange).to.equal(6000);
        expect(attributes.falloff).to.equal(2000);
      });
    });

    describe('missile range calculation', () => {
      it('should calculate range from flight time and velocity', async () => {
        const missileModule = {
          name: 'Heavy Missile Launcher II',
          group_id: 507, // Heavy Missile Launcher group
          attributes: [
            { attributeID: 858, value: 3750 }, // maxVelocity (m/s)
            { attributeID: 859, value: 15000 } // flightTime (ms)
          ]
        };

        const mockStaticData = {
          isTurretWeapon: () => false,
          isMissileWeapon: () => true
        };

        const attributes = await aiAnalyzer.getWeaponAttributes(missileModule, mockStaticData);
        expect(attributes).to.not.be.null;
        expect(attributes.maxRange).to.be.approximately(56250, 1); // 15s * 3750 m/s = 56,250m
      });

      it('should use direct max range if available', async () => {
        const missileModule = {
          name: 'Heavy Missile Launcher II',
          group_id: 507,
          attributes: [
            { attributeID: 89, value: 50000 }, // direct maxRange (50km)
            { attributeID: 858, value: 3750 },
            { attributeID: 859, value: 15000 }
          ]
        };

        const mockStaticData = {
          isTurretWeapon: () => false,
          isMissileWeapon: () => true
        };

        const attributes = await aiAnalyzer.getWeaponAttributes(missileModule, mockStaticData);
        expect(attributes).to.not.be.null;
        expect(attributes.maxRange).to.equal(50000); // Should use direct value
      });
    });
  });

  describe('range tactical analysis', () => {
    it('should include range strategy in prompt building', async () => {
      // Mock the static data and ensureStaticData
      aiAnalyzer.staticData = {
        searchItemByName: async (name) => ({
          name: name,
          group_name: 'Test Group',
          attributes: []
        }),
        isTurretWeapon: () => false,
        isMissileWeapon: () => false
      };

      const mockCurrentShipData = {
        fit: {
          shipName: 'Osprey Navy Issue',
          fitName: 'Test Fit',
          modules: {
            high: [{ name: 'Heavy Missile Launcher II' }],
            med: [{ name: 'Missile Guidance Computer II' }],
            low: [{ name: 'Ballistic Control System II' }],
            rig: [{ name: 'Medium Ionic Field Projector II' }]
          },
          drones: [],
          cargo: [{ name: 'Missile Range Script', quantity: 1 }]
        },
        stats: {
          dps: { total: 200, em: 0, thermal: 200, kinetic: 0, explosive: 0 },
          ehp: { total: 25000, hull: 5000, armor: 8000, shield: 12000 },
          speed: 1200,
          signatureRadius: 150,
          scanResolution: 250,
          lockRange: 60000
        }
      };

      const mockTargetShipData = {
        fit: {
          shipName: 'Manticore',
          fitName: 'Target Fit',
          modules: { high: [], med: [], low: [], rig: [] },
          drones: [],
          cargo: []
        },
        stats: {
          dps: { total: 100, em: 0, thermal: 0, kinetic: 0, explosive: 100 },
          ehp: { total: 8000, hull: 2000, armor: 2000, shield: 4000 },
          speed: 2000,
          signatureRadius: 35,
          scanResolution: 800,
          lockRange: 80000
        }
      };

      const prompt = await aiAnalyzer.buildCombatAnalysisPrompt(mockCurrentShipData, mockTargetShipData);

      // Check that range analysis guidance is included
      expect(prompt).to.include('RANGE ANALYSIS AND ENGAGEMENT STRATEGY');
      expect(prompt).to.include('KITING STRATEGY');
      expect(prompt).to.include('BRAWLING STRATEGY');
      expect(prompt).to.include('EWAR MODULE RANGE LIMITATIONS');
      expect(prompt).to.include('RANGE-BOOSTING MODULES ANALYSIS');
      expect(prompt).to.include('AVAILABLE SCRIPTS');
      expect(prompt).to.include('Missile Range Script');
      expect(prompt).to.include('RANGE BOOST');
    });

    it('should include comprehensive EWAR analysis in prompt', async () => {
      // Mock the staticData dependency
      aiAnalyzer.staticData = {
        searchItemByName: async (name) => ({ name, typeID: 123, groupID: 1 })
      };
      const mockCurrentShipData = {
        fit: {
          shipName: 'Caracal',
          fitName: 'Test Fit',
          modules: {
            high: [{ name: 'Heavy Missile Launcher II' }],
            med: [{ name: 'Remote Sensor Dampener II' }],
            low: [{ name: 'Ballistic Control System II' }],
            rig: []
          },
          drones: [{ name: 'Hobgoblin SD-300', quantity: 5 }],
          cargo: []
        },
        stats: {
          dps: { total: 200, em: 0, thermal: 200, kinetic: 0, explosive: 0 },
          ehp: { total: 25000, hull: 5000, armor: 8000, shield: 12000 },
          speed: 1200,
          signatureRadius: 150,
          scanResolution: 250,
          lockRange: 60000
        }
      };

      const mockTargetShipData = {
        fit: {
          shipName: 'Rupture',
          fitName: 'Target Fit',
          modules: {
            high: [{ name: '720mm Howitzer Artillery II' }],
            med: [{ name: 'Remote Tracking Disruptor II' }],
            low: [],
            rig: []
          },
          drones: [{ name: 'Acolyte TD-300', quantity: 3 }],
          cargo: []
        },
        stats: {
          dps: { total: 150, em: 100, thermal: 0, kinetic: 0, explosive: 50 },
          ehp: { total: 18000, hull: 4000, armor: 6000, shield: 8000 },
          speed: 1500,
          signatureRadius: 125,
          scanResolution: 300,
          lockRange: 50000
        }
      };

      const prompt = await aiAnalyzer.buildCombatAnalysisPrompt(mockCurrentShipData, mockTargetShipData);

      // Check that comprehensive EWAR analysis is included
      expect(prompt).to.include('COMPREHENSIVE EWAR ANALYSIS AND COUNTER-STRATEGIES');
      expect(prompt).to.include('SENSOR DAMPENING');
      expect(prompt).to.include('TRACKING DISRUPTION');
      expect(prompt).to.include('MISSILE GUIDANCE DISRUPTION');
      expect(prompt).to.include('ECM JAMMING');
      expect(prompt).to.include('TARGET PAINTING');
      expect(prompt).to.include('COMBINED EWAR STRATEGIES');
      expect(prompt).to.include('EXTREME RANGE KITING STRATEGY');
      expect(prompt).to.include('EWAR IDENTIFICATION AND ENGAGEMENT ADAPTATION');

      // Check specific EWAR drones are documented
      expect(prompt).to.include('Hobgoblin SD-300/600');
      expect(prompt).to.include('Acolyte TD-300/600');
      expect(prompt).to.include('Sensor Dampening drone');
      expect(prompt).to.include('Tracking Disruption drone');

      // Check that script variations are documented
      expect(prompt).to.include('SCANNING RESOLUTION SCRIPT');
      expect(prompt).to.include('TARGETING RANGE SCRIPT');
      expect(prompt).to.include('TRACKING SPEED SCRIPT');
      expect(prompt).to.include('OPTIMAL RANGE SCRIPT');
      expect(prompt).to.include('MISSILE PRECISION DISRUPTION SCRIPT');
      expect(prompt).to.include('MISSILE RANGE DISRUPTION SCRIPT');
      expect(prompt).to.include('UNSCRIPTED STRATEGY');
    });
  });

  describe('EWAR script analysis', () => {
    it('should analyze EWAR scripts in cargo and provide recommendations', () => {
      const mockCurrentFit = {
        modules: {
          high: [],
          med: [
            { name: 'Remote Sensor Dampener II' },
            { name: 'Remote Tracking Disruptor II' }
          ],
          low: [],
          cargo: [
            { name: 'Targeting Range Dampening Script', quantity: 2 },
            { name: 'Scan Resolution Dampening Script', quantity: 2 },
            { name: 'Optimal Range Disruption Script', quantity: 2 },
            { name: 'Tracking Speed Disruption Script', quantity: 2 }
          ]
        }
      };

      const mockTargetFit = {
        shipName: 'Caracal',
        modules: {
          high: [
            { name: 'Heavy Missile Launcher II' },
            { name: 'Heavy Missile Launcher II' }
          ]
        }
      };

      const analysis = aiAnalyzer.getEwarScriptAnalysis(mockCurrentFit, mockTargetFit);

      expect(analysis).to.include('EWAR SCRIPT TACTICAL ANALYSIS');
      expect(analysis).to.include('Remote Sensor Dampener II');
      expect(analysis).to.include('Remote Tracking Disruptor II');
      expect(analysis).to.include('Targeting Range Dampening Script');
      expect(analysis).to.include('SCRIPT SELECTION RECOMMENDATIONS');
    });

    it('should classify EWAR scripts correctly', () => {
      const targetRangeScript = aiAnalyzer.classifyEwarScript('Targeting Range Dampening Script');
      const trackingScript = aiAnalyzer.classifyEwarScript('Tracking Speed Disruption Script');
      const precisionScript = aiAnalyzer.classifyEwarScript('Missile Precision Disruption Script');
      const rangeScript = aiAnalyzer.classifyEwarScript('Missile Range Disruption Script');

      expect(targetRangeScript.description).to.include('lock range dramatically');
      expect(targetRangeScript.tactical).to.include('long-range ships');

      expect(trackingScript.description).to.include('tracking speed');
      expect(trackingScript.tactical).to.include('fast ships');

      expect(precisionScript.description).to.include('explosion velocity AND radius');
      expect(precisionScript.tactical).to.include('small, fast ships');

      expect(rangeScript.description).to.include('missile velocity AND flight time');
      expect(rangeScript.tactical).to.include('long-range missile ships');
    });

    it('should provide script recommendations based on target analysis', () => {
      // Test vs missile ship
      const missileTargetFit = {
        shipName: 'Caracal',
        modules: {
          high: [
            { name: 'Heavy Missile Launcher II' },
            { name: 'Heavy Missile Launcher II' }
          ]
        }
      };

      const missileScripts = [
        { name: 'Missile Precision Disruption Script' },
        { name: 'Missile Range Disruption Script' }
      ];

      const missileRecommendations = aiAnalyzer.getScriptRecommendations(missileScripts, missileTargetFit);
      expect(missileRecommendations).to.include('PRECISION');

      // Test vs turret ship
      const turretTargetFit = {
        shipName: 'Maller',
        modules: {
          high: [
            { name: 'Focused Pulse Laser II' },
            { name: 'Focused Pulse Laser II' }
          ]
        }
      };

      const turretScripts = [
        { name: 'Optimal Range Disruption Script' },
        { name: 'Tracking Speed Disruption Script' }
      ];

      const turretRecommendations = aiAnalyzer.getScriptRecommendations(turretScripts, turretTargetFit);
      expect(turretRecommendations).to.include('OPTIMAL RANGE DISRUPTION');
    });

    it('should identify target ship characteristics correctly', () => {
      const longRangeShip = {
        modules: {
          high: [{ name: 'Heavy Beam Laser II' }, { name: 'Cruise Missile Launcher II' }]
        }
      };

      const turretShip = {
        modules: {
          high: [{ name: 'Neutron Blaster Cannon II' }]
        }
      };

      const missileShip = {
        modules: {
          high: [{ name: 'Heavy Missile Launcher II' }]
        }
      };

      expect(aiAnalyzer.hasLongRangeWeapons(longRangeShip)).to.be.true;
      expect(aiAnalyzer.hasTurretWeapons(turretShip)).to.be.true;
      expect(aiAnalyzer.hasMissileWeapons(missileShip)).to.be.true;
      expect(aiAnalyzer.isSmallShip('Merlin')).to.be.true;
      expect(aiAnalyzer.isSmallShip('Caracal')).to.be.false;
      expect(aiAnalyzer.isFastShip('Interceptor')).to.be.true;
      expect(aiAnalyzer.isFastShip('Battleship')).to.be.false;
    });

    it('should handle fits with no EWAR modules', () => {
      const mockFit = {
        modules: {
          high: [{ name: 'Heavy Missile Launcher II' }],
          med: [{ name: '50MN Microwarpdrive II' }],
          low: [{ name: 'Damage Control II' }],
          cargo: [{ name: 'Targeting Range Dampening Script' }, { name: 'Missile Precision Disruption Script' }]
        }
      };

      const analysis = aiAnalyzer.getEwarScriptAnalysis(mockFit, mockFit);
      expect(analysis).to.equal('');
    });

    it('should handle fits with no scripts in cargo', () => {
      const mockFit = {
        modules: {
          high: [],
          med: [{ name: 'Remote Sensor Dampener II' }],
          low: [],
          cargo: [{ name: 'Heavy Missile' }]
        }
      };

      const analysis = aiAnalyzer.getEwarScriptAnalysis(mockFit, mockFit);
      expect(analysis).to.equal('');
    });
  });

  describe('calculated weapon performance formatting', () => {
    it('should format calculated weapon stats with range information', () => {
      const mockStats = {
        weapons: [
          {
            name: 'Heavy Missile Launcher II',
            dps: 125.5,
            range: 95000, // 95km - should get EXTREME LONG RANGE marker
            velocity: 4500,
            flightTime: 21100
          },
          {
            name: '425mm AutoCannon II',
            dps: 180.2,
            optimalRange: 12000, // 12km
            falloff: 18000, // 18km
            trackingSpeed: 0.125
          }
        ]
      };

      const formatted = aiAnalyzer.formatCalculatedWeaponStats(mockStats);

      expect(formatted).to.include('Heavy Missile Launcher II');
      expect(formatted).to.include('125.5 DPS');
      expect(formatted).to.include('ACTUAL RANGE: 95.0km');
      expect(formatted).to.include('⭐ EXTREME LONG RANGE');
      expect(formatted).to.include('4500 m/s velocity');

      expect(formatted).to.include('425mm AutoCannon II');
      expect(formatted).to.include('180.2 DPS');
      expect(formatted).to.include('12.0km optimal');
      expect(formatted).to.include('18.0km falloff');
      expect(formatted).to.include('0.13 tracking');
    });

    it('should handle weapons with no calculated stats', () => {
      const mockStats = { weapons: [] };
      const formatted = aiAnalyzer.formatCalculatedWeaponStats(mockStats);
      expect(formatted).to.equal('- No weapons detected');
    });

    it('should mark long-range weapons appropriately', () => {
      const mockStats = {
        weapons: [
          { name: 'Short Range Weapon', dps: 100, range: 25000 }, // 25km - no marker
          { name: 'Long Range Weapon', dps: 80, range: 65000 },   // 65km - LONG RANGE marker
          { name: 'Extreme Range Weapon', dps: 60, range: 105000 } // 105km - EXTREME LONG RANGE marker
        ]
      };

      const formatted = aiAnalyzer.formatCalculatedWeaponStats(mockStats);

      expect(formatted).to.include('Short Range Weapon');
      expect(formatted).to.not.include('Short Range Weapon → 100.0 DPS → ACTUAL RANGE: 25.0km ⭐');

      expect(formatted).to.include('Long Range Weapon');
      expect(formatted).to.include('⭐ LONG RANGE');

      expect(formatted).to.include('Extreme Range Weapon');
      expect(formatted).to.include('⭐ EXTREME LONG RANGE');
    });
  });

  describe('EWAR drone classification', () => {
    it('should classify ECM drones correctly', () => {
      const hornetECM = { name: 'Hornet EC-300', quantity: 5 };
      const waspECM = { name: 'Wasp EC-600', quantity: 3 };

      const hornetClassification = aiAnalyzer.classifyDrone(hornetECM);
      const waspClassification = aiAnalyzer.classifyDrone(waspECM);

      expect(hornetClassification).to.include('ECM drone');
      expect(waspClassification).to.include('ECM drone');
    });

    it('should classify tracking disruption drones correctly', () => {
      const acolyteTD = { name: 'Acolyte TD-300', quantity: 5 };
      const infiltratorTD = { name: 'Infiltrator TD-600', quantity: 3 };

      const acolyteClassification = aiAnalyzer.classifyDrone(acolyteTD);
      const infiltratorClassification = aiAnalyzer.classifyDrone(infiltratorTD);

      expect(acolyteClassification).to.include('Tracking Disruption');
      expect(infiltratorClassification).to.include('Tracking Disruption');
    });

    it('should classify sensor dampening drones correctly', () => {
      const hobgoblinSD = { name: 'Hobgoblin SD-300', quantity: 5 };
      const hammerheadSD = { name: 'Hammerhead SD-600', quantity: 3 };

      const hobgoblinClassification = aiAnalyzer.classifyDrone(hobgoblinSD);
      const hammerheadClassification = aiAnalyzer.classifyDrone(hammerheadSD);

      expect(hobgoblinClassification).to.include('Sensor Dampening');
      expect(hammerheadClassification).to.include('Sensor Dampening');
    });

    it('should classify target painting drones correctly', () => {
      const warriorTP = { name: 'Warrior TP-300', quantity: 5 };
      const valkyrieTP = { name: 'Valkyrie TP-600', quantity: 3 };

      const warriorClassification = aiAnalyzer.classifyDrone(warriorTP);
      const valkyrieClassification = aiAnalyzer.classifyDrone(valkyrieTP);

      expect(warriorClassification).to.include('Target Painting');
      expect(valkyrieClassification).to.include('Target Painting');
    });

    it('should classify missile guidance disruption drones correctly', () => {
      const hobgoblinGD = { name: 'Hobgoblin GD-300', quantity: 5 };
      const hammerheadGD = { name: 'Hammerhead GD-600', quantity: 3 };

      const hobgoblinClassification = aiAnalyzer.classifyDrone(hobgoblinGD);
      const hammerheadClassification = aiAnalyzer.classifyDrone(hammerheadGD);

      expect(hobgoblinClassification).to.include('Missile Guidance Disruption');
      expect(hammerheadClassification).to.include('Missile Guidance Disruption');
    });

    it('should still classify combat drones correctly', () => {
      const warrior = { name: 'Warrior II', quantity: 5 };
      const hobgoblin = { name: 'Hobgoblin II', quantity: 5 };

      const warriorClassification = aiAnalyzer.classifyDrone(warrior);
      const hobgoblinClassification = aiAnalyzer.classifyDrone(hobgoblin);

      expect(warriorClassification).to.include('EXPLOSIVE damage');
      expect(hobgoblinClassification).to.include('THERMAL damage');
    });
  });
});
