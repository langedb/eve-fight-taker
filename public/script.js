class EVEFightTaker {
    constructor() {
        this.currentShipStats = null;
        this.targetShipStats = null;
        this.isAuthenticated = false;
        
        this.initializeEventListeners();
        this.checkAuthStatus();
    }

    initializeEventListeners() {
        // Auth buttons
        document.getElementById('login-btn').addEventListener('click', () => {
            window.location.href = '/auth';
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Ship loading
        document.getElementById('load-current-ship').addEventListener('click', () => {
            this.loadCurrentShip();
        });

        // EFT parsing
        document.getElementById('parse-eft').addEventListener('click', () => {
            this.parseEFTFit();
        });

        // Combat analysis
        document.getElementById('analyze-combat').addEventListener('click', () => {
            this.analyzeCombat();
        });
    }

    checkAuthStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        
        if (urlParams.get('authenticated') === 'true') {
            this.showAuthenticated();
        } else if (urlParams.get('error') === 'auth_failed') {
            alert('Authentication failed. Please try again.');
        }
    }

    showAuthenticated() {
        this.isAuthenticated = true;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';
        document.getElementById('load-current-ship').disabled = false;
        
        // Clear URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    logout() {
        // Clear session and refresh page
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                window.location.reload();
            });
    }

    async loadCurrentShip() {
        this.showLoading();
        
        try {
            const response = await fetch('/api/character/ship');
            
            if (!response.ok) {
                throw new Error('Failed to load ship data');
            }
            
            const data = await response.json();
            this.displayCurrentShip(data);
            this.updateAnalysisVisibility();
            
        } catch (error) {
            console.error('Error loading current ship:', error);
            alert('Failed to load current ship. Please ensure you are logged in and in a ship.');
        } finally {
            this.hideLoading();
        }
    }

    displayCurrentShip(shipData) {
        const shipInfo = document.getElementById('current-ship-info');
        const shipName = document.getElementById('current-ship-name');
        const shipStats = document.getElementById('current-ship-stats');

        // Store ship stats
        this.currentShipStats = shipData.stats || this.generateMockStats();
        
        shipName.textContent = shipData.ship?.ship_type_name || 'Current Ship';
        shipStats.innerHTML = this.generateStatsHTML(this.currentShipStats);
        shipInfo.style.display = 'block';
    }

    async parseEFTFit() {
        const eftText = document.getElementById('eft-input').value.trim();
        
        if (!eftText) {
            alert('Please enter an EFT fit to parse.');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/parse-eft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eftText })
            });

            if (!response.ok) {
                throw new Error('Failed to parse EFT fit');
            }

            const data = await response.json();
            this.displayTargetShip(data);
            this.updateAnalysisVisibility();

        } catch (error) {
            console.error('Error parsing EFT fit:', error);
            alert('Failed to parse EFT fit. Please check the format and try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayTargetShip(fitData) {
        const shipInfo = document.getElementById('target-ship-info');
        const shipName = document.getElementById('target-ship-name');
        const shipStats = document.getElementById('target-ship-stats');

        // Store ship stats
        this.targetShipStats = fitData.stats || this.generateMockStats();
        
        shipName.textContent = `${fitData.fit.shipType} - ${fitData.fit.fitName}`;
        shipStats.innerHTML = this.generateStatsHTML(this.targetShipStats);
        shipInfo.style.display = 'block';
    }

    generateStatsHTML(stats) {
        return `
            <div class="stat-item">
                <div class="label">DPS</div>
                <div class="value">${this.formatNumber(stats.dps.total)}</div>
            </div>
            <div class="stat-item">
                <div class="label">EHP</div>
                <div class="value">${this.formatNumber(stats.ehp.total)}</div>
            </div>
            <div class="stat-item">
                <div class="label">Speed</div>
                <div class="value">${this.formatNumber(stats.speed)} m/s</div>
            </div>
            <div class="stat-item">
                <div class="label">Sig Radius</div>
                <div class="value">${this.formatNumber(stats.signatureRadius)} m</div>
            </div>
            <div class="stat-item">
                <div class="label">Scan Res</div>
                <div class="value">${this.formatNumber(stats.scanResolution)} mm</div>
            </div>
            <div class="stat-item">
                <div class="label">Lock Range</div>
                <div class="value">${this.formatKm(stats.lockRange)}</div>
            </div>
        `;
    }

    updateAnalysisVisibility() {
        const analysisSection = document.getElementById('analysis-section');
        if (this.currentShipStats && this.targetShipStats) {
            analysisSection.style.display = 'block';
        } else {
            analysisSection.style.display = 'none';
        }
    }

    async analyzeCombat() {
        if (!this.currentShipStats || !this.targetShipStats) {
            alert('Please load both your current ship and a target ship first.');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/analyze-combat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentFit: { stats: this.currentShipStats },
                    targetFit: { stats: this.targetShipStats }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to analyze combat');
            }

            const analysis = await response.json();
            this.displayAnalysis(analysis.analysis);

        } catch (error) {
            console.error('Error analyzing combat:', error);
            // Use fallback analysis
            const fallbackAnalysis = this.generateFallbackAnalysis();
            this.displayAnalysis(fallbackAnalysis);
        } finally {
            this.hideLoading();
        }
    }

    displayAnalysis(analysis) {
        // Update win chance
        const winPercentage = document.getElementById('win-percentage');
        winPercentage.textContent = `${analysis.winChance}%`;
        winPercentage.style.color = analysis.winChance > 60 ? '#28a745' : 
                                   analysis.winChance > 40 ? '#ffc107' : '#dc3545';

        // Update time to kill
        const ttkValue = document.getElementById('ttk-value');
        ttkValue.textContent = typeof analysis.timeToKill === 'number' ? 
                              `${Math.round(analysis.timeToKill)}s` : analysis.timeToKill;

        // Update advantages
        const advantagesList = document.getElementById('advantages-list');
        advantagesList.innerHTML = '';
        (analysis.majorAdvantages || []).forEach(advantage => {
            const li = document.createElement('li');
            li.textContent = advantage;
            advantagesList.appendChild(li);
        });

        // Update disadvantages
        const disadvantagesList = document.getElementById('disadvantages-list');
        disadvantagesList.innerHTML = '';
        (analysis.majorDisadvantages || []).forEach(disadvantage => {
            const li = document.createElement('li');
            li.textContent = disadvantage;
            disadvantagesList.appendChild(li);
        });

        // Update tactics
        if (analysis.tactics) {
            document.getElementById('tactic-range').textContent = 
                analysis.tactics.range || 'Assess optimal range for your weapons';
            document.getElementById('tactic-movement').textContent = 
                analysis.tactics.movement || 'Maintain good positioning';
            document.getElementById('tactic-engagement').textContent = 
                analysis.tactics.engagement || 'Engage when you have advantage';
            document.getElementById('tactic-disengagement').textContent = 
                analysis.tactics.disengagement || 'Disengage if taking heavy damage';
        }

        // Update summary
        document.getElementById('analysis-summary').textContent = 
            analysis.summary || 'Combat analysis completed. Review tactical recommendations above.';

        // Show results
        document.getElementById('analysis-results').style.display = 'block';
    }

    generateFallbackAnalysis() {
        const dpsRatio = this.currentShipStats.dps.total / (this.targetShipStats.dps.total || 1);
        const ehpRatio = this.currentShipStats.ehp.total / (this.targetShipStats.ehp.total || 1);
        const speedRatio = this.currentShipStats.speed / (this.targetShipStats.speed || 1);
        
        const winChance = Math.max(10, Math.min(90, 
            (dpsRatio * 40) + (ehpRatio * 30) + (speedRatio * 20) + 10
        ));
        
        return {
            winChance: Math.round(winChance),
            timeToKill: Math.round(this.targetShipStats.ehp.total / (this.currentShipStats.dps.total || 1)),
            majorAdvantages: dpsRatio > 1.2 ? ["Higher DPS"] : speedRatio > 1.2 ? ["Speed advantage"] : ["Balanced engagement"],
            majorDisadvantages: dpsRatio < 0.8 ? ["Lower DPS"] : ehpRatio < 0.8 ? ["Lower EHP"] : ["Evenly matched"],
            tactics: {
                range: "Maintain optimal range for your weapon systems",
                movement: speedRatio > 1.2 ? "Use speed advantage to control engagement" : "Focus on tracking and positioning",
                engagement: dpsRatio > 1.2 ? "Engage aggressively" : "Engage cautiously, look for tactical advantage",
                disengagement: "Disengage if taking heavy damage without dealing significant damage in return"
            },
            summary: `Combat analysis shows ${Math.round(winChance)}% estimated win chance. Focus on leveraging your ${dpsRatio > 1.2 ? 'DPS' : speedRatio > 1.2 ? 'speed' : 'positioning'} advantage.`
        };
    }

    generateMockStats() {
        // Generate realistic EVE ship stats for demo purposes
        return {
            dps: {
                total: 150 + Math.random() * 300,
                em: 20 + Math.random() * 50,
                thermal: 30 + Math.random() * 80,
                kinetic: 40 + Math.random() * 90,
                explosive: 25 + Math.random() * 60
            },
            ehp: {
                hull: 1000 + Math.random() * 2000,
                armor: 2000 + Math.random() * 5000,
                shield: 1500 + Math.random() * 4000,
                total: 0
            },
            speed: 200 + Math.random() * 800,
            signatureRadius: 30 + Math.random() * 200,
            scanResolution: 100 + Math.random() * 400,
            lockRange: 20000 + Math.random() * 80000,
            tank: { total: 50 + Math.random() * 200 }
        };
    }

    formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return Math.round(num).toLocaleString();
    }

    formatKm(meters) {
        if (meters >= 1000) {
            return (meters / 1000).toFixed(1) + ' km';
        }
        return Math.round(meters) + ' m';
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EVEFightTaker();
});