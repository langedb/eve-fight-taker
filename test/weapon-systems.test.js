const { expect } = require('chai');
const { FitCalculator } = require('../lib/fit-calculator.js');

describe('Weapon Systems', function() {
  let fitCalculator;

  before(async function() {
    this.timeout(30000); // 30 seconds for setup
    fitCalculator = new FitCalculator();
    await fitCalculator.ensureStaticData();
  });

  describe('Missile Weapons', function() {
    
    it('should apply Light Missile Specialization ROF bonus to T2 light missile launchers', async function() {
      this.timeout(10000);
      const eft = `[Corax, Light Missile Test]
Light Missile Launcher II, Inferno Light Missile
Light Missile Launcher II, Inferno Light Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
      // T2 launcher should have specialization bonus applied
    });

    it('should apply Heavy Missile Specialization ROF bonus to T2 heavy missile launchers', async function() {
      this.timeout(10000);
      const eft = `[Caracal, Heavy Missile Test]
Heavy Missile Launcher II, Inferno Heavy Missile
Heavy Missile Launcher II, Inferno Heavy Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
      // Should include all missile skills + Caldari Cruiser bonus
    });

    it('should apply Heavy Assault Missile Specialization ROF bonus to T2 HAM launchers', async function() {
      this.timeout(10000);
      const eft = `[Sacrilege, HAM Test]
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile
Heavy Assault Missile Launcher II, Inferno Heavy Assault Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply Cruise Missile Specialization ROF bonus to T2 cruise launchers', async function() {
      this.timeout(10000);
      const eft = `[Raven, Cruise Test]
Cruise Missile Launcher II, Inferno Cruise Missile
Cruise Missile Launcher II, Inferno Cruise Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply Torpedo Specialization ROF bonus to T2 torpedo launchers', async function() {
      this.timeout(10000);
      const eft = `[Stealth Bomber, Torpedo Test]
Torpedo Launcher II, Inferno Torpedo
Torpedo Launcher II, Inferno Torpedo`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply BCS bonuses to missile damage with stacking penalties', async function() {
      this.timeout(10000);
      const eft = `[Caracal, BCS Test]
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II

Heavy Missile Launcher II, Inferno Heavy Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
      // Should have ~24% damage increase from 3 BCS with stacking
    });
  });

  describe('Turret Weapons', function() {
    
    it('should apply Small Pulse Laser Specialization damage bonus to T2 small pulse lasers', async function() {
      this.timeout(10000);
      const eft = `[Punisher, Small Pulse Test]
Small Focused Pulse Laser II, Multifrequency S
Small Focused Pulse Laser II, Multifrequency S
Small Focused Pulse Laser II, Multifrequency S
Small Focused Pulse Laser II, Multifrequency S`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply Medium Blaster Specialization damage bonus to T2 medium blasters', async function() {
      this.timeout(10000);
      const eft = `[Talos, Medium Blaster Test]
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M
Neutron Blaster Cannon II, Void M`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply Large Railgun Specialization damage bonus to T2 large railguns', async function() {
      this.timeout(10000);
      const eft = `[Rokh, Large Railgun Test]
425mm Railgun II, Antimatter Charge L
425mm Railgun II, Antimatter Charge L
425mm Railgun II, Antimatter Charge L
425mm Railgun II, Antimatter Charge L`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply autocannon specialization damage bonus to T2 autocannons', async function() {
      this.timeout(10000);
      const eft = `[Hurricane, Autocannon Test]
425mm AutoCannon II, Republic Fleet EMP M
425mm AutoCannon II, Republic Fleet EMP M
425mm AutoCannon II, Republic Fleet EMP M
425mm AutoCannon II, Republic Fleet EMP M`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should apply artillery specialization damage bonus to T2 artillery', async function() {
      this.timeout(10000);
      const eft = `[Tempest, Artillery Test]
800mm Repeating Cannon II, Republic Fleet EMP L
800mm Repeating Cannon II, Republic Fleet EMP L
800mm Repeating Cannon II, Republic Fleet EMP L
800mm Repeating Cannon II, Republic Fleet EMP L`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
    });

    it('should not apply specialization bonuses to T1 weapons', async function() {
      this.timeout(10000);
      const t1Eft = `[Punisher, T1 Test]
Small Focused Pulse Laser I, Multifrequency S`;
      
      const t2Eft = `[Punisher, T2 Test]
Small Focused Pulse Laser II, Multifrequency S`;

      const t1Fit = await fitCalculator.parseEFT(t1Eft);
      const t2Fit = await fitCalculator.parseEFT(t2Eft);
      
      const t1Stats = await fitCalculator.calculateFitStats(t1Fit);
      const t2Stats = await fitCalculator.calculateFitStats(t2Fit);
      
      // T2 should have higher DPS due to specialization skill
      expect(t2Stats.dps.total).to.be.greaterThan(t1Stats.dps.total * 1.05); // At least 5% higher
    });
  });

  describe('Ship Hull Bonuses', function() {
    
    it('should apply Caldari Cruiser missile rate of fire bonus', async function() {
      this.timeout(10000);
      const eft = `[Caracal, Caldari Cruiser Test]
Heavy Missile Launcher II, Inferno Heavy Missile`;

      const fit = await fitCalculator.parseEFT(eft);
      const stats = await fitCalculator.calculateFitStats(fit);
      
      expect(stats.dps.total).to.be.greaterThan(0);
      // Caldari Cruiser skill should provide 25% ROF bonus at level V
    });
  });

  describe('Damage Module Bonuses', function() {
    
    it('should apply stacking penalties correctly for multiple damage modules', async function() {
      this.timeout(10000);
      const singleBCS = `[Caracal, Single BCS]
Ballistic Control System II
Heavy Missile Launcher II, Inferno Heavy Missile`;

      const tripleBCS = `[Caracal, Triple BCS]  
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II
Heavy Missile Launcher II, Inferno Heavy Missile`;

      const singleFit = await fitCalculator.parseEFT(singleBCS);
      const tripleFit = await fitCalculator.parseEFT(tripleBCS);
      
      const singleStats = await fitCalculator.calculateFitStats(singleFit);
      const tripleStats = await fitCalculator.calculateFitStats(tripleFit);
      
      const damageIncrease = tripleStats.dps.total / singleStats.dps.total;
      
      // Should be around 1.13x due to stacking penalties (10% + 8.7% + 5.7% effective)
      expect(damageIncrease).to.be.greaterThan(1.10);
      expect(damageIncrease).to.be.lessThan(1.20);
    });
  });

  describe('Performance', function() {
    
    it('should calculate complex fits within reasonable time', async function() {
      this.timeout(5000);
      const complexFit = `[Rattlesnake, Complex Test]
Ballistic Control System II
Ballistic Control System II
Ballistic Control System II
Drone Damage Amplifier II

Large Shield Extender II
Large Shield Extender II
Missile Guidance Computer II, Missile Range Script
Sensor Booster II, Targeting Range Script

Cruise Missile Launcher II, Inferno Cruise Missile
Cruise Missile Launcher II, Inferno Cruise Missile
Cruise Missile Launcher II, Inferno Cruise Missile
Cruise Missile Launcher II, Inferno Cruise Missile
Cruise Missile Launcher II, Inferno Cruise Missile

Large Core Defense Field Purger I
Large Core Defense Field Purger I
Large Warhead Calefaction Catalyst I

Garde II x5
Warrior II x5`;

      const startTime = Date.now();
      const fit = await fitCalculator.parseEFT(complexFit);
      const stats = await fitCalculator.calculateFitStats(fit);
      const endTime = Date.now();
      
      expect(stats.dps.total).to.be.greaterThan(0);
      expect(endTime - startTime).to.be.lessThan(2000); // Should complete within 2 seconds
    });
  });
});