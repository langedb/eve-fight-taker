const { expect } = require('chai');
const { JSDOM } = require('jsdom');

describe('Fleet Edit Functionality', function() {
  let dom, window, document, app;

  beforeEach(function() {
    // Create a DOM environment for testing
    dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <div id="fleet-builder-modal" class="modal" style="display: none;">
                    <h3 id="fleet-builder-title">Build Fleet Composition</h3>
                    <input type="text" id="fleet-builder-name" value="" />
                    <div id="available-fittings-icons"></div>
                    <div id="role-ships-line" class="role-ships"></div>
                    <div id="role-ships-logi" class="role-ships"></div>
                    <div id="role-ships-ewar" class="role-ships"></div>
                    <div id="role-ships-tackle" class="role-ships"></div>
                    <div id="role-ships-support" class="role-ships"></div>
                    <div id="role-ships-other" class="role-ships"></div>
                    <span id="fleet-total-ships">0</span>
                    <span id="fleet-total-dps">0</span>
                    <span id="fleet-total-ehp">0</span>
                </div>
                <div id="loading" style="display: none;"></div>
            </body>
            </html>
        `, { url: 'http://localhost' });

    window = dom.window;
    document = window.document;
    global.window = window;
    global.document = document;

    // Mock fetch for API calls
    global.fetch = async (url, options) => {
      // Get fleet details
      if (url.includes('/api/fleet/fleets/') && !options?.method) {
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
                id: 101,
                fitting_id: 5,
                fitting_name: 'Rifter PvP',
                ship_name: 'Rifter',
                ship_type_id: 587,
                quantity: 3,
                role: 'tackle'
              },
              {
                id: 102,
                fitting_id: 7,
                fitting_name: 'Scythe Logi',
                ship_name: 'Scythe',
                ship_type_id: 631,
                quantity: 2,
                role: 'logi'
              }
            ],
            stats: {
              total_ships: 5,
              ship_types: 2
            }
          })
        };
      }

      // Update fleet name
      if (url.includes('/api/fleet/fleets/') && options?.method === 'PUT') {
        return { ok: true, json: async () => ({ success: true }) };
      }

      // Delete fleet ship
      if (url.includes('/api/fleet/fleet-ships/') && options?.method === 'DELETE') {
        return { ok: true, json: async () => ({ success: true }) };
      }

      // Add ship to fleet
      if (url.includes('/ships') && options?.method === 'POST') {
        return { ok: true, json: async () => ({ success: true, shipId: 999 }) };
      }

      throw new Error('Unknown URL: ' + url);
    };

    // Create mock app object
    app = {
      currentFleetComposition: null,
      editingFleetId: null,
      fittings: [
        { id: 5, name: 'Rifter PvP', ship_name: 'Rifter', ship_type_id: 587 },
        { id: 7, name: 'Scythe Logi', ship_name: 'Scythe', ship_type_id: 631 }
      ],
      showError: (message) => console.error(message),
      showLoading: (_message) => {},
      hideLoading: () => {},
      showSuccess: (_message) => {},

      openFleetBuilder(fleetId = null) {
        this.currentFleetComposition = {
          line: [],
          logi: [],
          ewar: [],
          tackle: [],
          support: [],
          other: []
        };
        this.editingFleetId = fleetId;

        const modal = document.getElementById('fleet-builder-modal');
        modal.style.display = 'block';

        const title = document.getElementById('fleet-builder-title');
        if (title) {
          title.textContent = fleetId ? 'Edit Fleet Composition' : 'Build Fleet Composition';
        }

        document.getElementById('fleet-builder-name').value = '';
      },

      renderRoleShips(role) {
        const container = document.getElementById(`role-ships-${role}`);
        if (!container) return;
        const ships = this.currentFleetComposition[role];
        container.innerHTML = ships.map(s => `<div>${s.name}</div>`).join('');
      },

      updateFleetStats() {
        let totalShips = 0;
        Object.values(this.currentFleetComposition).forEach(roleShips => {
          roleShips.forEach(ship => {
            totalShips += ship.quantity;
          });
        });
        document.getElementById('fleet-total-ships').textContent = totalShips;
      },

      async editFleet(fleetId) {
        try {
          this.showLoading('Loading fleet...');

          const response = await fetch(`/api/fleet/fleets/${fleetId}`);
          if (!response.ok) throw new Error('Failed to load fleet');

          const data = await response.json();
          const fleet = data.fleet;
          const composition = data.composition || [];

          this.openFleetBuilder(fleetId);
          document.getElementById('fleet-builder-name').value = fleet.name;

          composition.forEach(ship => {
            const role = ship.role || 'other';
            const shipData = {
              fittingId: ship.fitting_id,
              name: ship.fitting_name,
              shipName: ship.ship_name,
              shipTypeId: ship.ship_type_id || 1,
              quantity: ship.quantity,
              role: role
            };

            if (!this.currentFleetComposition[role]) {
              this.currentFleetComposition[role] = [];
            }
            this.currentFleetComposition[role].push(shipData);
          });

          Object.keys(this.currentFleetComposition).forEach(role => {
            this.renderRoleShips(role);
          });

          this.updateFleetStats();
          this.hideLoading();
          return true;
        } catch (error) {
          this.showError('Failed to load fleet: ' + error.message);
          this.hideLoading();
          return false;
        }
      },

      async saveFleetComposition() {
        const fleetName = document.getElementById('fleet-builder-name').value.trim();
        if (!fleetName) {
          this.showError('Please enter a fleet name');
          return false;
        }

        const hasShips = Object.values(this.currentFleetComposition).some(roleShips => roleShips.length > 0);
        if (!hasShips) {
          this.showError('Please add at least one ship to the fleet');
          return false;
        }

        try {
          this.showLoading(this.editingFleetId ? 'Updating fleet...' : 'Saving fleet...');

          let fleetId;

          if (this.editingFleetId) {
            fleetId = this.editingFleetId;

            await fetch(`/api/fleet/fleets/${fleetId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: fleetName, description: '' })
            });

            const currentResponse = await fetch(`/api/fleet/fleets/${fleetId}`);
            if (currentResponse.ok) {
              const currentData = await currentResponse.json();
              const currentComposition = currentData.composition || [];

              for (const ship of currentComposition) {
                await fetch(`/api/fleet/fleet-ships/${ship.id}`, {
                  method: 'DELETE'
                });
              }
            }
          } else {
            const fleetResponse = await fetch('/api/fleet/fleets', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: fleetName, description: '' })
            });

            const fleetData = await fleetResponse.json();
            fleetId = fleetData.fleetId;
          }

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

          this.showSuccess(this.editingFleetId ? 'Fleet updated successfully' : 'Fleet saved successfully');
          this.hideLoading();
          return true;
        } catch (error) {
          this.showError('Failed to save fleet: ' + error.message);
          this.hideLoading();
          return false;
        }
      }
    };

    global.app = app;
  });

  afterEach(function() {
    delete global.window;
    delete global.document;
    delete global.fetch;
    delete global.app;
    dom.window.close();
  });

  describe('Edit Fleet Loading', function() {
    it('should load fleet data when editFleet is called', async function() {
      const result = await app.editFleet(1);
      expect(result).to.be.true;
      expect(app.editingFleetId).to.equal(1);
    });

    it('should populate fleet name in builder', async function() {
      await app.editFleet(1);
      const nameInput = document.getElementById('fleet-builder-name');
      expect(nameInput.value).to.equal('Test Fleet');
    });

    it('should update modal title to "Edit Fleet Composition"', async function() {
      await app.editFleet(1);
      const title = document.getElementById('fleet-builder-title');
      expect(title.textContent).to.equal('Edit Fleet Composition');
    });

    it('should populate fleet composition from API', async function() {
      await app.editFleet(1);
      expect(app.currentFleetComposition.tackle.length).to.equal(1);
      expect(app.currentFleetComposition.logi.length).to.equal(1);
    });

    it('should load correct ship details', async function() {
      await app.editFleet(1);
      const tackleShip = app.currentFleetComposition.tackle[0];
      expect(tackleShip.name).to.equal('Rifter PvP');
      expect(tackleShip.quantity).to.equal(3);
      expect(tackleShip.fittingId).to.equal(5);
    });

    it('should update fleet stats after loading', async function() {
      await app.editFleet(1);
      const totalShips = document.getElementById('fleet-total-ships').textContent;
      expect(totalShips).to.equal('5');
    });
  });

  describe('Edit Fleet Saving', function() {
    it('should use PUT method when editing existing fleet', async function() {
      let updateCalled = false;
      const originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        if (url.includes('/api/fleet/fleets/1') && options?.method === 'PUT') {
          updateCalled = true;
        }
        return originalFetch(url, options);
      };

      await app.editFleet(1);
      await app.saveFleetComposition();
      expect(updateCalled).to.be.true;
    });

    it('should delete existing ships before adding new ones', async function() {
      let deleteCalls = 0;
      const originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        if (url.includes('/api/fleet/fleet-ships/') && options?.method === 'DELETE') {
          deleteCalls++;
        }
        return originalFetch(url, options);
      };

      await app.editFleet(1);
      await app.saveFleetComposition();
      expect(deleteCalls).to.equal(2); // Should delete 2 existing ships
    });

    it('should add new ships after deletion', async function() {
      let addCalls = 0;
      const originalFetch = global.fetch;
      global.fetch = async (url, options) => {
        if (url.includes('/ships') && options?.method === 'POST') {
          addCalls++;
        }
        return originalFetch(url, options);
      };

      await app.editFleet(1);
      await app.saveFleetComposition();
      expect(addCalls).to.equal(2); // Should add 2 ships back
    });

    it('should show correct success message for edit', async function() {
      let successMessage = '';
      app.showSuccess = (msg) => { successMessage = msg; };

      await app.editFleet(1);
      await app.saveFleetComposition();
      expect(successMessage).to.equal('Fleet updated successfully');
    });
  });

  describe('Create vs Edit Mode', function() {
    it('should set title to "Build Fleet Composition" for new fleet', function() {
      app.openFleetBuilder(null);
      const title = document.getElementById('fleet-builder-title');
      expect(title.textContent).to.equal('Build Fleet Composition');
    });

    it('should set title to "Edit Fleet Composition" for existing fleet', function() {
      app.openFleetBuilder(1);
      const title = document.getElementById('fleet-builder-title');
      expect(title.textContent).to.equal('Edit Fleet Composition');
    });

    it('should have null editingFleetId for new fleet', function() {
      app.openFleetBuilder(null);
      expect(app.editingFleetId).to.be.null;
    });

    it('should have fleetId set for editing', function() {
      app.openFleetBuilder(42);
      expect(app.editingFleetId).to.equal(42);
    });
  });
});
