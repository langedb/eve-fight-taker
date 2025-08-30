const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator');
const { StaticData } = require('../lib/static-data');
const { AIAnalyzer } = require('../lib/ai-analyzer');

describe('Drone Deployment Limits', () => {
  let staticData, fitCalculator, aiAnalyzer;

  before(async () => {
    staticData = new StaticData();
    await staticData.loadStaticData();
    fitCalculator = new FitCalculator(staticData);

    // Create AIAnalyzer with dummy API key for testing drone logic
    aiAnalyzer = new AIAnalyzer('test-key-for-drone-testing');
  });

  describe('5-Drone Active Limit Enforcement', () => {
    it('should recommend deploying all drones when <= 5 total', async () => {
      const testFit = `[Vexor, Drone Test Small]
Damage Control II

Large Shield Extender II

Light Neutron Blaster II

Warrior II x3
Hobgoblin II x2
`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const droneText = await aiAnalyzer.formatDroneList(parsedFit.drones, staticData);

      // Should recommend deploying all 5 drones
      expect(droneText).to.include('Deploy all 5 drones');
      expect(droneText).to.include('within 5-drone limit');
    });

    it('should provide deployment options when > 5 drones available', async () => {
      const testFit = `[Vexor Navy Issue, Drone Test Large]
Damage Control II

Large Shield Extender II

Heavy Neutron Blaster II

Berserker II x2
Warrior II x5
Hornet EC-300 x10
`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const droneText = await aiAnalyzer.formatDroneList(parsedFit.drones, staticData);

      // Should show deployment options
      expect(droneText).to.include('DEPLOYMENT OPTIONS');
      expect(droneText).to.include('5-drone limit');
      expect(droneText).to.include('MAX DPS OPTION');
      expect(droneText).to.include('EWAR OPTION');
    });

    it('should distinguish combat vs EWAR drones in deployment strategies', async () => {
      const testFit = `[Vexor Navy Issue, Mixed Drones]
Damage Control II

Large Shield Extender II

Heavy Neutron Blaster II

Hammerhead II x5
Hornet EC-300 x5
`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const droneText = await aiAnalyzer.formatDroneList(parsedFit.drones, staticData);

      // Should provide both combat-focused and EWAR-focused options
      expect(droneText).to.include('MAX DPS OPTION');
      expect(droneText).to.include('combat drones');
      expect(droneText).to.include('EWAR OPTION');
      expect(droneText).to.include('EWAR drones');
    });

    it('should handle mixed deployment when limited combat drones', async () => {
      const testFit = `[Caracal, Limited Combat Drones]
Damage Control II

Large Shield Extender II

Heavy Missile Launcher II

Warrior II x2
Hornet EC-300 x8
`;

      const parsedFit = await fitCalculator.parseEFT(testFit);
      const droneText = await aiAnalyzer.formatDroneList(parsedFit.drones, staticData);

      // Should suggest mixed deployment
      expect(droneText).to.include('MIXED OPTION');
      expect(droneText).to.include('2 combat + 3 EWAR');
    });
  });

  describe('Drone Bandwidth Calculations', () => {
    it('should correctly identify EWAR drones', async () => {
      const testDrones = [
        { name: 'Hornet EC-300', quantity: 5 },
        { name: 'Vespa TD-300', quantity: 3 },
        { name: 'Warrior II', quantity: 2 }
      ];

      const deploymentOptions = await aiAnalyzer.calculateDroneDeploymentOptions(testDrones, staticData);

      expect(deploymentOptions).to.include('DEPLOYMENT OPTIONS');
      expect(deploymentOptions).to.include('MIXED OPTION'); // Should include mixed option (2 combat + 3 EWAR)
      expect(deploymentOptions).to.include('EWAR OPTION'); // Should include EWAR option
      expect(deploymentOptions).to.include('2 combat + 3 EWAR'); // Verify correct calculation
    });

    it('should get correct bandwidth for different drone types', async () => {
      // Test that bandwidth calculation works for various drone types
      const warrior = await staticData.searchItemByName('Warrior II');
      const hammerhead = await staticData.searchItemByName('Hammerhead II');
      const hornetEC = await staticData.searchItemByName('Hornet EC-300');

      const warriorBandwidth = await aiAnalyzer.getDroneBandwidth(warrior);
      const hammerheadBandwidth = await aiAnalyzer.getDroneBandwidth(hammerhead);
      const hornetBandwidth = await aiAnalyzer.getDroneBandwidth(hornetEC);

      // Light drones should require less bandwidth than medium drones
      expect(warriorBandwidth).to.be.lessThan(hammerheadBandwidth);
      expect(hornetBandwidth).to.be.greaterThan(0); // EWAR drones also have bandwidth
    });
  });

  describe('AI Prompt Integration', () => {
    it('should include 5-drone limit in critical requirements', () => {
      // Read the ai-analyzer.js file content to verify the drone limit text exists
      const fs = require('fs');
      const aiAnalyzerContent = fs.readFileSync('lib/ai-analyzer.js', 'utf8');

      expect(aiAnalyzerContent).to.include('MAXIMUM 5 ACTIVE DRONES');
      expect(aiAnalyzerContent).to.include('maximum of 5 drones simultaneously');
      expect(aiAnalyzerContent).to.include('DEPLOYMENT STRATEGY');
    });
  });
});
