const { expect } = require('chai');
const { JSDOM } = require('jsdom');

describe('Fleet View Modal', function() {
    let dom, window, document, app;

    beforeEach(function() {
        // Create a DOM environment for testing
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="fleet-view-modal" class="modal">
                    <div class="modal-content fleet-view-content">
                        <div class="modal-header">
                            <h3 id="fleet-view-title">Fleet Details</h3>
                            <span class="close" onclick="app.closeFleetView()">&times;</span>
                        </div>
                        <div class="fleet-view-body">
                            <div class="fleet-overview">
                                <div class="fleet-meta">
                                    <h4 id="fleet-view-name">Fleet Name</h4>
                                    <p id="fleet-view-description">Fleet description</p>
                                </div>
                                <div class="fleet-stats-dashboard">
                                    <div class="stat-card">
                                        <div class="stat-value" id="fleet-view-ships">0</div>
                                        <div class="stat-label">Total Ships</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value" id="fleet-view-dps">0</div>
                                        <div class="stat-label">Total DPS</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value" id="fleet-view-ehp">0</div>
                                        <div class="stat-label">Total EHP</div>
                                    </div>
                                    <div class="stat-card">
                                        <div class="stat-value" id="fleet-view-types">0</div>
                                        <div class="stat-label">Ship Types</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `, { url: 'http://localhost' });

        window = dom.window;
        document = window.document;
        global.window = window;
        global.document = document;

        // Mock fetch for API calls
        global.fetch = async (url) => {
            if (url.includes('/api/fleet/fleets/')) {
                return {
                    ok: true,
                    json: async () => ({
                        fleet: {
                            id: 1,
                            name: 'Test Fleet',
                            description: 'Test Description'
                        },
                        composition: [
                            {
                                fitting_id: 1,
                                fitting_name: 'Rifter PvP',
                                ship_name: 'Rifter',
                                quantity: 5,
                                role: 'tackle'
                            },
                            {
                                fitting_id: 2,
                                fitting_name: 'Hurricane Fleet',
                                ship_name: 'Hurricane',
                                quantity: 2,
                                role: 'dps'
                            }
                        ],
                        stats: {
                            total_ships: 7,
                            ship_types: 2,
                            total_dps: 3500,
                            total_ehp: 125000,
                            roleBreakdown: {
                                tackle: 5,
                                dps: 2
                            },
                            shipClasses: {
                                Frigate: 5,
                                Battlecruiser: 2
                            }
                        }
                    })
                };
            }
            throw new Error('Unknown URL');
        };

        // Create mock app object
        app = {
            currentViewingFleetId: null,
            showError: (message) => console.error(message),

            async viewFleet(fleetId) {
                try {
                    const response = await fetch(`/api/fleet/fleets/${fleetId}`);
                    if (!response.ok) throw new Error('Failed to load fleet details');

                    const data = await response.json();
                    const fleet = data.fleet;
                    const composition = data.composition || [];
                    const stats = data.stats || {};

                    this.currentViewingFleetId = fleetId;

                    // Create working fleet modal
                    const workingModal = document.createElement('div');
                    workingModal.id = 'working-fleet-modal';
                    workingModal.innerHTML = `
                        <div style="background: linear-gradient(135deg, #0c1821 0%, #1a2332 50%, #243447 100%); border: 2px solid #00d4ff; border-radius: 12px; padding: 2rem; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 99999; max-width: 900px; max-height: 90vh; overflow-y: auto; color: white;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid rgba(0, 212, 255, 0.3); padding-bottom: 1rem;">
                                <h3 style="color: #00d4ff; margin: 0;" id="modal-fleet-name">${fleet.name}</h3>
                                <span onclick="document.getElementById('working-fleet-modal').remove()" style="cursor: pointer; font-size: 1.5rem; color: #00d4ff;">&times;</span>
                            </div>
                            <div style="margin-bottom: 2rem;">
                                <p style="color: #b0b0b0; margin-bottom: 2rem;" id="modal-fleet-description">${fleet.description || 'No description provided'}</p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 1rem; text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;" id="modal-total-ships">${stats.total_ships || 0}</div>
                                        <div style="font-size: 0.9rem; color: #b0b0b0;">Total Ships</div>
                                    </div>
                                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 1rem; text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;" id="modal-total-dps">${(stats.total_dps || 0).toLocaleString()}</div>
                                        <div style="font-size: 0.9rem; color: #b0b0b0;">Total DPS</div>
                                    </div>
                                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 1rem; text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;" id="modal-total-ehp">${(stats.total_ehp || 0).toLocaleString()}</div>
                                        <div style="font-size: 0.9rem; color: #b0b0b0;">Total EHP</div>
                                    </div>
                                    <div style="background: rgba(0, 212, 255, 0.1); border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 8px; padding: 1rem; text-align: center;">
                                        <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;" id="modal-ship-types">${stats.ship_types || 0}</div>
                                        <div style="font-size: 0.9rem; color: #b0b0b0;">Ship Types</div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 style="color: #00d4ff; margin-bottom: 1rem;">Fleet Composition</h4>
                                <div style="max-height: 300px; overflow-y: auto;" id="modal-composition">
                                    ${composition.length === 0 ?
                                        '<p style="color: #b0b0b0; text-align: center; padding: 2rem;">No ships in this fleet yet. Click Edit to add ships.</p>' :
                                        composition.map(ship => `
                                            <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;" class="composition-item" data-ship-id="${ship.fitting_id}">
                                                <div style="display: flex; align-items: center; gap: 1rem;">
                                                    <div style="background: #ff6b35; color: white; padding: 0.3rem 0.7rem; border-radius: 15px; font-size: 0.8rem; font-weight: bold; min-width: 40px; text-align: center;" class="ship-quantity">${ship.quantity}</div>
                                                    <div>
                                                        <div style="font-weight: bold; color: white; margin-bottom: 0.2rem;" class="ship-fitting-name">${ship.fitting_name}</div>
                                                        <div style="color: #b0b0b0; font-size: 0.9rem;" class="ship-name">${ship.ship_name}</div>
                                                    </div>
                                                </div>
                                                <div style="background: rgba(0, 212, 255, 0.2); color: #00d4ff; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.8rem; text-transform: uppercase;" class="ship-role">${ship.role}</div>
                                            </div>
                                        `).join('')
                                    }
                                </div>
                            </div>
                        </div>
                    `;
                    workingModal.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 100% !important; background: rgba(0, 0, 0, 0.8) !important; z-index: 99999 !important; display: block !important;';
                    document.body.appendChild(workingModal);

                    return true;
                } catch (error) {
                    this.showError('Failed to load fleet details: ' + error.message);
                    return false;
                }
            },

            closeFleetView() {
                const modal = document.getElementById('working-fleet-modal');
                if (modal) {
                    modal.remove();
                }
                this.currentViewingFleetId = null;
            }
        };

        global.app = app;
    });

    afterEach(function() {
        // Clean up
        delete global.window;
        delete global.document;
        delete global.fetch;
        delete global.app;
        dom.window.close();
    });

    describe('Fleet Modal Creation', function() {
        it('should create modal when viewFleet is called', async function() {
            const result = await app.viewFleet(1);

            expect(result).to.be.true;
            const modal = document.getElementById('working-fleet-modal');
            expect(modal).to.not.be.null;
            expect(modal.style.display).to.equal('block');
        });

        it('should set correct fleet ID when viewing fleet', async function() {
            await app.viewFleet(42);
            expect(app.currentViewingFleetId).to.equal(42);
        });

        it('should have correct z-index for visibility', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal.style.zIndex).to.equal('99999');
        });

        it('should be positioned fixed and cover full viewport', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal.style.position).to.include('fixed');
            expect(modal.style.width).to.include('100%');
            expect(modal.style.height).to.include('100%');
        });
    });

    describe('Fleet Data Display', function() {
        it('should display fleet name correctly', async function() {
            await app.viewFleet(1);
            const nameElement = document.getElementById('modal-fleet-name');
            expect(nameElement.textContent).to.equal('Test Fleet');
        });

        it('should display fleet description correctly', async function() {
            await app.viewFleet(1);
            const descElement = document.getElementById('modal-fleet-description');
            expect(descElement.textContent).to.equal('Test Description');
        });

        it('should display total ships count', async function() {
            await app.viewFleet(1);
            const shipsElement = document.getElementById('modal-total-ships');
            expect(shipsElement.textContent).to.equal('7');
        });

        it('should display total DPS with proper formatting', async function() {
            await app.viewFleet(1);
            const dpsElement = document.getElementById('modal-total-dps');
            expect(dpsElement.textContent).to.equal('3,500');
        });

        it('should display total EHP with proper formatting', async function() {
            await app.viewFleet(1);
            const ehpElement = document.getElementById('modal-total-ehp');
            expect(ehpElement.textContent).to.equal('125,000');
        });

        it('should display ship types count', async function() {
            await app.viewFleet(1);
            const typesElement = document.getElementById('modal-ship-types');
            expect(typesElement.textContent).to.equal('2');
        });
    });

    describe('Fleet Composition Display', function() {
        it('should display all ships in composition', async function() {
            await app.viewFleet(1);
            const compositionItems = document.querySelectorAll('.composition-item');
            expect(compositionItems.length).to.equal(2);
        });

        it('should display ship quantities correctly', async function() {
            await app.viewFleet(1);
            const quantities = Array.from(document.querySelectorAll('.ship-quantity'))
                .map(el => el.textContent);
            expect(quantities).to.deep.equal(['5', '2']);
        });

        it('should display ship fitting names correctly', async function() {
            await app.viewFleet(1);
            const fittingNames = Array.from(document.querySelectorAll('.ship-fitting-name'))
                .map(el => el.textContent);
            expect(fittingNames).to.deep.equal(['Rifter PvP', 'Hurricane Fleet']);
        });

        it('should display ship names correctly', async function() {
            await app.viewFleet(1);
            const shipNames = Array.from(document.querySelectorAll('.ship-name'))
                .map(el => el.textContent);
            expect(shipNames).to.deep.equal(['Rifter', 'Hurricane']);
        });

        it('should display ship roles correctly', async function() {
            await app.viewFleet(1);
            const roles = Array.from(document.querySelectorAll('.ship-role'))
                .map(el => el.textContent);
            expect(roles).to.deep.equal(['tackle', 'dps']);
        });

        it('should assign correct data attributes to composition items', async function() {
            await app.viewFleet(1);
            const items = document.querySelectorAll('.composition-item');
            expect(items[0].getAttribute('data-ship-id')).to.equal('1');
            expect(items[1].getAttribute('data-ship-id')).to.equal('2');
        });
    });

    describe('Empty Fleet Handling', function() {
        beforeEach(function() {
            // Mock empty fleet response
            global.fetch = async (url) => {
                if (url.includes('/api/fleet/fleets/')) {
                    return {
                        ok: true,
                        json: async () => ({
                            fleet: {
                                id: 1,
                                name: 'Empty Fleet',
                                description: ''
                            },
                            composition: [],
                            stats: {
                                total_ships: 0,
                                ship_types: 0,
                                total_dps: 0,
                                total_ehp: 0
                            }
                        })
                    };
                }
                throw new Error('Unknown URL');
            };
        });

        it('should handle empty fleet gracefully', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal).to.not.be.null;
        });

        it('should show zero stats for empty fleet', async function() {
            await app.viewFleet(1);
            expect(document.getElementById('modal-total-ships').textContent).to.equal('0');
            expect(document.getElementById('modal-total-dps').textContent).to.equal('0');
            expect(document.getElementById('modal-total-ehp').textContent).to.equal('0');
            expect(document.getElementById('modal-ship-types').textContent).to.equal('0');
        });

        it('should display empty state message for composition', async function() {
            await app.viewFleet(1);
            const composition = document.getElementById('modal-composition');
            expect(composition.textContent).to.include('No ships in this fleet yet');
        });

        it('should handle missing description', async function() {
            await app.viewFleet(1);
            const descElement = document.getElementById('modal-fleet-description');
            expect(descElement.textContent).to.equal('No description provided');
        });
    });

    describe('Modal Closing', function() {
        it('should remove modal when closeFleetView is called', async function() {
            await app.viewFleet(1);
            let modal = document.getElementById('working-fleet-modal');
            expect(modal).to.not.be.null;

            app.closeFleetView();
            modal = document.getElementById('working-fleet-modal');
            expect(modal).to.be.null;
        });

        it('should reset currentViewingFleetId when closing', async function() {
            await app.viewFleet(1);
            expect(app.currentViewingFleetId).to.equal(1);

            app.closeFleetView();
            expect(app.currentViewingFleetId).to.be.null;
        });

        it('should handle closing when no modal exists', function() {
            // Should not throw error
            expect(() => app.closeFleetView()).to.not.throw();
        });
    });

    describe('Error Handling', function() {
        beforeEach(function() {
            // Mock error response
            global.fetch = async (url) => {
                return {
                    ok: false,
                    status: 404
                };
            };
        });

        it('should handle API errors gracefully', async function() {
            const result = await app.viewFleet(999);
            expect(result).to.be.false;

            const modal = document.getElementById('working-fleet-modal');
            expect(modal).to.be.null;
        });

        it('should not create modal on API error', async function() {
            await app.viewFleet(999);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal).to.be.null;
        });
    });

    describe('Modal Styling', function() {
        it('should have EVE-themed background colors', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal.style.background).to.include('rgba(0, 0, 0, 0.8)');
        });

        it('should have proper positioning styles', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal.style.position).to.include('fixed');
            expect(modal.style.top).to.include('0');
            expect(modal.style.left).to.include('0');
        });

        it('should be visible by default', async function() {
            await app.viewFleet(1);
            const modal = document.getElementById('working-fleet-modal');
            expect(modal.style.display).to.include('block');
        });
    });
});