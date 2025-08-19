class EVEFightTaker {
    constructor() {
        this.currentShipStats = null;
        this.currentShipFit = null;
        this.targetShipStats = null;
        this.targetShipFit = null;
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
            alert('Please enter your EFT fit or zKillboard URL.');
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
            alert('Failed to parse your fit data. Please check the format and try again.');
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
            alert('Please enter an EFT fit or zKillboard URL.');
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
            alert('Failed to parse fit data. Please check the format and try again.');
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
        if (!this.currentShipStats || !this.targetShipStats || !this.currentShipFit || !this.targetShipFit) {
            alert('Please load both your current ship and a target ship first.');
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
            // Italic text: *text* or _text_
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/_(.*?)_/g, '<em>$1</em>')
            // Code: `code`
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Links: [text](url)
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    showLoading() {
        document.getElementById('loading').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading').style.display = 'none';
    }

    async loadStoredFittings() {
        if (!this.isAuthenticated) {
            alert('Please log in with EVE SSO to load stored fittings.');
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
            alert('Failed to load stored fittings. Please ensure you are logged in and have granted the necessary ESI scope.');
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
        const dropdownList = document.getElementById('fittings-dropdown-list');
        
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
        const options = document.querySelectorAll('.dropdown-option');
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
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = currentIndex < visibleOptions.length - 1 ? currentIndex + 1 : 0;
                this.selectFitting(visibleOptions[nextIndex].dataset.index, visibleOptions[nextIndex]);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : visibleOptions.length - 1;
                this.selectFitting(visibleOptions[prevIndex].dataset.index, visibleOptions[prevIndex]);
                break;
                
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
            alert('Please select a fitting to load.');
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
            alert('Failed to load selected fitting. ' + error.message);
        } finally {
            this.hideLoading();
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new EVEFightTaker();
});