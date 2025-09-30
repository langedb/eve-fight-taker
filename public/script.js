class EVEFightTaker {
    constructor() {
        console.log('EVEFightTaker loaded - version with fleet fixes');
        this.currentShipStats = null;
        this.currentShipFit = null;
        this.targetShipStats = null;
        this.targetShipFit = null;
        this.isAuthenticated = false;
        this.notificationId = 0;

        // Fleet management state
        this.currentTab = 'combat';
        this.currentFleetSection = 'fittings';
        this.fittings = [];
        this.fleets = [];
        this.scenarios = [];
        this.currentFleetComposition = [];
        this.editingFleetId = null;

        this.initializeEventListeners();
        this.checkAuthStatus();
    }

    // Notification system
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications');
        const notification = document.createElement('div');
        const id = this.notificationId++;
        
        notification.className = `notification ${type}`;
        notification.dataset.id = id;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${iconMap[type] || iconMap.info}"></i>
                <div class="notification-message">${message}</div>
            </div>
            <button class="notification-close" type="button">×</button>
        `;
        
        // Add close functionality
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.hideNotification(notification);
        });
        
        container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Auto-hide after duration
        if (duration > 0) {
            setTimeout(() => {
                this.hideNotification(notification);
            }, duration);
        }
        
        return id;
    }
    
    hideNotification(notification) {
        notification.classList.remove('show');
        notification.classList.add('hide');
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    showSuccess(message, duration = 4000) {
        return this.showNotification(message, 'success', duration);
    }
    
    showError(message, duration = 6000) {
        return this.showNotification(message, 'error', duration);
    }
    
    showWarning(message, duration = 5000) {
        return this.showNotification(message, 'warning', duration);
    }
    
    showInfo(message, duration = 4000) {
        return this.showNotification(message, 'info', duration);
    }

    initializeEventListeners() {
        // Auth buttons
        document.getElementById('login-btn').addEventListener('click', () => {
            window.location.href = '/auth';
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });

        // Your ship EFT parsing
        document.getElementById('parse-your-eft').addEventListener('click', () => {
            this.parseYourEFTFit();
        });

        // Load stored fittings
        document.getElementById('load-fittings-btn').addEventListener('click', () => {
            this.loadStoredFittings();
        });

        // Load selected fitting from dropdown
        document.getElementById('load-selected-fitting-btn').addEventListener('click', () => {
            this.loadSelectedFitting();
        });

        // Advanced dropdown event listeners
        this.initializeAdvancedDropdown();

        // EFT parsing
        document.getElementById('parse-eft').addEventListener('click', () => {
            this.parseEFTFit();
        });

        // Combat analysis
        document.getElementById('analyze-combat').addEventListener('click', () => {
            this.analyzeCombat();
        });

        // Death analysis functionality
        document.getElementById('search-deaths-btn').addEventListener('click', () => {
            this.searchCharacterDeaths();
        });

        document.getElementById('load-selected-death-btn').addEventListener('click', () => {
            this.loadSelectedDeath();
        });

        // Character name input validation
        document.getElementById('character-name-input').addEventListener('input', () => {
            this.validateCharacterNameInput();
        });

        // Deaths dropdown change handler
        document.getElementById('deaths-dropdown').addEventListener('change', () => {
            this.validateDeathSelection();
        });

        // Swap fits
        document.getElementById('swap-fits-btn').addEventListener('click', () => {
            this.swapFits();
        });

        // Fleet management event listeners
        this.initializeFleetEventListeners();
    }

    initializeFleetEventListeners() {
        // Tab switching
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Fleet login button
        const fleetLoginBtn = document.getElementById('fleet-login-btn');
        if (fleetLoginBtn) {
            fleetLoginBtn.addEventListener('click', () => {
                this.login();
            });
        }

        // Attach fleet-specific listeners
        this.attachFleetEventListeners(document);
    }

    attachFleetEventListeners(container) {
        console.log('Attaching fleet event listeners to:', container);

        // Fleet section switching
        container.querySelectorAll('.fleet-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                console.log('Fleet tab clicked:', e.target.dataset.section);
                this.switchFleetSection(e.target.dataset.section);
            });
        });

        // Fittings management
        const addFittingBtn = container.querySelector('#add-fitting-btn');
        if (addFittingBtn) {
            addFittingBtn.addEventListener('click', () => {
                console.log('Add fitting button clicked');
                this.saveFitting();
            });
        }

        const saveFittingBtn = container.querySelector('#save-fitting-btn');
        if (saveFittingBtn) {
            saveFittingBtn.addEventListener('click', () => {
                console.log('Save current fit button clicked');
                this.saveCurrentFit();
            });
        }

        // Enhanced fitting input handlers
        const parseFittingEftBtn = container.querySelector('#parse-fitting-eft');
        if (parseFittingEftBtn) {
            parseFittingEftBtn.addEventListener('click', () => {
                console.log('Parse fitting EFT button clicked');
                this.parseFittingInput();
            });
        }

        const loadStoredFittingsBtn = container.querySelector('#load-stored-fittings-btn');
        if (loadStoredFittingsBtn) {
            loadStoredFittingsBtn.addEventListener('click', () => {
                console.log('Load stored fittings button clicked');
                this.loadStoredFittingsForFleet();
            });
        }

        const loadSelectedStoredFittingBtn = container.querySelector('#load-selected-stored-fitting-btn');
        console.log('Looking for load-selected-stored-fitting-btn, found:', !!loadSelectedStoredFittingBtn);
        if (loadSelectedStoredFittingBtn) {
            console.log('Adding click listener to load-selected-stored-fitting-btn');
            loadSelectedStoredFittingBtn.addEventListener('click', () => {
                console.log('!!! Load selected stored fitting button CLICKED !!!');
                this.loadSelectedStoredFitting();
            });
        } else {
            console.error('load-selected-stored-fitting-btn not found in container!');
        }

        // Fleet management
        const createFleetBtn = container.querySelector('#create-fleet-btn');
        if (createFleetBtn) {
            createFleetBtn.addEventListener('click', () => {
                console.log('Create fleet button clicked');
                this.createFleet();
            });
        }

        // Battle scenarios
        const createScenarioBtn = container.querySelector('#create-scenario-btn');
        if (createScenarioBtn) {
            createScenarioBtn.addEventListener('click', () => {
                console.log('Create scenario button clicked');
                this.createBattleScenario();
            });
        }

        // Fleet vs Fleet button
        const fleetVsFleetBtn = container.querySelector('#fleet-vs-fleet-btn');
        if (fleetVsFleetBtn) {
            fleetVsFleetBtn.addEventListener('click', () => {
                console.log('Fleet vs fleet button clicked');
                this.showFleetVsFleetModal();
            });
        }
    }

    async checkAuthStatus() {
        const urlParams = new URLSearchParams(window.location.search);

        if (urlParams.get('authenticated') === 'true') {
            this.showAuthenticated();
        } else if (urlParams.get('error') === 'auth_failed') {
            this.showError('Authentication failed. Please try again.');
        } else {
            // Check if user is already authenticated
            try {
                const response = await fetch('/api/auth/status');
                if (response.ok) {
                    const data = await response.json();
                    if (data.authenticated) {
                        this.isAuthenticated = true;
                        document.getElementById('character-name').textContent = data.character.name;
                        document.getElementById('login-btn').style.display = 'none';
                        document.getElementById('user-info').style.display = 'flex';

                        // Update fleet tab if currently viewing it
                        if (this.currentTab === 'fleet') {
                            this.updateFleetTabAuth();
                            this.loadFleetData();
                        }
                    }
                }
            } catch (error) {
                console.log('Not authenticated or auth check failed:', error);
            }
        }
    }

    async showAuthenticated() {
        this.isAuthenticated = true;
        document.getElementById('login-btn').style.display = 'none';
        document.getElementById('user-info').style.display = 'flex';

        // Get character information
        try {
            const response = await fetch('/api/auth/status');
            if (response.ok) {
                const data = await response.json();
                if (data.authenticated && data.character) {
                    document.getElementById('character-name').textContent = data.character.name;
                }
            }
        } catch (error) {
            console.error('Failed to get character info:', error);
        }

        // Update fleet tab if currently viewing it
        if (this.currentTab === 'fleet') {
            this.updateFleetTabAuth();
            this.loadFleetData();
        }

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

    async parseYourEFTFit() {
        const input = document.getElementById('your-eft-input').value.trim();
        
        if (!input) {
            this.showWarning('Please enter your EFT fit or zKillboard URL.');
            return;
        }

        this.showLoading();

        try {
            let response;
            
            // Check if input is a zKillboard URL
            if (this.isZKillboardURL(input)) {
                response = await fetch('/api/parse-zkill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ zkillUrl: input })
                });
            } else {
                // Assume it's EFT format
                response = await fetch('/api/parse-eft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eftText: input })
                });
            }

            if (!response.ok) {
                throw new Error('Failed to parse your fit data');
            }

            const data = await response.json();
            this.displayYourShip(data);
            this.updateAnalysisVisibility();

        } catch (error) {
            console.error('Error parsing your fit:', error);
            this.showError('Failed to parse your fit data. Please check the format and try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayYourShip(fitData) {
        const shipInfo = document.getElementById('your-ship-info');
        const shipName = document.getElementById('your-ship-name');
        const shipStats = document.getElementById('your-ship-stats');

        // Store complete fit data
        this.currentShipStats = fitData.stats || this.generateMockStats();
        this.currentShipFit = fitData.fit;
        
        shipName.textContent = `${fitData.fit.shipType} - ${fitData.fit.fitName}`;
        shipStats.innerHTML = this.generateStatsHTML(this.currentShipStats);
        shipInfo.style.display = 'block';
    }

    async parseEFTFit() {
        const input = document.getElementById('eft-input').value.trim();
        
        if (!input) {
            this.showWarning('Please enter an EFT fit or zKillboard URL.');
            return;
        }

        this.showLoading();

        try {
            let response;
            
            // Check if input is a zKillboard URL
            if (this.isZKillboardURL(input)) {
                response = await fetch('/api/parse-zkill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ zkillUrl: input })
                });
            } else {
                // Assume it's EFT format
                response = await fetch('/api/parse-eft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eftText: input })
                });
            }

            if (!response.ok) {
                throw new Error('Failed to parse fit data');
            }

            const data = await response.json();
            this.displayTargetShip(data);
            this.updateAnalysisVisibility();

        } catch (error) {
            console.error('Error parsing fit:', error);
            this.showError('Failed to parse fit data. Please check the format and try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayTargetShip(fitData) {
        const shipInfo = document.getElementById('target-ship-info');
        const shipName = document.getElementById('target-ship-name');
        const shipStats = document.getElementById('target-ship-stats');

        // Store complete fit data
        this.targetShipStats = fitData.stats || this.generateMockStats();
        this.targetShipFit = fitData.fit;
        
        shipName.textContent = `${fitData.fit.shipType} - ${fitData.fit.fitName}`;
        shipStats.innerHTML = this.generateStatsHTML(this.targetShipStats);
        shipInfo.style.display = 'block';
    }

    generateStatsHTML(stats) {
        let html = `
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
        
        // Add auto-selected ammo information if available
        if (stats._cargoAmmoUsed && stats._cargoAmmoUsed.length > 0) {
            html += `
                <div class="stat-item auto-ammo-section">
                    <div class="label">Auto-Selected Ammo</div>
                    <div class="value auto-ammo-list">
                        ${stats._cargoAmmoUsed.map(usage => 
                            `<div class="auto-ammo-item">
                                <span class="weapon-name">${usage.weapon}</span>
                                <span class="ammo-arrow">→</span>
                                <span class="ammo-name">${usage.ammo}</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            `;
        }
        
        return html;
    }

    updateAnalysisVisibility() {
        const analysisSection = document.getElementById('analysis-section');
        if (this.currentShipStats && this.targetShipStats) {
            analysisSection.style.display = 'block';
        } else {
            analysisSection.style.display = 'none';
        }
    }

    swapFits() {
        // Get current textarea values
        const yourEftInput = document.getElementById('your-eft-input');
        const targetEftInput = document.getElementById('eft-input');
        
        // Swap the text content
        const tempText = yourEftInput.value;
        yourEftInput.value = targetEftInput.value;
        targetEftInput.value = tempText;
        
        // Swap the stats and fit data
        const tempStats = this.currentShipStats;
        const tempFit = this.currentShipFit;
        
        this.currentShipStats = this.targetShipStats;
        this.currentShipFit = this.targetShipFit;
        this.targetShipStats = tempStats;
        this.targetShipFit = tempFit;
        
        // Update the displays  
        this.displayYourShip({ stats: this.currentShipStats, fit: this.currentShipFit });
        this.displayTargetShip({ stats: this.targetShipStats, fit: this.targetShipFit });
        
        // Update analysis section visibility
        this.checkAnalysisAvailability();
    }

    async analyzeCombat() {
        if (!this.currentShipStats || !this.targetShipStats || !this.currentShipFit || !this.targetShipFit) {
            this.showWarning('Please load both your current ship and a target ship first.');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/analyze-combat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentFit: this.currentShipFit,
                    targetFit: this.targetShipFit
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

        // Update ammo recommendations
        const ammoRecommendationsList = document.getElementById('ammo-recommendations-list');
        ammoRecommendationsList.innerHTML = '';
        (analysis.ammoRecommendations || []).forEach(recommendation => {
            const li = document.createElement('li');
            li.innerHTML = this.markdownToHtml(recommendation);
            ammoRecommendationsList.appendChild(li);
        });

        // Update module recommendations  
        const moduleRecommendationsList = document.getElementById('module-recommendations-list');
        moduleRecommendationsList.innerHTML = '';
        (analysis.moduleRecommendations || []).forEach(recommendation => {
            const li = document.createElement('li');
            li.innerHTML = this.markdownToHtml(recommendation);
            moduleRecommendationsList.appendChild(li);
        });

        // Update tactics
        if (analysis.tactics) {
            document.getElementById('tactic-range').innerHTML = 
                this.markdownToHtml(analysis.tactics.range || 'Assess optimal range for your weapons');
            document.getElementById('tactic-movement').innerHTML = 
                this.markdownToHtml(analysis.tactics.movement || 'Maintain good positioning');
            document.getElementById('tactic-engagement').innerHTML = 
                this.markdownToHtml(analysis.tactics.engagement || 'Engage when you have advantage');
            document.getElementById('tactic-disengagement').innerHTML = 
                this.markdownToHtml(analysis.tactics.disengagement || 'Disengage if taking heavy damage');
        }

        // Update summary
        document.getElementById('analysis-summary').innerHTML = 
            this.markdownToHtml(analysis.summary || 'Combat analysis completed. Review tactical recommendations above.');

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

    isZKillboardURL(input) {
        // Check if the input looks like a zKillboard URL
        const zkillRegex = /^https?:\/\/(www\.)?zkillboard\.com\/kill\/\d+\/?/i;
        return zkillRegex.test(input.trim());
    }

    markdownToHtml(text) {
        if (!text) return '';

        // Convert common Markdown patterns to HTML
        return text
            // Bold text: **text** or __text__
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/__(.*?)__/g, '<strong>$1</strong>')
            // Italic text: *text* or _text_ (but avoid conflicts with list items)
            .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
            .replace(/_([^_\n]+)_/g, '<em>$1</em>')
            // Code: `code`
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Bullet points: • or - at start of line
            .replace(/^[•\-]\s+(.+)$/gm, '• $1')
            .replace(/\n[•\-]\s+(.+)/g, '<br>• $1')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    showLoading(message = 'Analyzing combat scenario...') {
        const loadingElement = document.getElementById('loading');
        const loadingText = loadingElement.querySelector('.loading-content p');

        if (loadingText) {
            loadingText.textContent = message;
        }

        loadingElement.style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    async loadStoredFittings() {
        if (!this.isAuthenticated) {
            this.showWarning('Please log in with EVE SSO to load stored fittings.');
            return;
        }

        this.showLoading();

        try {
            const response = await fetch('/api/fittings');
            if (!response.ok) {
                throw new Error('Failed to fetch stored fittings');
            }
            const fittings = await response.json();
            await this.displayFittings(fittings);
        } catch (error) {
            console.error('Error loading stored fittings:', error);
            this.showError('Failed to load stored fittings. Please ensure you are logged in and have granted the necessary ESI scope.');
        } finally {
            this.hideLoading();
        }
    }

    async displayFittings(fittings) {
        this.storedFittings = fittings;
        this.selectedFittingIndex = null;
        const fittingsListContainer = document.getElementById('fittings-list-container');
        
        if (fittings.length === 0) {
            this.renderEmptyDropdown();
            document.getElementById('load-selected-fitting-btn').disabled = true;
        } else {
            await this.renderAdvancedDropdown(fittings);
            document.getElementById('load-selected-fitting-btn').disabled = true; // Will be enabled when item selected
        }
        
        fittingsListContainer.style.display = 'block';
    }

    initializeAdvancedDropdown() {
        const searchInput = document.getElementById('fittings-search');
        const dropdownArrow = document.getElementById('dropdown-arrow');
        // const dropdownList = document.getElementById('fittings-dropdown-list');
        
        // Search input events
        searchInput.addEventListener('input', (e) => {
            this.filterDropdownOptions(e.target.value);
        });
        
        searchInput.addEventListener('focus', () => {
            this.showDropdown();
        });
        
        // Dropdown arrow click
        dropdownArrow.addEventListener('click', () => {
            this.toggleDropdown();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.advanced-dropdown-container')) {
                this.hideDropdown();
            }
        });
        
        // Keyboard navigation
        searchInput.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }

    async renderAdvancedDropdown(fittings) {
        // Group fittings by hull type (ship name resolved from ship_type_id)
        const groupedFittings = await this.groupFittingsByHull(fittings);
        const dropdownContent = document.getElementById('fittings-dropdown-content');
        
        dropdownContent.innerHTML = '';
        
        // Sort hull types alphabetically
        const sortedHullTypes = Object.keys(groupedFittings).sort();
        
        sortedHullTypes.forEach(hullType => {
            // Create group header
            const groupHeader = document.createElement('div');
            groupHeader.className = 'dropdown-group-header';
            groupHeader.textContent = hullType;
            
            const group = document.createElement('div');
            group.className = 'dropdown-group';
            group.appendChild(groupHeader);
            
            // Sort fittings within group by fit name
            groupedFittings[hullType].sort((a, b) => a.fitting.name.localeCompare(b.fitting.name));
            
            // Add each fitting in the group
            groupedFittings[hullType].forEach(({ fitting, index }) => {
                const option = document.createElement('div');
                option.className = 'dropdown-option';
                option.dataset.index = index;
                option.dataset.searchText = `${hullType} ${fitting.name}`.toLowerCase();
                
                const shipName = document.createElement('span');
                shipName.className = 'option-ship-name';
                shipName.textContent = hullType;
                
                const fitName = document.createElement('span');
                fitName.className = 'option-fit-name';
                fitName.textContent = fitting.name;
                
                option.appendChild(shipName);
                option.appendChild(fitName);
                
                option.addEventListener('click', () => {
                    this.selectFitting(index, option);
                });
                
                group.appendChild(option);
            });
            
            dropdownContent.appendChild(group);
        });
    }

    async groupFittingsByHull(fittings) {
        const grouped = {};
        
        for (let i = 0; i < fittings.length; i++) {
            const fitting = fittings[i];
            let hullName = 'Unknown Ship';
            
            try {
                if (fitting.ship_type_id) {
                    // Look up ship name from ship_type_id using our static data lookup
                    const response = await fetch(`/api/get-ship-name/${fitting.ship_type_id}`);
                    if (response.ok) {
                        const data = await response.json();
                        hullName = data.name;
                    } else {
                        // Fallback to extracting from fitting name
                        hullName = this.extractHullNameFromFitting(fitting.name);
                    }
                } else {
                    hullName = this.extractHullNameFromFitting(fitting.name);
                }
            } catch (e) {
                console.warn('Error resolving ship name for fitting:', fitting.name, e);
                hullName = this.extractHullNameFromFitting(fitting.name);
            }
            
            if (!grouped[hullName]) {
                grouped[hullName] = [];
            }
            
            grouped[hullName].push({ fitting, index: i });
        }
        
        return grouped;
    }

    extractHullNameFromFitting(fittingName) {
        // Extract ship name from fitting name - handles EFT format [ShipType, FitName]
        if (!fittingName) return 'Unknown Ship';
        
        // Handle EFT format [ShipType, FitName] - extract ship type
        const eftMatch = fittingName.match(/^\[([^,\]]+)/);
        if (eftMatch) {
            return eftMatch[1].trim();
        }
        
        // Fallback: look for comma separator "ShipName, FitName"
        const commaIndex = fittingName.indexOf(',');
        if (commaIndex > 0) {
            return fittingName.substring(0, commaIndex).trim();
        }
        
        // Final fallback: take first word
        const spaceIndex = fittingName.indexOf(' ');
        if (spaceIndex > 0) {
            return fittingName.substring(0, spaceIndex).trim();
        }
        
        return fittingName.trim();
    }

    renderEmptyDropdown() {
        const dropdownContent = document.getElementById('fittings-dropdown-content');
        dropdownContent.innerHTML = '<div class="no-results">No fittings found.</div>';
    }

    filterDropdownOptions(searchTerm) {
        // const options = document.querySelectorAll('.dropdown-option');
        const groups = document.querySelectorAll('.dropdown-group');
        const lowerSearchTerm = searchTerm.toLowerCase();
        
        let hasVisibleOptions = false;
        
        groups.forEach(group => {
            const groupOptions = group.querySelectorAll('.dropdown-option');
            let groupHasVisibleOptions = false;
            
            groupOptions.forEach(option => {
                const searchText = option.dataset.searchText;
                const isVisible = !searchTerm || searchText.includes(lowerSearchTerm);
                
                option.classList.toggle('hidden', !isVisible);
                
                if (isVisible) {
                    groupHasVisibleOptions = true;
                    hasVisibleOptions = true;
                }
            });
            
            // Hide group if no options are visible
            group.style.display = groupHasVisibleOptions ? 'block' : 'none';
        });
        
        // Show "no results" if no options match
        const dropdownContent = document.getElementById('fittings-dropdown-content');
        if (!hasVisibleOptions && searchTerm) {
            const existingNoResults = dropdownContent.querySelector('.no-results');
            if (!existingNoResults) {
                const noResults = document.createElement('div');
                noResults.className = 'no-results';
                noResults.textContent = `No fittings found matching "${searchTerm}"`;
                dropdownContent.appendChild(noResults);
            }
        } else {
            const noResults = dropdownContent.querySelector('.no-results');
            if (noResults) {
                noResults.remove();
            }
        }
    }

    selectFitting(index, optionElement) {
        // Remove previous selection
        document.querySelectorAll('.dropdown-option.selected').forEach(opt => {
            opt.classList.remove('selected');
        });
        
        // Add selection to clicked option
        optionElement.classList.add('selected');
        this.selectedFittingIndex = index;
        
        // Update search input with selected value
        const shipName = optionElement.querySelector('.option-ship-name').textContent;
        const fitName = optionElement.querySelector('.option-fit-name').textContent;
        document.getElementById('fittings-search').value = `${shipName} - ${fitName}`;
        
        // Enable load button
        document.getElementById('load-selected-fitting-btn').disabled = false;
        
        // Hide dropdown
        this.hideDropdown();
    }

    showDropdown() {
        const dropdownList = document.getElementById('fittings-dropdown-list');
        const dropdownArrow = document.getElementById('dropdown-arrow');
        
        dropdownList.style.display = 'block';
        dropdownArrow.classList.add('open');
    }

    hideDropdown() {
        const dropdownList = document.getElementById('fittings-dropdown-list');
        const dropdownArrow = document.getElementById('dropdown-arrow');
        
        dropdownList.style.display = 'none';
        dropdownArrow.classList.remove('open');
    }

    toggleDropdown() {
        const dropdownList = document.getElementById('fittings-dropdown-list');
        
        if (dropdownList.style.display === 'none' || !dropdownList.style.display) {
            this.showDropdown();
        } else {
            this.hideDropdown();
        }
    }

    handleKeyboardNavigation(e) {
        const visibleOptions = document.querySelectorAll('.dropdown-option:not(.hidden)');
        
        if (visibleOptions.length === 0) return;
        
        const currentSelected = document.querySelector('.dropdown-option.selected');
        let currentIndex = -1;
        
        if (currentSelected) {
            currentIndex = Array.from(visibleOptions).indexOf(currentSelected);
        }
        
        switch (e.key) {
            case 'ArrowDown': {
                e.preventDefault();
                const nextIndex = currentIndex < visibleOptions.length - 1 ? currentIndex + 1 : 0;
                this.selectFitting(visibleOptions[nextIndex].dataset.index, visibleOptions[nextIndex]);
                break;
            }
                
            case 'ArrowUp': {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleOptions.length - 1;
                this.selectFitting(visibleOptions[prevIndex].dataset.index, visibleOptions[prevIndex]);
                break;
            }
                
            case 'Enter':
                e.preventDefault();
                if (currentSelected) {
                    this.loadSelectedFitting();
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                this.hideDropdown();
                break;
        }
    }

    async loadSelectedFitting() {
        if (this.selectedFittingIndex === null || !this.storedFittings || !this.storedFittings[this.selectedFittingIndex]) {
            this.showWarning('Please select a fitting to load.');
            return;
        }

        const selectedFitting = this.storedFittings[this.selectedFittingIndex];
        this.showLoading();

        try {
            const response = await fetch('/api/convert-esi-to-eft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ esiFitting: selectedFitting })
            });

            if (!response.ok) {
                throw new Error('Failed to convert ESI fitting to EFT');
            }

            const data = await response.json();
            document.getElementById('your-eft-input').value = data.eftText;
            this.parseYourEFTFit(); // Parse the converted EFT
        } catch (error) {
            console.error('Error loading selected fitting:', error);
            this.showError('Failed to load selected fitting. ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // Death Analysis Methods
    validateCharacterNameInput() {
        const characterName = document.getElementById('character-name-input').value.trim();
        const searchBtn = document.getElementById('search-deaths-btn');
        searchBtn.disabled = characterName.length < 3;
    }

    validateDeathSelection() {
        const deathDropdown = document.getElementById('deaths-dropdown');
        const loadBtn = document.getElementById('load-selected-death-btn');
        loadBtn.disabled = !deathDropdown.value;
    }

    async searchCharacterDeaths() {
        const characterName = document.getElementById('character-name-input').value.trim();

        if (characterName.length < 3) {
            this.showWarning('Please enter at least 3 characters for the character name.');
            return;
        }

        this.showLoading();

        try {
            // First, search for the character
            const charResponse = await fetch(`/api/search/character/${encodeURIComponent(characterName)}`);
            
            if (!charResponse.ok) {
                const errorData = await charResponse.json().catch(() => ({}));
                if (charResponse.status === 404) {
                    const errorMsg = errorData.error || `Character "${characterName}" not found.`;
                    const suggestion = errorData.suggestion ? `\n\n${errorData.suggestion}` : '';
                    throw new Error(errorMsg + suggestion);
                } else if (charResponse.status === 401) {
                    const errorMsg = errorData.error || 'Authentication required for character search.';
                    const suggestion = errorData.suggestion ? `\n\n${errorData.suggestion}` : '';
                    throw new Error(errorMsg + suggestion);
                } else if (charResponse.status === 501) {
                    const errorMsg = errorData.error || 'Character search not available.';
                    const suggestion = errorData.suggestion ? `\n\n${errorData.suggestion}` : '';
                    throw new Error(errorMsg + suggestion);
                }
                throw new Error(errorData.error || 'Failed to search for character.');
            }

            const characterData = await charResponse.json();
            
            // Then get the character's deaths
            const deathsResponse = await fetch(`/api/character/${characterData.character_id}/deaths?limit=10`);
            
            if (!deathsResponse.ok) {
                const errorData = await deathsResponse.json().catch(() => ({}));
                if (deathsResponse.status === 404) {
                    throw new Error(errorData.error || `No recent deaths found for "${characterName}".`);
                }
                throw new Error(errorData.error || 'Failed to retrieve deaths data.');
            }

            const deathsData = await deathsResponse.json();
            
            // Populate the dropdown
            this.populateDeathsDropdown(deathsData.deaths);
            
            // Show the dropdown section
            document.getElementById('deaths-dropdown-group').style.display = 'block';
            
            // Show success message
            this.showSuccess(`Found ${deathsData.totalFound} recent deaths for ${characterName}. Select one to load.`);

        } catch (error) {
            console.error('Error searching character deaths:', error);
            this.showError('Failed to search character deaths: ' + error.message);
            
            // Hide dropdown on error
            document.getElementById('deaths-dropdown-group').style.display = 'none';
        } finally {
            this.hideLoading();
        }
    }

    populateDeathsDropdown(deaths) {
        const dropdown = document.getElementById('deaths-dropdown');
        
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">Select a death to load...</option>';
        
        deaths.forEach(death => {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                killmailId: death.killmailId,
                killmailHash: death.killmailHash
            });
            option.textContent = death.displayText;
            dropdown.appendChild(option);
        });

        // Reset validation
        this.validateDeathSelection();
    }

    async loadSelectedDeath() {
        const deathDropdown = document.getElementById('deaths-dropdown');
        
        if (!deathDropdown.value) {
            this.showWarning('Please select a death to load.');
            return;
        }

        this.showLoading();

        try {
            const deathInfo = JSON.parse(deathDropdown.value);
            
            // Load the specific killmail
            const killmailResponse = await fetch(`/api/killmail/${deathInfo.killmailId}/${deathInfo.killmailHash}`);
            
            if (!killmailResponse.ok) {
                const errorData = await killmailResponse.json().catch(() => ({}));
                if (killmailResponse.status === 404) {
                    throw new Error(errorData.error || 'Killmail not found or no longer available.');
                }
                throw new Error(errorData.error || 'Failed to load killmail data.');
            }

            const killmailData = await killmailResponse.json();
            
            // Load the fit into the target textarea
            document.getElementById('eft-input').value = killmailData.eftText;
            
            // Display the ship using the existing method
            this.displayTargetShip(killmailData);
            this.updateAnalysisVisibility();

            // Show success message with killmail link
            const killDate = new Date(killmailData.killmail.time).toLocaleDateString();
            const selectedOption = deathDropdown.options[deathDropdown.selectedIndex].textContent;
            this.showSuccess(`Loaded death fit: ${selectedOption}. <a href="${killmailData.killmail.zkb_url}" target="_blank" style="color: #00d4ff;">View killmail</a>`, 8000);

        } catch (error) {
            console.error('Error loading selected death:', error);
            this.showError('Failed to load selected death: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderFittingDetails(fittingId, button) {
        const eftFormat = decodeURIComponent(button.getAttribute('data-eft'));
        const detailsContainer = document.getElementById(`fitting-details-${fittingId}`);
        if (!detailsContainer) return;

        detailsContainer.innerHTML = '<div class="loading-spinner"></div>';

        fetch('/api/fleet/fittings/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eftFormat })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                throw new Error(data.error);
            }
            const { parsedFit } = data;

            let html = '<div class="fitting-layout">';
            html += `<div class="ship-icon"><img src="https://images.evetech.net/types/${parsedFit.shipTypeId}/render?size=64" width="64" height="64" /></div>`;

            html += '<div class="slots high-slots">';
            html += parsedFit.modules.high.map(module => this.generateSlotHTML(module)).join('');
            html += '</div>';

            html += '<div class="slots med-slots">';
            html += parsedFit.modules.med.map(module => this.generateSlotHTML(module)).join('');
            html += '</div>';

            html += '<div class="slots low-slots">';
            html += parsedFit.modules.low.map(module => this.generateSlotHTML(module)).join('');
            html += '</div>';

            html += '<div class="slots rig-slots">';
            html += parsedFit.modules.rig.map(module => this.generateSlotHTML(module)).join('');
            html += '</div>';

            html += '<div class="slots subsystem-slots">';
            html += parsedFit.modules.subsystem.map(module => this.generateSlotHTML(module)).join('');
            html += '</div>';

            html += '</div>'; // end fitting-layout

            detailsContainer.innerHTML = html;
        })
        .catch(error => {
            console.error('Error rendering fitting details:', error);
            detailsContainer.innerHTML = '<p class="text-danger">Failed to load fitting details.</p>';
        });
    }

    generateSlotHTML(module) {
        const iconUrl = module.icon_id ? `https://images.evetech.net/icons/${module.icon_id}.png` : 'https://via.placeholder.com/32';
        return `<div class="slot" title="${module.name}"><img src="${iconUrl}" /></div>`;
    }

    // ========== FLEET MANAGEMENT METHODS ==========

    switchTab(tabName) {
        console.log('switchTab called with:', tabName);

        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Show selected tab content
        const tabElement = document.getElementById(`${tabName}-tab`);
        console.log('Tab element:', tabElement);
        if (tabElement) {
            tabElement.classList.add('active');
            console.log('Tab element computed display:', window.getComputedStyle(tabElement).display);
        }

        const navTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (navTab) {
            navTab.classList.add('active');
        }

        this.currentTab = tabName;

        // Handle fleet tab authentication
        if (tabName === 'fleet') {
            this.updateFleetTabAuth();
            if (this.isAuthenticated) {
                this.loadFleetData();
            }
        }
    }

    updateFleetTabAuth() {
        const authRequired = document.getElementById('fleet-auth-required');
        const fleetContent = document.getElementById('fleet-manager-content');

        console.log('updateFleetTabAuth - isAuthenticated:', this.isAuthenticated);
        console.log('updateFleetTabAuth - authRequired:', authRequired);
        console.log('updateFleetTabAuth - fleetContent:', fleetContent);

        if (this.isAuthenticated) {
            if (authRequired) {
                authRequired.style.display = 'none';
            }
            if (fleetContent) {
                fleetContent.style.display = 'block';
            }
        } else {
            if (authRequired) authRequired.style.display = 'block';
            if (fleetContent) fleetContent.style.display = 'none';
        }
    }

    switchFleetSection(sectionName) {
        console.log('=== switchFleetSection called ===', sectionName);

        // Work on the original fleet-manager-content
        const fleetContent = document.getElementById('fleet-manager-content');
        if (!fleetContent) {
            console.error('fleet-manager-content not found!');
            return;
        }

        // Hide all fleet sections
        fleetContent.querySelectorAll('.fleet-section').forEach(section => {
            section.classList.remove('active');
            section.style.display = 'none';
            console.log('Hiding section:', section.id);
        });

        // Remove active class from all fleet tab buttons
        fleetContent.querySelectorAll('.fleet-tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected section
        const targetSection = fleetContent.querySelector(`#${sectionName}-section`);
        const targetBtn = fleetContent.querySelector(`[data-section="${sectionName}"]`);

        console.log(`targetSection:`, targetSection, 'targetBtn:', targetBtn);

        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.style.display = 'block';
            targetSection.style.visibility = 'visible';
            targetSection.style.opacity = '1';
            targetSection.style.zIndex = '1';
            console.log(`Set ${sectionName}-section display to block`);
            console.log(`Target section computed style:`, window.getComputedStyle(targetSection).display,
                window.getComputedStyle(targetSection).visibility,
                window.getComputedStyle(targetSection).height);
        } else {
            console.error(`Could not find #${sectionName}-section`);
        }
        if (targetBtn) {
            targetBtn.classList.add('active');
        }

        this.currentFleetSection = sectionName;

        // Load section-specific data
        switch (sectionName) {
            case 'fittings':
                this.loadFittings();
                break;
            case 'fleets':
                this.loadFleets();
                break;
            case 'battles':
                this.loadBattleScenarios();
                break;
        }
    }

    async loadFleetData() {
        if (!this.isAuthenticated) return;

        console.log('=== Loading fleet data ===');
        try {
            // Load all fleet-related data
            await Promise.all([
                this.loadFittings(),
                this.loadFleets(),
                this.loadBattleScenarios()
            ]);
            console.log('Fleet data loaded successfully');
        } catch (error) {
            console.error('Error loading fleet data:', error);
            this.showError('Failed to load fleet data: ' + error.message);
        }
    }

    // ========== FITTINGS MANAGEMENT ==========

    async loadFittings() {
        try {
            const response = await fetch('/api/fleet/fittings');
            if (!response.ok) throw new Error('Failed to load fittings');

            const data = await response.json();
            this.fittings = data.fittings;
            console.log('Loaded fittings:', this.fittings.length, 'fittings');
            this.renderFittings();
        } catch (error) {
            console.error('Error loading fittings:', error);
            this.showError('Failed to load fittings: ' + error.message);
        }
    }

    async saveFitting() {
        console.log('=== saveFitting called ===');

        // Check if we have parsed fitting data
        if (!this.currentParsedFit) {
            this.showError('Please load a fitting first using "Load Fitting" button');
            return;
        }

        const nameField = document.getElementById('fitting-name');
        const eftField = document.getElementById('fitting-eft');

        if (!nameField || !eftField) {
            this.showError('Required form fields not found');
            return;
        }

        const name = nameField.value.trim() || this.currentParsedFit.fitName || this.currentParsedFit.shipName;
        const eftFormat = eftField.value.trim();

        if (!name || !eftFormat) {
            this.showError('Please provide both fitting name and EFT format');
            return;
        }

        try {
            const shipName = this.currentParsedFit.shipName;
            const shipTypeId = this.currentParsedFit.shipTypeId || 1;

            const response = await fetch('/api/fleet/fittings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    shipTypeId: 1, // Placeholder - will be resolved on server
                    shipName,
                    eftFormat
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save fitting');
            }

            // Clear form and reload fittings
            if (nameField) nameField.value = '';
            if (eftField) eftField.value = '';

            // Hide parsed fitting info and reset state
            const parsedFittingInfo = document.getElementById('parsed-fitting-info');
            if (parsedFittingInfo) parsedFittingInfo.style.display = 'none';

            const storedFittingsContainer = document.getElementById('stored-fittings-container');
            if (storedFittingsContainer) storedFittingsContainer.style.display = 'none';

            this.currentParsedFit = null;
            this.selectedStoredFittingIndex = null;

            this.showSuccess('Fitting saved successfully');
            await this.loadFittings();
        } catch (error) {
            console.error('Error saving fitting:', error);
            this.showError('Failed to save fitting: ' + error.message);
        }
    }

    async saveCurrentFit() {
        if (!this.currentShipFit) {
            this.showError('No current ship fit to save');
            return;
        }

        const name = prompt('Enter fitting name:');
        if (!name) return;

        // Use the current ship's EFT format
        const eftFormat = document.getElementById('your-eft-input').value.trim();
        if (!eftFormat) {
            this.showError('No EFT format available to save');
            return;
        }

        try {
            const response = await fetch('/api/fleet/fittings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    shipTypeId: this.currentShipFit.shipTypeId || 0,
                    shipName: this.currentShipFit.shipName || 'Unknown Ship',
                    eftFormat
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save fitting');
            }

            this.showSuccess('Current fit saved successfully');
            await this.loadFittings();
        } catch (error) {
            console.error('Error saving current fit:', error);
            this.showError('Failed to save current fit: ' + error.message);
        }
    }

    // Enhanced fitting input methods
    async parseFittingInput() {
        console.log('=== parseFittingInput called ===');

        const eftField = document.getElementById('fitting-eft');
        if (!eftField || !eftField.value.trim()) {
            this.showError('Please enter an EFT fitting or zKillboard URL');
            return;
        }

        const input = eftField.value.trim();
        this.showLoading('Parsing fitting...');

        try {
            let response;

            // Check if input is a zKillboard URL
            if (this.isZKillboardURL(input)) {
                response = await fetch('/api/parse-zkill', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ zkillUrl: input })
                });
            } else {
                response = await fetch('/api/parse-eft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eftFormat: input })
                });
            }

            if (!response.ok) {
                throw new Error('Failed to parse fitting');
            }

            const fitData = await response.json();
            this.displayParsedFitting(fitData);
        } catch (error) {
            console.error('Error parsing fitting:', error);
            this.showError('Failed to parse fit data. Please check the format and try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayParsedFitting(fitData) {
        console.log('=== displayParsedFitting called ===', fitData);

        const parsedFittingInfo = document.getElementById('parsed-fitting-info');
        const parsedFittingName = document.getElementById('parsed-fitting-name');
        const parsedFittingStats = document.getElementById('parsed-fitting-stats');

        if (!parsedFittingInfo || !parsedFittingName || !parsedFittingStats) return;

        // Store the parsed fit data
        this.currentParsedFit = fitData;

        // Update display
        parsedFittingName.textContent = fitData.shipName || 'Unknown Ship';
        parsedFittingStats.innerHTML = this.generateStatsHTML(fitData.stats || {});

        // Show the parsed fitting info
        parsedFittingInfo.style.display = 'block';

        // Set default fitting name
        const fittingNameInput = document.getElementById('fitting-name');
        if (fittingNameInput && !fittingNameInput.value) {
            fittingNameInput.value = fitData.fitName || fitData.shipName || '';
        }
    }

    async loadStoredFittingsForFleet() {
        console.log('=== loadStoredFittingsForFleet called ===');

        // Ensure fleet management tab is visible
        const fleetTab = document.querySelector('a[href="#fleet-manager"]');
        const tabContent = document.getElementById('fleet-manager');
        if (fleetTab && tabContent) {
            console.log('Activating fleet management tab...');

            // Remove active from all tabs and content
            document.querySelectorAll('.nav-tabs .nav-link').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('.tab-content .tab-pane').forEach(content => {
                content.classList.remove('active', 'show');
            });

            // Activate fleet management tab
            fleetTab.classList.add('active');
            tabContent.classList.add('active', 'show');
        }

        if (!this.isAuthenticated) {
            this.showWarning('Please log in with EVE SSO to load stored fittings.');
            return;
        }

        this.showLoading('Loading stored fittings...');

        try {
            const response = await fetch('/api/fittings');
            if (!response.ok) {
                throw new Error('Failed to fetch stored fittings');
            }

            const data = await response.json();
            await this.displayStoredFittingsForFleet(data || []);
        } catch (error) {
            console.error('Error loading stored fittings:', error);
            this.showError('Failed to load stored fittings. Please ensure you are logged in and have granted the necessary ESI scope.');
        } finally {
            this.hideLoading();
        }
    }

    async displayStoredFittingsForFleet(fittings) {
        console.log('=== displayStoredFittingsForFleet called with', fittings.length, 'fittings ===');

        this.storedFittingsForFleet = fittings;
        this.selectedStoredFittingIndex = null;

        // Try to find elements in the temporary fleet area first, then fallback to original
        let storedFittingsContainer = document.querySelector('#temp-fleet-area #stored-fittings-container');
        let dropdown = document.querySelector('#temp-fleet-area #stored-fittings-dropdown-content');
        let dropdownList = document.querySelector('#temp-fleet-area #stored-fittings-dropdown-list');

        // Fallback to original elements if not found in temp area
        if (!storedFittingsContainer) {
            storedFittingsContainer = document.getElementById('stored-fittings-container');
        }
        if (!dropdown) {
            dropdown = document.getElementById('stored-fittings-dropdown-content');
        }
        if (!dropdownList) {
            dropdownList = document.getElementById('stored-fittings-dropdown-list');
        }

        console.log('DOM elements found:');
        console.log('- storedFittingsContainer:', !!storedFittingsContainer, storedFittingsContainer);
        console.log('- dropdown:', !!dropdown, dropdown);
        console.log('- dropdownList:', !!dropdownList, dropdownList);

        if (!storedFittingsContainer || !dropdown) {
            console.error('Missing DOM elements:', { storedFittingsContainer, dropdown });
            return;
        }

        if (fittings.length === 0) {
            storedFittingsContainer.style.display = 'none';
            this.showWarning('No stored fittings found. Save some fittings first!');
            return;
        }

        // Group fittings by ship type
        const groupedFittings = {};
        fittings.forEach((fitting, index) => {
            // ESI fittings have ship_type_id, not ship_name
            // We need to look up the ship name from static data
            let shipName = fitting.ship_name || 'Unknown Ship';
            if (fitting.ship_type_id && !fitting.ship_name) {
                // Try to get ship name from static data if available
                const staticData = window.staticData;
                if (staticData && staticData.types && staticData.types[fitting.ship_type_id]) {
                    shipName = staticData.types[fitting.ship_type_id].name;
                } else {
                    shipName = `Ship Type ${fitting.ship_type_id}`;
                }
            }


            if (!groupedFittings[shipName]) {
                groupedFittings[shipName] = [];
            }
            groupedFittings[shipName].push({ ...fitting, originalIndex: index, ship_name: shipName });
        });

        // Generate dropdown content
        let dropdownHTML = '';
        Object.keys(groupedFittings).sort().forEach(shipName => {
            dropdownHTML += `<div class="dropdown-group">
                <div class="dropdown-group-header">${shipName}</div>`;

            groupedFittings[shipName].forEach(fitting => {
                dropdownHTML += `
                    <div class="dropdown-option" data-index="${fitting.originalIndex}">
                        <div class="fitting-option-name">${fitting.name}</div>
                        <div class="fitting-option-ship">${fitting.ship_name}</div>
                    </div>`;
            });

            dropdownHTML += '</div>';
        });

        dropdown.innerHTML = dropdownHTML;
        console.log('HTML set, dropdown now has', dropdown.children.length, 'child elements');

        // Add click handlers
        dropdown.querySelectorAll('.dropdown-option').forEach((option, i) => {
            console.log(`Adding click handler to option ${i}, data-index:`, option.getAttribute('data-index'));
            option.addEventListener('click', (e) => {
                console.log('Click event triggered on option:', option.getAttribute('data-index'));
                e.preventDefault();
                e.stopPropagation();
                const index = parseInt(option.getAttribute('data-index'));
                this.selectStoredFitting(index);
            });
        });
        console.log('Added click handlers to', dropdown.querySelectorAll('.dropdown-option').length, 'options');

        // Setup search functionality
        this.setupStoredFittingsSearch();

        // Show the dropdown list (it starts hidden by default)
        if (dropdownList) {
            console.log('Setting dropdownList display to block, current:', dropdownList.style.display);
            dropdownList.style.display = 'block';
            console.log('DropdownList now:', dropdownList.style.display, 'visible:', dropdownList.offsetHeight > 0);
        }

        // Ensure fleet manager is visible (parent container)
        const fleetManager = document.querySelector('.fleet-manager');
        if (fleetManager && fleetManager.style.display === 'none') {
            console.log('Fleet manager was hidden, showing it');
            fleetManager.style.display = 'block';
        }

        // Re-attach event listener to the load button (in case it's in a cloned area)
        const loadButton = document.getElementById('load-selected-stored-fitting-btn');
        if (loadButton) {
            console.log('Re-attaching click handler to load button');
            // Remove any existing listeners by cloning the button
            const newButton = loadButton.cloneNode(true);
            loadButton.parentNode.replaceChild(newButton, loadButton);
            // Add new listener
            newButton.addEventListener('click', () => {
                console.log('!!! Load selected stored fitting button CLICKED (from displayStoredFittingsForFleet) !!!');
                this.loadSelectedStoredFitting();
            });
        }

        // Show container
        console.log('About to show container');
        console.log('Container current display:', storedFittingsContainer.style.display);
        storedFittingsContainer.style.display = 'block';
        console.log('Container display after setting:', storedFittingsContainer.style.display);
        console.log('Container dimensions:', storedFittingsContainer.offsetWidth, 'x', storedFittingsContainer.offsetHeight);
        console.log('Dropdown dimensions:', dropdown.offsetWidth, 'x', dropdown.offsetHeight);
        if (dropdownList) {
            console.log('DropdownList dimensions:', dropdownList.offsetWidth, 'x', dropdownList.offsetHeight);
        }

        // Check parent elements for hidden states
        let parent = storedFittingsContainer.parentElement;
        let level = 1;
        while (parent && level <= 8) {
            const computedStyle = window.getComputedStyle(parent);
            console.log(`Parent level ${level}:`, parent.tagName, parent.className || parent.id,
                       'display:', computedStyle.display,
                       'visibility:', computedStyle.visibility,
                       'position:', computedStyle.position,
                       'dimensions:', parent.offsetWidth, 'x', parent.offsetHeight);
            parent = parent.parentElement;
            level++;
        }

        // Ensure Fleet Manager tab is properly activated
        if (this.currentTab !== 'fleet') {
            console.log('Switching to fleet tab');
            this.switchTab('fleet');
        }

        // Additional check: ensure fleet manager content is visible
        const fleetManagerContent = document.getElementById('fleet-manager-content');
        if (fleetManagerContent) {
            fleetManagerContent.style.display = 'block';
        }
    }

    setupStoredFittingsSearch() {
        // Try to find elements in the temporary fleet area first, then fallback to original
        let searchInput = document.querySelector('#temp-fleet-area #stored-fittings-search');
        let dropdownList = document.querySelector('#temp-fleet-area #stored-fittings-dropdown-list');
        let dropdownArrow = document.querySelector('#temp-fleet-area #stored-dropdown-arrow');

        // Fallback to original elements if not found in temp area
        if (!searchInput) searchInput = document.getElementById('stored-fittings-search');
        if (!dropdownList) dropdownList = document.getElementById('stored-fittings-dropdown-list');
        if (!dropdownArrow) dropdownArrow = document.getElementById('stored-dropdown-arrow');

        if (!searchInput || !dropdownList || !dropdownArrow) return;

        // Toggle dropdown
        const toggleDropdown = () => {
            const isVisible = dropdownList.style.display === 'block';
            dropdownList.style.display = isVisible ? 'none' : 'block';
            dropdownArrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
        };

        dropdownArrow.addEventListener('click', toggleDropdown);
        searchInput.addEventListener('focus', () => {
            dropdownList.style.display = 'block';
            dropdownArrow.style.transform = 'rotate(180deg)';
        });

        // Search functionality
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.toLowerCase();
            const options = dropdownList.querySelectorAll('.dropdown-option');

            options.forEach(option => {
                const name = option.querySelector('.fitting-option-name').textContent.toLowerCase();
                const ship = option.querySelector('.fitting-option-ship').textContent.toLowerCase();
                const matches = name.includes(query) || ship.includes(query);
                option.style.display = matches ? 'block' : 'none';
            });
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.advanced-dropdown-container')) {
                dropdownList.style.display = 'none';
                dropdownArrow.style.transform = 'rotate(0deg)';
            }
        });
    }

    selectStoredFitting(index) {
        console.log('=== selectStoredFitting called with index:', index);
        this.selectedStoredFittingIndex = index;
        const fitting = this.storedFittingsForFleet[index];

        console.log('Selected fitting:', fitting);
        if (!fitting) return;

        // Update search input to show selected fitting - check temp area first
        let searchInput = document.querySelector('#temp-fleet-area #stored-fittings-search');
        if (!searchInput) searchInput = document.getElementById('stored-fittings-search');

        let loadButton = document.querySelector('#temp-fleet-area #load-selected-stored-fitting-btn');
        if (!loadButton) loadButton = document.getElementById('load-selected-stored-fitting-btn');

        console.log('Search input found:', !!searchInput);
        console.log('Load button found:', !!loadButton);
        console.log('Load button element:', loadButton);
        console.log('Load button in temp area:', !!document.querySelector('#temp-fleet-area #load-selected-stored-fitting-btn'));

        if (searchInput) {
            searchInput.value = `${fitting.name} (${fitting.ship_name})`;
            console.log('Search input value set to:', searchInput.value);
        }

        if (loadButton) {
            console.log('Load button disabled before:', loadButton.disabled);
            loadButton.disabled = false;
            loadButton.removeAttribute('disabled');  // Remove the HTML disabled attribute

            // Add force-enabled class with !important styles
            loadButton.classList.add('force-enabled');
            loadButton.classList.remove('disabled');

            console.log('Load button disabled after:', loadButton.disabled);
            console.log('Load button has disabled attribute:', loadButton.hasAttribute('disabled'));
            console.log('Load button computed style after forcing:', window.getComputedStyle(loadButton).backgroundColor);
            console.log('Load button classes:', loadButton.className);
        }

        // Update visual selection in dropdown
        let dropdown = document.querySelector('#temp-fleet-area #stored-fittings-dropdown-content');
        if (!dropdown) dropdown = document.getElementById('stored-fittings-dropdown-content');

        if (dropdown) {
            // Remove previous selection
            dropdown.querySelectorAll('.dropdown-option.selected').forEach(opt => {
                opt.classList.remove('selected');
            });

            // Add selection to current option
            const selectedOption = dropdown.querySelector(`[data-index="${index}"]`);
            if (selectedOption) {
                selectedOption.classList.add('selected');
                console.log('Added selected class to option');
            }
        }

        // Close dropdown
        let dropdownList = document.querySelector('#temp-fleet-area #stored-fittings-dropdown-list');
        if (!dropdownList) dropdownList = document.getElementById('stored-fittings-dropdown-list');

        let dropdownArrow = document.querySelector('#temp-fleet-area #stored-dropdown-arrow');
        if (!dropdownArrow) dropdownArrow = document.getElementById('stored-dropdown-arrow');

        if (dropdownList) dropdownList.style.display = 'none';
        if (dropdownArrow) dropdownArrow.style.transform = 'rotate(0deg)';

        console.log('selectStoredFitting completed');
    }

    async loadSelectedStoredFitting() {
        console.log('===loadSelectedStoredFitting START===');
        console.log('selectedStoredFittingIndex:', this.selectedStoredFittingIndex);
        console.log('storedFittingsForFleet:', this.storedFittingsForFleet);

        if (this.selectedStoredFittingIndex === null || !this.storedFittingsForFleet) {
            console.error('No fitting selected!');
            this.showError('No fitting selected');
            return;
        }

        const selectedFitting = this.storedFittingsForFleet[this.selectedStoredFittingIndex];
        console.log('selectedFitting:', selectedFitting);

        if (!selectedFitting) {
            console.error('Selected fitting not found!');
            this.showError('Failed to load selected fitting. Please try again.');
            return;
        }

        console.log('About to show loading...');
        this.showLoading('Adding fitting to fleet...');
        console.log('Loading shown, starting conversion...');

        try {
            // Convert ESI fitting to EFT format
            console.log('Calling /api/convert-esi-to-eft...');
            const convertResponse = await fetch('/api/convert-esi-to-eft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ esiFitting: selectedFitting })
            });
            console.log('Convert response received, ok:', convertResponse.ok);

            if (!convertResponse.ok) {
                const errorText = await convertResponse.text();
                console.error('Convert error:', errorText);
                throw new Error('Failed to convert ESI fitting to EFT');
            }

            const fitData = await convertResponse.json();
            console.log('Converted to EFT, length:', fitData.eftText?.length);

            // Parse and calculate stats on the server
            console.log('Calling /api/parse-fitting...');
            const parseResponse = await fetch('/api/parse-fitting', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eftText: fitData.eftText })
            });
            console.log('Parse response received, ok:', parseResponse.ok);

            if (!parseResponse.ok) {
                const errorText = await parseResponse.text();
                console.error('Parse error:', errorText);
                throw new Error('Failed to parse fitting');
            }

            const { fit, stats } = await parseResponse.json();
            console.log('Parsed fit:', fit?.shipType, 'Stats DPS:', stats?.dps?.total);

            // Save the fitting to the database
            console.log('Saving fitting to database...');
            const saveResponse = await fetch('/api/fleet/fittings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: selectedFitting.name,
                    shipTypeId: selectedFitting.ship_type_id,
                    shipName: selectedFitting.ship_name || fit.shipType,
                    eftFormat: fitData.eftText
                })
            });

            if (!saveResponse.ok) {
                const errorText = await saveResponse.text();
                console.error('Save error:', errorText);
                throw new Error('Failed to save fitting to database');
            }

            const savedData = await saveResponse.json();
            console.log('Fitting saved to database with ID:', savedData.fittingId);

            // Reload fittings to show the new one
            await this.loadFittings();

            this.showSuccess(`Saved ${selectedFitting.name} to your fittings`);

            // Close the stored fittings dropdown
            const dropdown = document.getElementById('stored-fittings-dropdown-list');
            if (dropdown) dropdown.style.display = 'none';

        } catch (error) {
            console.error('Error loading selected fitting:', error);
            this.showError('Failed to load selected fitting. ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async renderFittings() {
        console.log('=== renderFittings called ===');

        // Find all fittings-list elements (original and cloned)
        const fittingsLists = document.querySelectorAll('#fittings-list');
        console.log('fittings-list elements found:', fittingsLists.length);
        if (fittingsLists.length === 0) return;

        console.log('Number of fittings to render:', this.fittings.length);

        if (this.fittings.length === 0) {
            const content = '<p style="color: white; background: green; padding: 20px; border: 2px solid white; font-size: 16px; font-weight: bold;">✅ Your fitting was saved successfully! Try refreshing if you don\'t see it.</p>';
            fittingsLists.forEach(list => {
                list.innerHTML = content;
            });
            return;
        }

        // Create enhanced fitting cards with stats
        const enhancedCards = await Promise.all(this.fittings.map(async (fitting) => {
            let stats = null;
            let parsedFit = null;

            try {
                // Parse the fit to get stats and modules using fleet endpoint for better module enrichment
                console.log(`CALLING /api/fleet/fittings/parse for ${fitting.name}`);
                const response = await fetch('/api/fleet/fittings/parse', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eftFormat: fitting.eft_format })
                });

                console.log(`Response status for ${fitting.name}: ${response.status}`);
                if (response.ok) {
                    const data = await response.json();
                    parsedFit = data.parsedFit;
                    console.log(`Parsed fit for ${fitting.name}:`, parsedFit);
                    console.log(`FIXED PARSING - Modules breakdown for ${fitting.name}:`, {
                        low: parsedFit.modules?.low?.map(m => m.name) || [],
                        med: parsedFit.modules?.med?.map(m => m.name) || [],
                        high: parsedFit.modules?.high?.map(m => m.name) || [],
                        rig: parsedFit.modules?.rig?.map(m => m.name) || [],
                        subsystem: parsedFit.modules?.subsystem?.map(m => m.name) || []
                    });

                    // Force debug: Log the exact module assignments
                    if (fitting.name === 'SU Corm') {
                        console.log('DEBUG SU CORM MODULES:');
                        console.log('Low modules:', parsedFit.modules?.low || []);
                        console.log('Med modules:', parsedFit.modules?.med || []);
                        console.log('High modules:', parsedFit.modules?.high || []);
                        console.log('Rig modules:', parsedFit.modules?.rig || []);
                        console.log('Subsystem modules:', parsedFit.modules?.subsystem || []);
                    }

                    // Get stats using the standard parse endpoint
                    const statsResponse = await fetch('/api/parse-eft', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ eftText: fitting.eft_format })
                    });

                    if (statsResponse.ok) {
                        const statsData = await statsResponse.json();
                        stats = statsData.stats;
                    }
                }
            } catch (error) {
                console.warn(`Failed to get stats for fitting ${fitting.id}:`, error);
            }

            return this.createEnhancedFittingCard(fitting, stats, parsedFit);
        }));

        const content = enhancedCards.join('');

        // Update all fittings-list elements
        fittingsLists.forEach(list => {
            list.innerHTML = content;
        });

        console.log('Rendered', this.fittings.length, 'enhanced fittings');
    }

    createEnhancedFittingCard(fitting, stats, parsedFit) {
        const shipTypeId = parsedFit?.shipTypeId || 1;
        const lastUpdated = new Date(fitting.updated_at).toLocaleString();

        let statsHTML = '';
        if (stats) {
            statsHTML = `
                <div class="fitting-stats">
                    <div class="stat-group">
                        <div class="stat-item">
                            <span class="stat-label">DPS</span>
                            <span class="stat-value">${this.formatNumber(stats.dps?.total || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">EHP</span>
                            <span class="stat-value">${this.formatNumber(stats.ehp?.total || 0)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Speed</span>
                            <span class="stat-value">${Math.round(stats.speed || 0)} m/s</span>
                        </div>
                    </div>
                </div>`;
        }

        let visualFitHTML = '';
        if (parsedFit) {
            visualFitHTML = this.createCompactFittingVisual(parsedFit, shipTypeId);
        }

        return `
            <div class="fitting-card enhanced" data-fitting-id="${fitting.id}">
                <div class="fitting-header">
                    <div class="fitting-title">
                        <h4>${fitting.name}</h4>
                        <div class="ship-name">${fitting.ship_name}</div>
                        <p class="fitting-date">${lastUpdated}</p>
                    </div>
                    <div class="ship-render">
                        <img src="https://images.evetech.net/types/${shipTypeId}/render?size=128"
                             alt="${fitting.ship_name}"
                             class="ship-image"
                             onerror="this.src='https://images.evetech.net/types/${shipTypeId}/icon?size=64'" />
                    </div>
                </div>

                ${visualFitHTML}
                ${statsHTML}

                <div class="fitting-actions">
                    <button class="btn btn-small btn-primary" onclick="app.loadFittingToAnalysis(${fitting.id})">
                        <i class="fas fa-upload"></i> Load
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="app.toggleFittingDetails(${fitting.id})" data-eft="${encodeURIComponent(fitting.eft_format)}">
                        <i class="fas fa-eye"></i> Details
                    </button>
                    <button class="btn btn-small btn-secondary" onclick="app.editFitting(${fitting.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-small btn-danger" onclick="app.deleteFitting(${fitting.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>

                <div id="fitting-details-${fitting.id}" class="fitting-details-expanded" style="display: none;"></div>
            </div>
        `;
    }

    createCompactFittingVisual(parsedFit, shipTypeId) {
        if (!parsedFit.modules) return '';

        const modulesBySlot = {
            high: parsedFit.modules.high || [],
            med: parsedFit.modules.med || [],
            low: parsedFit.modules.low || [],
            rig: parsedFit.modules.rig || [],
            subsystem: parsedFit.modules.subsystem || []
        };

        const createSlotGroup = (slotType, modules, maxSlots = 8) => {
            const slots = [];

            // Add filled slots
            modules.forEach((module, index) => {
                if (index < maxSlots) {
                    const moduleTypeId = module.type_id || module.typeId;
                    console.log(`Module ${module.name}: type_id=${moduleTypeId}`);

                    if (moduleTypeId) {
                        slots.push(`
                            <div class="module-slot filled" title="${module.name}">
                                <img src="https://images.evetech.net/types/${moduleTypeId}/icon?size=32"
                                     alt="${module.name}"
                                     onerror="console.warn('Failed to load icon for type_id ${moduleTypeId}', this.src); this.src='/api/placeholder-icon'; this.onerror=null;"
                                     onload="console.log('Successfully loaded icon for ${module.name} (type_id: ${moduleTypeId})');"
                                     loading="lazy" />
                            </div>
                        `);
                    } else {
                        console.warn(`Module ${module.name} has no type_id, using text fallback`);
                        // Fallback for modules without type_id
                        slots.push(`
                            <div class="module-slot filled no-icon" title="${module.name}">
                                <span class="module-text">${module.name.substring(0, 3)}</span>
                            </div>
                        `);
                    }
                }
            });

            // Add empty slots up to max
            const filledCount = Math.min(modules.length, maxSlots);
            for (let i = filledCount; i < maxSlots && i < 8; i++) {
                slots.push(`<div class="module-slot empty"></div>`);
            }

            return `
                <div class="slot-group ${slotType}-slots">
                    <div class="slot-group-label">${slotType.toUpperCase()}</div>
                    <div class="slots-row">
                        ${slots.slice(0, Math.min(maxSlots, 8)).join('')}
                    </div>
                </div>
            `;
        };

        return `
            <div class="fitting-visual-compact">
                <div class="modules-layout">
                    ${createSlotGroup('high', modulesBySlot.high)}
                    ${createSlotGroup('med', modulesBySlot.med)}
                    ${createSlotGroup('low', modulesBySlot.low)}
                    ${modulesBySlot.rig.length > 0 ? createSlotGroup('rig', modulesBySlot.rig, 3) : ''}
                    ${modulesBySlot.subsystem.length > 0 ? createSlotGroup('sub', modulesBySlot.subsystem, 4) : ''}
                </div>
            </div>
        `;
    }

    toggleFittingDetails(fittingId) {
        const detailsDiv = document.getElementById(`fitting-details-${fittingId}`);
        if (!detailsDiv) return;

        if (detailsDiv.style.display === 'none') {
            // Show details - use existing renderFittingDetails functionality
            const button = document.querySelector(`[onclick*="toggleFittingDetails(${fittingId})"]`);
            if (button) {
                this.renderFittingDetails(fittingId, button);
                detailsDiv.style.display = 'block';
                button.innerHTML = '<i class="fas fa-eye-slash"></i> Hide';
            }
        } else {
            // Hide details
            detailsDiv.style.display = 'none';
            detailsDiv.innerHTML = '';
            const button = document.querySelector(`[onclick*="toggleFittingDetails(${fittingId})"]`);
            if (button) {
                button.innerHTML = '<i class="fas fa-eye"></i> Details';
            }
        }
    }

    async loadFittingToAnalysis(fittingId) {
        try {
            const response = await fetch(`/api/fleet/fittings/${fittingId}`);
            if (!response.ok) throw new Error('Failed to load fitting');

            const data = await response.json();
            const fitting = data.fitting;

            // Switch to combat tab and load fitting
            this.switchTab('combat');
            document.getElementById('your-eft-input').value = fitting.eft_format;

            // Parse the fitting
            await this.parseYourEFTFit();

            this.showSuccess(`Loaded fitting: ${fitting.name}`);
        } catch (error) {
            console.error('Error loading fitting:', error);
            this.showError('Failed to load fitting: ' + error.message);
        }
    }

    async deleteFitting(fittingId) {
        if (!confirm('Are you sure you want to delete this fitting?')) return;

        try {
            const response = await fetch(`/api/fleet/fittings/${fittingId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete fitting');
            }

            this.showSuccess('Fitting deleted successfully');
            await this.loadFittings();
        } catch (error) {
            console.error('Error deleting fitting:', error);
            this.showError('Failed to delete fitting: ' + error.message);
        }
    }

    // ========== FLEET MANAGEMENT ==========

    async loadFleets() {
        try {
            const response = await fetch('/api/fleet/fleets');
            if (!response.ok) throw new Error('Failed to load fleets');

            const data = await response.json();
            this.fleets = data.fleets;
            this.renderFleets();
        } catch (error) {
            console.error('Error loading fleets:', error);
            this.showError('Failed to load fleets: ' + error.message);
        }
    }

    async createFleet() {
        if (this.fittings.length === 0) {
            this.showError('You need some saved fittings before creating a fleet. Go to the Fittings section first.');
            return;
        }

        // Open the new drag-and-drop fleet builder
        this.openFleetBuilder();
    }

    openFleetBuilder(fleetId = null) {
        // Initialize fleet composition state
        this.currentFleetComposition = {
            line: [],
            logi: [],
            ewar: [],
            tackle: [],
            support: [],
            other: []
        };
        this.editingFleetId = fleetId;

        // Show modal
        const modal = document.getElementById('fleet-builder-modal');
        if (!modal) {
            this.showError('Fleet builder modal not found. Please refresh the page.');
            return;
        }
        modal.style.display = 'block';

        // Clear and populate fittings
        this.populateAvailableFittings();

        // Initialize drag-and-drop
        this.initializeFleetBuilderDragDrop();

        // Clear role zones
        this.clearRoleZones();

        // Update stats
        this.updateFleetStats();
    }

    populateAvailableFittings() {
        const container = document.getElementById('available-fittings-icons');
        if (!container) return;

        const html = this.fittings.map(fitting => `
            <div class="fitting-icon-item" draggable="true" data-fitting-id="${fitting.id}">
                <img src="https://images.evetech.net/types/${fitting.ship_type_id || 1}/icon?size=64"
                     alt="${fitting.ship_name}"
                     onerror="this.src='https://images.evetech.net/types/1/icon?size=64'" />
                <div class="fitting-icon-name" title="${fitting.name}">${fitting.name}</div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    initializeFleetBuilderDragDrop() {
        // Add drag listeners to fitting icons
        const fittingItems = document.querySelectorAll('.fitting-icon-item');
        fittingItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('fittingId', item.getAttribute('data-fitting-id'));
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
            });
        });

        // Add drop listeners to role zones
        const dropAreas = document.querySelectorAll('.role-zone-droparea');
        dropAreas.forEach(dropArea => {
            dropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                dropArea.classList.add('drag-over');
            });

            dropArea.addEventListener('dragleave', () => {
                dropArea.classList.remove('drag-over');
            });

            dropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                dropArea.classList.remove('drag-over');

                const fittingId = parseInt(e.dataTransfer.getData('fittingId'));
                const role = dropArea.getAttribute('data-role');

                this.addShipToRole(fittingId, role);
            });
        });
    }

    addShipToRole(fittingId, role) {
        const fitting = this.fittings.find(f => f.id === fittingId);
        if (!fitting) return;

        // Check if already in this role
        if (this.currentFleetComposition[role].some(s => s.fittingId === fittingId)) {
            this.showError('This fitting is already in this role');
            return;
        }

        // Add to composition
        const ship = {
            fittingId: fittingId,
            name: fitting.name,
            shipName: fitting.ship_name,
            shipTypeId: fitting.ship_type_id || 1,
            quantity: 1,
            role: role
        };

        this.currentFleetComposition[role].push(ship);
        this.renderRoleShips(role);
        this.updateFleetStats();
    }

    renderRoleShips(role) {
        const container = document.getElementById(`role-ships-${role}`);
        if (!container) return;

        const ships = this.currentFleetComposition[role];
        const html = ships.map((ship, index) => `
            <div class="fleet-role-ship" data-role="${role}" data-index="${index}">
                <img src="https://images.evetech.net/types/${ship.shipTypeId}/icon?size=64"
                     alt="${ship.shipName}"
                     onerror="this.src='https://images.evetech.net/types/1/icon?size=64'" />
                <div class="fleet-role-ship-info">
                    <div class="fleet-role-ship-name">${ship.name}</div>
                    <div class="fleet-role-ship-ship">${ship.shipName}</div>
                    <div class="fleet-role-ship-quantity">
                        <label>Qty:</label>
                        <input type="number" min="1" max="999" value="${ship.quantity}"
                               onchange="app.updateShipQuantity('${role}', ${index}, this.value)">
                    </div>
                </div>
                <button class="fleet-role-ship-remove" onclick="app.removeShipFromRole('${role}', ${index})">×</button>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    updateShipQuantity(role, index, quantity) {
        const qty = parseInt(quantity);
        if (qty < 1) return;

        this.currentFleetComposition[role][index].quantity = qty;
        this.updateFleetStats();
    }

    removeShipFromRole(role, index) {
        this.currentFleetComposition[role].splice(index, 1);
        this.renderRoleShips(role);
        this.updateFleetStats();
    }

    clearRoleZones() {
        Object.keys(this.currentFleetComposition).forEach(role => {
            this.currentFleetComposition[role] = [];
            this.renderRoleShips(role);
        });
    }

    updateFleetStats() {
        // Calculate total ships
        let totalShips = 0;
        Object.values(this.currentFleetComposition).forEach(roleShips => {
            roleShips.forEach(ship => {
                totalShips += ship.quantity;
            });
        });

        // Update display
        document.getElementById('fleet-total-ships').textContent = totalShips;

        // TODO: Calculate DPS and EHP from fittings
        document.getElementById('fleet-total-dps').textContent = '0';
        document.getElementById('fleet-total-ehp').textContent = '0';
    }

    closeFleetBuilder() {
        const modal = document.getElementById('fleet-builder-modal');
        modal.style.display = 'none';
        this.currentFleetComposition = null;
        this.editingFleetId = null;
    }

    async saveFleetComposition() {
        const fleetName = document.getElementById('fleet-builder-name').value.trim();
        if (!fleetName) {
            this.showError('Please enter a fleet name');
            return;
        }

        // Check if there are any ships
        const hasShips = Object.values(this.currentFleetComposition).some(roleShips => roleShips.length > 0);
        if (!hasShips) {
            this.showError('Please add at least one ship to the fleet');
            return;
        }

        try {
            this.showLoading('Saving fleet...');

            // Create the fleet
            const fleetResponse = await fetch('/api/fleet/fleets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: fleetName,
                    description: ''
                })
            });

            if (!fleetResponse.ok) {
                throw new Error('Failed to create fleet');
            }

            const fleetData = await fleetResponse.json();
            const fleetId = fleetData.fleetId;

            // Add ships to the fleet
            for (const role of Object.keys(this.currentFleetComposition)) {
                for (const ship of this.currentFleetComposition[role]) {
                    await fetch(`/api/fleet/fleets/${fleetId}/ships`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fittingId: ship.fittingId,
                            quantity: ship.quantity,
                            role: role,
                            notes: ''
                        })
                    });
                }
            }

            this.showSuccess('Fleet saved successfully');
            this.closeFleetBuilder();
            await this.loadFleets();
        } catch (error) {
            console.error('Error saving fleet:', error);
            this.showError('Failed to save fleet: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderFleets() {
        console.log('=== renderFleets called ===');

        // Find all fleets-list elements (original and cloned)
        const fleetsLists = document.querySelectorAll('#fleets-list');
        console.log('fleets-list elements found:', fleetsLists.length);
        if (fleetsLists.length === 0) return;

        console.log('Number of fleets to render:', this.fleets.length);

        const content = this.fleets.length === 0
            ? '<div style="color: white; background: #2a4a6b; padding: 20px; border: 2px solid #00d4ff; border-radius: 8px; text-align: center;"><p><i class="fas fa-info-circle"></i> No fleets found.</p><p>Create your first fleet to get started!</p><button class="btn btn-primary" onclick="app.createFleet()"><i class="fas fa-plus"></i> Create Fleet</button></div>'
            : this.fleets.map(fleet => `
                <div class="fleet-card" data-fleet-id="${fleet.id}">
                    <h4>${fleet.name}</h4>
                    <div class="fleet-stats">
                        <div class="fleet-stat">
                            <div class="stat-value">${fleet.total_ships || 0}</div>
                            <div class="stat-label">Total Ships</div>
                        </div>
                        <div class="fleet-stat">
                            <div class="stat-value">${fleet.ship_count || 0}</div>
                            <div class="stat-label">Ship Types</div>
                        </div>
                    </div>
                    <div class="fleet-actions">
                        <button class="btn btn-small btn-primary" onclick="app.viewFleet(${fleet.id})">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="app.editFleet(${fleet.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteFleet(${fleet.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');

        // Update all fleets-list elements
        fleetsLists.forEach(list => {
            list.innerHTML = content;
        });

        console.log('Rendered', this.fleets.length, 'fleets');
    }

    async viewFleet(fleetId) {
        // TODO: Implement fleet view modal
        this.showError('Fleet view not yet implemented');
    }

    async editFleet(fleetId) {
        // TODO: Load fleet composition and open fleet builder in edit mode
        this.showError('Fleet editing not yet implemented');
    }

    async deleteFleet(fleetId) {
        if (!confirm('Are you sure you want to delete this fleet?')) {
            return;
        }

        try {
            const response = await fetch(`/api/fleet/fleets/${fleetId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete fleet');
            }

            this.showSuccess('Fleet deleted successfully');
            await this.loadFleetData();
        } catch (error) {
            console.error('Error deleting fleet:', error);
            this.showError('Failed to delete fleet: ' + error.message);
        }
    }

    // ========== BATTLE SCENARIOS ==========

    async loadBattleScenarios() {
        try {
            console.log('Loading battle scenarios...');
            const response = await fetch('/api/fleet/scenarios');
            if (!response.ok) throw new Error('Failed to load battle scenarios');

            const data = await response.json();
            this.scenarios = data.scenarios;
            console.log('Loaded', this.scenarios.length, 'scenarios');
            this.renderBattleScenarios();

            // Also populate the available fleets for scenario builder
            console.log('Populating available fleets for drag-and-drop...');
            this.populateAvailableFleets();
        } catch (error) {
            console.error('Error loading battle scenarios:', error);
            this.showError('Failed to load battle scenarios: ' + error.message);
        }
    }

    populateAvailableFleets() {
        console.log('populateAvailableFleets - fleets:', this.fleets);

        // Work on both original and temp area elements
        const searchContainers = [document, document.getElementById('temp-fleet-area')].filter(c => c);

        searchContainers.forEach(searchContainer => {
            const container = searchContainer.querySelector('#available-fleets-list');
            console.log(`populateAvailableFleets - container in ${searchContainer.id || 'document'}:`, container);

            if (!container) {
                console.error(`available-fleets-list container not found in ${searchContainer.id || 'document'}!`);
                return;
            }

            const html = this.fleets.map(fleet => `
                <div class="fleet-drag-card" draggable="true" data-fleet-id="${fleet.id}">
                    <div class="fleet-drag-card-name">${fleet.name}</div>
                    <div class="fleet-drag-card-stats">
                        <span>${fleet.total_ships || 0} ships</span>
                        <span>${fleet.ship_count || 0} types</span>
                    </div>
                </div>
            `).join('');

            console.log(`Generated fleet cards HTML for ${searchContainer.id || 'document'}:`, html);
            container.innerHTML = html || '<p style="color: #999; text-align: center; padding: 2rem;">No fleets available. Create fleets first!</p>';
            console.log(`Container after setting innerHTML in ${searchContainer.id || 'document'}:`, container);
        });

        // Initialize drag-and-drop for fleet cards
        this.initializeScenarioDragDrop();
    }

    initializeScenarioDragDrop() {
        // Add drag listeners to fleet cards
        const fleetCards = document.querySelectorAll('.fleet-drag-card');
        fleetCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('fleetId', card.getAttribute('data-fleet-id'));
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
            });
        });

        // Add drop listeners to fleet drop areas
        const dropAreas = document.querySelectorAll('.fleet-droparea');
        dropAreas.forEach(dropArea => {
            dropArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                dropArea.classList.add('drag-over');
            });

            dropArea.addEventListener('dragleave', () => {
                dropArea.classList.remove('drag-over');
            });

            dropArea.addEventListener('drop', (e) => {
                e.preventDefault();
                dropArea.classList.remove('drag-over');

                const fleetId = parseInt(e.dataTransfer.getData('fleetId'));
                const side = dropArea.getAttribute('data-side');

                this.addFleetToScenario(fleetId, side);
            });
        });
    }

    addFleetToScenario(fleetId, side) {
        const fleet = this.fleets.find(f => f.id === fleetId);
        if (!fleet) return;

        // Store the fleet assignment
        if (side === 'friendly') {
            this.scenarioFriendlyFleet = fleet;
        } else {
            this.scenarioEnemyFleet = fleet;
        }

        // Render the fleet in the slot (work on both original and cloned)
        const slots = document.querySelectorAll(`#${side}-fleet-slot`);
        const html = `
            <div class="fleet-slot-card">
                <div class="fleet-slot-card-header">
                    <div class="fleet-slot-card-name">${fleet.name}</div>
                    <button class="fleet-slot-card-remove" onclick="app.removeFleetFromScenario('${side}')">×</button>
                </div>
                <div class="fleet-slot-card-stats">
                    <span>${fleet.total_ships || 0} ships</span>
                    <span>${fleet.ship_count || 0} types</span>
                </div>
            </div>
        `;

        slots.forEach(slot => {
            slot.innerHTML = html;
        });

        // Update button states
        this.updateScenarioButtons();
    }

    removeFleetFromScenario(side) {
        if (side === 'friendly') {
            this.scenarioFriendlyFleet = null;
        } else {
            this.scenarioEnemyFleet = null;
        }

        const slots = document.querySelectorAll(`#${side}-fleet-slot`);
        slots.forEach(slot => {
            slot.innerHTML = '';
        });

        this.updateScenarioButtons();
    }

    clearScenarioBuilder() {
        this.scenarioFriendlyFleet = null;
        this.scenarioEnemyFleet = null;

        document.querySelectorAll('#friendly-fleet-slot').forEach(el => el.innerHTML = '');
        document.querySelectorAll('#enemy-fleet-slot').forEach(el => el.innerHTML = '');
        document.querySelectorAll('#scenario-name-input').forEach(el => el.value = '');
        document.querySelectorAll('#scenario-notes-textarea').forEach(el => el.value = '');

        this.updateScenarioButtons();
    }

    updateScenarioButtons() {
        const saveBtns = document.querySelectorAll('#save-scenario-btn');
        const analyzeBtns = document.querySelectorAll('#analyze-scenario-btn');

        const bothFleetsSelected = this.scenarioFriendlyFleet && this.scenarioEnemyFleet;

        saveBtns.forEach(btn => { btn.disabled = !bothFleetsSelected; });
        analyzeBtns.forEach(btn => { btn.disabled = !bothFleetsSelected; });
    }

    async saveScenario() {
        // Get values from the first matching element
        const nameInput = document.querySelector('#scenario-name-input');
        const scenarioName = nameInput ? nameInput.value.trim() : '';

        if (!scenarioName) {
            this.showError('Please enter a scenario name');
            return;
        }

        if (!this.scenarioFriendlyFleet || !this.scenarioEnemyFleet) {
            this.showError('Please select both fleets');
            return;
        }

        if (this.scenarioFriendlyFleet.id === this.scenarioEnemyFleet.id) {
            this.showError('Please select different fleets');
            return;
        }

        const notesInput = document.querySelector('#scenario-notes-textarea');
        const notes = notesInput ? notesInput.value.trim() : '';

        try {
            this.showLoading('Saving scenario...');

            const response = await fetch('/api/fleet/scenarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: scenarioName,
                    friendlyFleetId: this.scenarioFriendlyFleet.id,
                    enemyFleetId: this.scenarioEnemyFleet.id,
                    scenarioNotes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create battle scenario');
            }

            this.showSuccess('Battle scenario saved successfully');
            this.clearScenarioBuilder();
            await this.loadBattleScenarios();
        } catch (error) {
            console.error('Error saving scenario:', error);
            this.showError('Failed to save scenario: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async analyzeScenarioNow() {
        const nameInput = document.querySelector('#scenario-name-input');
        const scenarioName = nameInput ? nameInput.value.trim() : '';

        if (!this.scenarioFriendlyFleet || !this.scenarioEnemyFleet) {
            this.showError('Please select both fleets');
            return;
        }

        if (this.scenarioFriendlyFleet.id === this.scenarioEnemyFleet.id) {
            this.showError('Please select different fleets');
            return;
        }

        const notesInput = document.querySelector('#scenario-notes-textarea');
        const notes = notesInput ? notesInput.value.trim() : '';

        this.showLoading('Analyzing fleet battle...');

        try {
            const response = await fetch('/api/fleet/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    friendlyFleetId: this.scenarioFriendlyFleet.id,
                    enemyFleetId: this.scenarioEnemyFleet.id,
                    notes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze fleets');
            }

            const data = await response.json();
            this.showFleetAnalysisResults(data.analysis, false);
        } catch (error) {
            console.error('Error analyzing fleets:', error);
            this.showError('Failed to analyze fleets: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async createBattleScenario() {
        if (this.fleets.length < 2) {
            this.showError('You need at least 2 fleets to create a battle scenario');
            return;
        }

        // Simple battle scenario creation using prompts
        const scenarioName = prompt('Enter battle scenario name:');
        if (!scenarioName) return;

        const fleetOptions = this.fleets.map((fleet, index) => `${index + 1}. ${fleet.name}`).join('\n');

        const friendlyChoice = prompt(`Select friendly fleet:\n${fleetOptions}\n\nEnter number:`);
        if (!friendlyChoice) return;

        const friendlyIndex = parseInt(friendlyChoice) - 1;
        if (friendlyIndex < 0 || friendlyIndex >= this.fleets.length) {
            this.showError('Invalid fleet selection');
            return;
        }

        const enemyChoice = prompt(`Select enemy fleet:\n${fleetOptions}\n\nEnter number (different from ${friendlyChoice}):`);
        if (!enemyChoice) return;

        const enemyIndex = parseInt(enemyChoice) - 1;
        if (enemyIndex < 0 || enemyIndex >= this.fleets.length || enemyIndex === friendlyIndex) {
            this.showError('Invalid enemy fleet selection');
            return;
        }

        const notes = prompt('Enter scenario notes (optional):') || '';

        try {
            const response = await fetch('/api/fleet/scenarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: scenarioName,
                    friendlyFleetId: this.fleets[friendlyIndex].id,
                    enemyFleetId: this.fleets[enemyIndex].id,
                    scenarioNotes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create battle scenario');
            }

            this.showSuccess('Battle scenario created successfully');
            await this.loadBattleScenarios();
        } catch (error) {
            console.error('Error creating battle scenario:', error);
            this.showError('Failed to create battle scenario: ' + error.message);
        }
    }

    showBattleScenarioModal() {
        // Create modal HTML
        const modalHtml = `
            <div class="modal" id="battle-scenario-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create Battle Scenario</h3>
                        <span class="close" onclick="app.closeBattleScenarioModal()">&times;</span>
                    </div>
                    <div class="form-group">
                        <label for="scenario-name">Scenario Name:</label>
                        <input type="text" id="scenario-name" placeholder="Enter scenario name">
                    </div>
                    <div class="form-group">
                        <label for="friendly-fleet">Friendly Fleet:</label>
                        <select id="friendly-fleet">
                            <option value="">Select friendly fleet...</option>
                            ${this.fleets.map(fleet => `<option value="${fleet.id}">${fleet.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="enemy-fleet">Enemy Fleet:</label>
                        <select id="enemy-fleet">
                            <option value="">Select enemy fleet...</option>
                            ${this.fleets.map(fleet => `<option value="${fleet.id}">${fleet.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="scenario-notes">Notes (optional):</label>
                        <textarea id="scenario-notes" placeholder="Additional scenario details..."></textarea>
                    </div>
                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="app.closeBattleScenarioModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.saveBattleScenario()">Create Scenario</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('battle-scenario-modal').style.display = 'block';
    }

    closeBattleScenarioModal() {
        const modal = document.getElementById('battle-scenario-modal');
        if (modal) {
            modal.remove();
        }
    }

    async saveBattleScenario() {
        const name = document.getElementById('scenario-name').value.trim();
        const friendlyFleetId = document.getElementById('friendly-fleet').value;
        const enemyFleetId = document.getElementById('enemy-fleet').value;
        const notes = document.getElementById('scenario-notes').value.trim();

        if (!name || !friendlyFleetId || !enemyFleetId) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (friendlyFleetId === enemyFleetId) {
            this.showError('Friendly and enemy fleets must be different');
            return;
        }

        try {
            const response = await fetch('/api/fleet/scenarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    friendlyFleetId: parseInt(friendlyFleetId),
                    enemyFleetId: parseInt(enemyFleetId),
                    scenarioNotes: notes
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create battle scenario');
            }

            this.closeBattleScenarioModal();
            this.showSuccess('Battle scenario created successfully');
            await this.loadBattleScenarios();
        } catch (error) {
            console.error('Error creating battle scenario:', error);
            this.showError('Failed to create battle scenario: ' + error.message);
        }
    }

    renderBattleScenarios() {
        console.log('=== renderBattleScenarios called ===');

        // Find all scenarios-list elements (original and cloned)
        const scenariosLists = document.querySelectorAll('#scenarios-list');
        console.log('scenarios-list elements found:', scenariosLists.length);
        if (scenariosLists.length === 0) return;

        console.log('Number of scenarios to render:', this.scenarios.length);

        const content = this.scenarios.length === 0
            ? '<div style="color: white; background: #2a4a6b; padding: 20px; border: 2px solid #00d4ff; border-radius: 8px; text-align: center;"><p><i class="fas fa-info-circle"></i> No battle scenarios found.</p><p>Create your first scenario to get started!</p><p><small>Note: You need at least 2 fleets to create a battle scenario.</small></p><button class="btn btn-primary" onclick="app.createBattleScenario()"><i class="fas fa-plus"></i> Create Scenario</button></div>'
            : this.scenarios.map(scenario => `
                <div class="scenario-card" data-scenario-id="${scenario.id}">
                    <h4>${scenario.name}</h4>
                    <div class="fleet-vs">
                        <div class="fleet-name">${scenario.friendly_fleet_name}</div>
                        <div class="vs-label">VS</div>
                        <div class="fleet-name">${scenario.enemy_fleet_name}</div>
                    </div>
                    <div class="scenario-actions">
                        <button class="btn btn-small btn-primary" onclick="app.analyzeScenario(${scenario.id}, event)" title="Click to analyze (Shift+Click for fresh analysis)">
                            <i class="fas fa-chart-line"></i> Analyze
                        </button>
                        <button class="btn btn-small btn-secondary" onclick="app.editScenario(${scenario.id})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-small btn-danger" onclick="app.deleteScenario(${scenario.id})">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `).join('');

        // Update all scenarios-list elements
        scenariosLists.forEach(list => {
            list.innerHTML = content;
        });

        console.log('Rendered', this.scenarios.length, 'scenarios');
    }

    async analyzeScenario(scenarioId, event) {
        const noCache = event && event.shiftKey;
        this.showLoading(noCache ? 'Forcing fresh analysis...' : 'Analyzing fleet battle...');

        try {
            const url = `/api/fleet/analyze/${scenarioId}${noCache ? '?no-cache=true' : ''}`;
            const response = await fetch(url, {
                method: 'POST'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze scenario');
            }

            const data = await response.json();
            this.showFleetAnalysisResults(data.analysis, data.cached, scenarioId);
        } catch (error) {
            console.error('Error analyzing scenario:', error);
            this.showError('Failed to analyze scenario: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    showFleetAnalysisResults(analysis, cached = false, scenarioId = null) {
        console.log('=== showFleetAnalysisResults called ===');
        console.log('Analysis object:', analysis);
        console.log('Cached:', cached);

        // Handle different response structures
        const analysisData = analysis.analysis || analysis;
        console.log('Analysis data:', analysisData);

        // Basic fallback values
        const winChance = analysisData.winChance || analysisData.winPercentage || 'Unknown';
        const advantages = analysisData.advantages || [];
        const disadvantages = analysisData.disadvantages || [];
        const tactics = analysisData.recommendations?.tactics || analysisData.tactics || [];
        const summary = analysisData.summary || 'Analysis completed successfully.';

        // Cache indicator and fresh analysis button
        const cacheIndicator = cached ? `
            <div style="background: #ff6b35; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
                <span>📋 Showing cached analysis results</span>
                ${scenarioId ? `<button onclick="app.forceAnalysis(${scenarioId})" style="background: #00d4ff; color: #1a2332; border: none; padding: 5px 15px; border-radius: 3px; cursor: pointer; font-weight: bold;">Force Fresh Analysis</button>` : ''}
            </div>
        ` : `
            <div style="background: #28a745; color: white; padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                <span>🚀 Fresh AI analysis results</span>
            </div>
        `;

        const resultsHtml = `
            <div class="modal" id="analysis-results-modal" style="display: block; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8);">
                <div class="modal-content" style="background-color: #1a2332; margin: 5% auto; padding: 20px; border: 2px solid #00d4ff; border-radius: 10px; width: 90%; max-width: 1000px; color: white; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #00d4ff;">
                        <h3 style="color: #00d4ff; margin: 0;">🚀 Fleet Battle Analysis</h3>
                        <span class="close" onclick="app.closeAnalysisModal()" style="color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer;">&times;</span>
                    </div>
                    ${cacheIndicator}
                    <div class="analysis-results">
                        <div class="win-chance" style="text-align: center; margin-bottom: 20px; padding: 20px; background: #2a4a6b; border-radius: 8px;">
                            <div class="win-percentage" style="font-size: 3em; font-weight: bold; color: #00ff88;">${winChance}${typeof winChance === 'number' ? '%' : ''}</div>
                            <div style="font-size: 1.2em; margin-top: 10px;">Win Chance</div>
                        </div>

                        <div class="fleet-stats-comparison" style="display: flex; justify-content: space-between; margin-bottom: 20px; gap: 20px;">
                            ${this.createFleetStatsHTML('Friendly Fleet', analysis.friendlyFleet.stats)}
                            ${this.createFleetStatsHTML('Enemy Fleet', analysis.enemyFleet.stats)}
                        </div>

                        ${advantages.length > 0 ? `
                        <div class="analysis-section" style="margin-bottom: 20px;">
                            <h4 style="color: #00ff88; border-bottom: 1px solid #00ff88; padding-bottom: 5px;">✅ Your Advantages</h4>
                            <ul class="analysis-list" style="list-style: none; padding-left: 0;">
                                ${advantages.map(adv => `<li style="padding: 8px 0; border-left: 3px solid #00ff88; padding-left: 15px; margin: 5px 0;">• ${adv}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${disadvantages.length > 0 ? `
                        <div class="analysis-section" style="margin-bottom: 20px;">
                            <h4 style="color: #ff6b6b; border-bottom: 1px solid #ff6b6b; padding-bottom: 5px;">⚠️ Your Disadvantages</h4>
                            <ul class="analysis-list" style="list-style: none; padding-left: 0;">
                                ${disadvantages.map(dis => `<li style="padding: 8px 0; border-left: 3px solid #ff6b6b; padding-left: 15px; margin: 5px 0;">• ${dis}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${tactics.length > 0 ? `
                        <div class="analysis-section" style="margin-bottom: 20px;">
                            <h4 style="color: #ffd700; border-bottom: 1px solid #ffd700; padding-bottom: 5px;">🎯 Tactical Recommendations</h4>
                            <ul class="analysis-list" style="list-style: none; padding-left: 0;">
                                ${tactics.map(tac => `<li style="padding: 8px 0; border-left: 3px solid #ffd700; padding-left: 15px; margin: 5px 0;">• ${tac}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        <div class="analysis-section" style="margin-bottom: 20px;">
                            <h4 style="color: #00d4ff; border-bottom: 1px solid #00d4ff; padding-bottom: 5px;">📋 Summary</h4>
                            <p style="padding: 15px; background: #2a4a6b; border-radius: 8px; line-height: 1.6;">${summary}</p>
                        </div>

                        <div style="text-align: center; margin-top: 30px;">
                            <button onclick="app.closeAnalysisModal()" style="background: #00d4ff; color: #1a2332; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold;">Close Analysis</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove any existing modal first
        const existingModal = document.getElementById('analysis-results-modal');
        if (existingModal) existingModal.remove();

        document.body.insertAdjacentHTML('beforeend', resultsHtml);
        console.log('Modal added to DOM');
    }

    createFleetStatsHTML(title, stats) {
        if (!stats) return '';

        return `
            <div class="fleet-stats-container" style="flex: 1; background: #2a4a6b; padding: 15px; border-radius: 8px;">
                <h4 style="color: #00d4ff; margin-top: 0; margin-bottom: 10px; text-align: center;">${title}</h4>
                <table style="width: 100%; border-collapse: collapse;">
                    <tbody>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">Total Ships</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right; font-weight: bold;">${stats.totalShips}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">Total DPS</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right; font-weight: bold;">${this.formatNumber(stats.totalDps.total)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">Total EHP</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right; font-weight: bold;">${this.formatNumber(stats.totalEhp.total)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">Alpha Strike</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right; font-weight: bold;">${this.formatNumber(stats.totalAlpha.total)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">DPS (EM)</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right;">${this.formatNumber(stats.totalDps.em)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">DPS (Therm)</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right;">${this.formatNumber(stats.totalDps.thermal)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">DPS (Kin)</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right;">${this.formatNumber(stats.totalDps.kinetic)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px; border-bottom: 1px solid #445;">DPS (Exp)</td>
                            <td style="padding: 5px; border-bottom: 1px solid #445; text-align: right;">${this.formatNumber(stats.totalDps.explosive)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    closeAnalysisModal() {
        const modal = document.getElementById('analysis-results-modal');
        if (modal) {
            modal.remove();
        }
    }

    async forceAnalysis(scenarioId) {
        this.closeAnalysisModal();
        await this.analyzeScenario(scenarioId, { shiftKey: true });
    }

    async deleteScenario(scenarioId) {
        if (!confirm('Are you sure you want to delete this battle scenario?')) return;

        try {
            const response = await fetch(`/api/fleet/scenarios/${scenarioId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to delete scenario');
            }

            this.showSuccess('Battle scenario deleted successfully');
            await this.loadBattleScenarios();
        } catch (error) {
            console.error('Error deleting scenario:', error);
            this.showError('Failed to delete scenario: ' + error.message);
        }
    }

    // ========== FLEET VS FLEET MODAL ==========

    showFleetVsFleetModal() {
        if (this.fleets.length < 2) {
            this.showError('You need at least 2 saved fleets to run a fleet vs fleet analysis. Create some fleets first!');
            return;
        }

        const modalHtml = `
            <div class="modal fleet-vs-fleet-modal" id="fleet-vs-fleet-modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Fleet vs Fleet Analysis</h3>
                        <span class="close" onclick="app.closeFleetVsFleetModal()">&times;</span>
                    </div>

                    <div class="fleet-selection">
                        <div class="fleet-selector">
                            <h4>Your Fleet</h4>
                            <select id="friendly-fleet-select">
                                <option value="">Select your fleet...</option>
                                ${this.fleets.map(fleet => `<option value="${fleet.id}">${fleet.name}</option>`).join('')}
                            </select>
                            <div class="fleet-preview" id="friendly-fleet-preview">
                                Select a fleet to see details
                            </div>
                        </div>

                        <div class="vs-divider">VS</div>

                        <div class="fleet-selector">
                            <h4>Enemy Fleet</h4>
                            <select id="enemy-fleet-select">
                                <option value="">Select enemy fleet...</option>
                                ${this.fleets.map(fleet => `<option value="${fleet.id}">${fleet.name}</option>`).join('')}
                            </select>
                            <div class="fleet-preview" id="enemy-fleet-preview">
                                Select a fleet to see details
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="scenario-context">Battle Context (optional):</label>
                        <textarea id="scenario-context" placeholder="Describe the battle scenario (gate fight, station defense, etc.)"></textarea>
                    </div>

                    <div class="form-actions">
                        <button class="btn btn-secondary" onclick="app.closeFleetVsFleetModal()">Cancel</button>
                        <button class="btn btn-primary" onclick="app.analyzeFleetVsFleet()">
                            <i class="fas fa-chart-line"></i> Analyze Battle
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        document.getElementById('fleet-vs-fleet-modal').style.display = 'block';

        // Add fleet selection change handlers
        document.getElementById('friendly-fleet-select').addEventListener('change', (e) => {
            this.updateFleetPreview('friendly-fleet-preview', e.target.value);
        });

        document.getElementById('enemy-fleet-select').addEventListener('change', (e) => {
            this.updateFleetPreview('enemy-fleet-preview', e.target.value);
        });
    }

    updateFleetPreview(previewId, fleetId) {
        const preview = document.getElementById(previewId);
        if (!fleetId) {
            preview.textContent = 'Select a fleet to see details';
            return;
        }

        const fleet = this.fleets.find(f => f.id == fleetId);
        if (fleet) {
            preview.innerHTML = `
                <strong>${fleet.total_ships || 0}</strong> ships,
                <strong>${fleet.ship_count || 0}</strong> ship types
            `;
        }
    }

    closeFleetVsFleetModal() {
        const modal = document.getElementById('fleet-vs-fleet-modal');
        if (modal) {
            modal.remove();
        }
    }

    async analyzeFleetVsFleet() {
        const friendlyFleetId = document.getElementById('friendly-fleet-select').value;
        const enemyFleetId = document.getElementById('enemy-fleet-select').value;
        const context = document.getElementById('scenario-context').value.trim();

        if (!friendlyFleetId || !enemyFleetId) {
            this.showError('Please select both fleets');
            return;
        }

        if (friendlyFleetId === enemyFleetId) {
            this.showError('Please select different fleets');
            return;
        }

        this.showLoading('Analyzing fleet battle...');

        try {
            const response = await fetch('/api/fleet/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    friendlyFleetId: parseInt(friendlyFleetId),
                    enemyFleetId: parseInt(enemyFleetId),
                    notes: context
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to analyze fleets');
            }

            const data = await response.json();
            this.closeFleetVsFleetModal();
            this.showFleetAnalysisResults(data.analysis, false);
        } catch (error) {
            console.error('Error analyzing fleets:', error);
            this.showError('Failed to analyze fleets: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new EVEFightTaker();
});