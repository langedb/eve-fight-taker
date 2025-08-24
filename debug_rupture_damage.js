const { FitCalculator } = require('./lib/fit-calculator');
const { StaticData } = require('./lib/static-data');
const { FitSimulator } = require('./lib/fit-simulator');

async function debugRuptureDamage() {
    console.log('=== Debugging Rupture DPS Calculation ===');
    
    const staticData = new StaticData();
    await staticData.loadStaticData();
    
    const fitCalculator = new FitCalculator(staticData);
    
    // Test EFT fit for Rupture with 720mm Howitzer Artillery II + Quake M
    const testEFT = `[Rupture, DPS Test]
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II
720mm Howitzer Artillery II

Ballistic Control System I
Ballistic Control System I

Quake M x1000
`;

    try {
        const result = await fitCalculator.parseEFT(testEFT);
        console.log('Parsed EFT successfully');
        console.log('Ship:', result.shipName);
        console.log('Modules:', result.modules ? result.modules.length : 'undefined');
        console.log('Cargo:', result.cargo ? result.cargo.length : 'undefined');
        
        console.log('Full result object:', JSON.stringify(result, null, 2));
        
        // Calculate stats
        const stats = await fitCalculator.calculateShipStats(result);
        
        console.log('\n=== DPS Results ===');
        console.log('Total DPS:', stats.dps.total.toFixed(2));
        console.log('EM DPS:', stats.dps.em.toFixed(2));
        console.log('Thermal DPS:', stats.dps.thermal.toFixed(2));
        console.log('Kinetic DPS:', stats.dps.kinetic.toFixed(2));
        console.log('Explosive DPS:', stats.dps.explosive.toFixed(2));
        
        console.log('\n=== Volley Results ===');
        console.log('Total Volley:', stats.volley.total.toFixed(2));
        console.log('EM Volley:', stats.volley.em.toFixed(2));
        console.log('Thermal Volley:', stats.volley.thermal.toFixed(2));
        console.log('Kinetic Volley:', stats.volley.kinetic.toFixed(2));
        console.log('Explosive Volley:', stats.volley.explosive.toFixed(2));
        
        console.log('\n=== Expected vs Actual ===');
        console.log('Expected DPS: 193.3');
        console.log('Actual DPS:', stats.dps.total.toFixed(2));
        console.log('Gap:', (193.3 - stats.dps.total).toFixed(2), 'DPS');
        console.log('Percentage of expected:', ((stats.dps.total / 193.3) * 100).toFixed(1) + '%');
        
        // Debug individual modules
        console.log('\n=== Module Details ===');
        for (let i = 0; i < result.modules.length; i++) {
            const module = result.modules[i];
            if (module.name.includes('720mm')) {
                console.log(`Module ${i + 1}: ${module.name}`);
                console.log(`  Charge: ${module.charge || 'None'}`);
                console.log(`  State: ${module.state || 'online'}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

debugRuptureDamage();