const { expect } = require('chai');
const { AIAnalyzer } = require('../lib/ai-analyzer');
const { StaticData } = require('../lib/static-data');

describe('Drone Control Range Calculation', () => {
  let aiAnalyzer, staticData;

  before(async function() {
    this.timeout(10000);
    staticData = await StaticData.getInstance();
    aiAnalyzer = new AIAnalyzer('test-key');
    aiAnalyzer.staticData = staticData;
  });

  describe('calculateDroneControlRange', () => {
    it('should calculate base drone control range with all-V skills', () => {
      const ship = {
        modules: { high: [], med: [], low: [], rig: [] },
        shipName: 'Caracal'
      };
      
      const baseRange = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 20km + Drone Avionics V (+25km) + Advanced Drone Avionics V (+15km) = 60km
      expect(baseRange).to.equal(60);
    });

    it('should add Drone Link Augmentor I bonus (+20km)', () => {
      const ship = {
        modules: {
          high: [{ name: 'Drone Link Augmentor I' }],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + Drone Link Augmentor I (+20km) = 80km
      expect(range).to.equal(80);
    });

    it('should add Drone Link Augmentor II bonus (+24km)', () => {
      const ship = {
        modules: {
          high: [{ name: 'Drone Link Augmentor II' }],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + Drone Link Augmentor II (+24km) = 84km
      expect(range).to.equal(84);
    });

    it('should add multiple Drone Link Augmentors', () => {
      const ship = {
        modules: {
          high: [
            { name: 'Drone Link Augmentor II' },
            { name: 'Drone Link Augmentor I' }
          ],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + DLA II (+24km) + DLA I (+20km) = 104km
      expect(range).to.equal(104);
    });

    it('should add Drone Control Range Augmentor I rig bonus (+15km)', () => {
      const ship = {
        modules: {
          high: [],
          med: [],
          low: [],
          rig: [{ name: 'Medium Drone Control Range Augmentor I' }]
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + rig (+15km) = 75km
      expect(range).to.equal(75);
    });

    it('should add Drone Control Range Augmentor II rig bonus (+20km)', () => {
      const ship = {
        modules: {
          high: [],
          med: [],
          low: [],
          rig: [{ name: 'Large Drone Control Range Augmentor II' }]
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + T2 rig (+20km) = 80km
      expect(range).to.equal(80);
    });

    it('should handle combined modules and rigs', () => {
      const ship = {
        modules: {
          high: [
            { name: 'Drone Link Augmentor II' },
            { name: 'Drone Link Augmentor II' }
          ],
          med: [],
          low: [],
          rig: [
            { name: 'Large Drone Control Range Augmentor II' },
            { name: 'Medium Drone Control Range Augmentor I' }
          ]
        },
        shipName: 'Dominix'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km + 2x DLA II (+48km) + Large T2 rig (+20km) + Medium T1 rig (+15km) = 143km
      expect(range).to.equal(143);
    });

    it('should handle ships with no drone range modules', () => {
      const ship = {
        modules: {
          high: [{ name: 'Heavy Missile Launcher II' }],
          med: [{ name: 'Large Shield Extender II' }],
          low: [{ name: 'Ballistic Control System II' }],
          rig: [{ name: 'Medium Core Defense Field Extender I' }]
        },
        shipName: 'Caracal'
      };
      
      const range = aiAnalyzer.calculateDroneControlRange(ship);
      // Base 60km only (no drone range modules)
      expect(range).to.equal(60);
    });
  });

  describe('formatDroneControlRangeAnalysis', () => {
    it('should format basic drone control range analysis', () => {
      const ship = {
        modules: { high: [], med: [], low: [], rig: [] },
        shipName: 'Caracal'
      };
      
      const analysis = aiAnalyzer.formatDroneControlRangeAnalysis(ship);
      expect(analysis).to.include('DRONE CONTROL RANGE: 60km');
      expect(analysis).to.include('Base: 20km + Skills: 40km');
    });

    it('should format analysis with modules', () => {
      const ship = {
        modules: {
          high: [{ name: 'Drone Link Augmentor II' }],
          med: [],
          low: [],
          rig: [{ name: 'Large Drone Control Range Augmentor II' }]
        },
        shipName: 'Dominix'
      };
      
      const analysis = aiAnalyzer.formatDroneControlRangeAnalysis(ship);
      expect(analysis).to.include('DRONE CONTROL RANGE: 104km');
      expect(analysis).to.include('Modules: +24km');
      expect(analysis).to.include('Rigs: +20km');
    });

    it('should indicate when range is extended beyond default', () => {
      const ship = {
        modules: {
          high: [{ name: 'Drone Link Augmentor I' }],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Dominix'
      };
      
      const analysis = aiAnalyzer.formatDroneControlRangeAnalysis(ship);
      expect(analysis).to.include('EXTENDED RANGE: +20km beyond base skilled range');
    });
  });

  describe('generateDroneRangeTacticalAdvice', () => {
    it('should recommend kiting beyond calculated drone range', () => {
      const targetShip = {
        modules: { high: [], med: [], low: [], rig: [] },
        shipName: 'Rupture'
      };
      
      const advice = aiAnalyzer.generateDroneRangeTacticalAdvice(targetShip, 65);
      expect(advice).to.include('Fight at 65km+');
      expect(advice).to.include('beyond their 60km drone control range');
    });

    it('should warn about extended drone ranges', () => {
      const targetShip = {
        modules: {
          high: [{ name: 'Drone Link Augmentor II' }],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Rupture'
      };
      
      const advice = aiAnalyzer.generateDroneRangeTacticalAdvice(targetShip, 100);
      expect(advice).to.include('TARGET HAS EXTENDED DRONE RANGE');
      expect(advice).to.include('84km drone control range');
      expect(advice).to.include('Fight at 89km+');
    });

    it('should recommend alternative strategies for short-range weapons', () => {
      const targetShip = {
        modules: {
          high: [{ name: 'Drone Link Augmentor II' }],
          med: [],
          low: [],
          rig: []
        },
        shipName: 'Rupture'
      };
      
      const advice = aiAnalyzer.generateDroneRangeTacticalAdvice(targetShip, 25);
      expect(advice).to.include('Your weapons cannot outrange their drones');
      expect(advice).to.include('De-fang strategy recommended');
    });
  });
});