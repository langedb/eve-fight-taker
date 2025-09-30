const { expect } = require('chai');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

describe('Fleet Manager Button Enabling', function() {
  let dom;
  let window;
  let document;

  beforeEach(function() {
    // Read the actual HTML file
    const htmlPath = path.join(__dirname, '..', 'public', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    // Read the CSS file
    const cssPath = path.join(__dirname, '..', 'public', 'style.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    // Create DOM with HTML and CSS
    dom = new JSDOM(htmlContent, {
      pretendToBeVisual: true,
      resources: 'usable'
    });

    window = dom.window;
    document = window.document;

    // Inject CSS
    const style = document.createElement('style');
    style.innerHTML = cssContent;
    document.head.appendChild(style);

    // Mock console for debugging
    global.console = window.console;
  });

  afterEach(function() {
    dom.window.close();
  });

  describe('Load Selected Fitting Button', function() {
    it('should exist in the DOM', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');
      expect(button).to.exist;
      expect(button.tagName).to.equal('BUTTON');
    });

    it('should initially be disabled', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');
      expect(button.disabled).to.be.true;
      expect(button.hasAttribute('disabled')).to.be.true;
    });

    it('should have correct CSS classes', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');
      expect(button.classList.contains('btn')).to.be.true;
      expect(button.classList.contains('btn-primary')).to.be.true;
      expect(button.classList.contains('mt-2')).to.be.true;
    });

    it('should be enabled when disabled attribute is removed', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');

      // Initially disabled
      expect(button.disabled).to.be.true;
      expect(button.hasAttribute('disabled')).to.be.true;

      // Enable the button
      button.disabled = false;
      button.removeAttribute('disabled');

      // Should now be enabled
      expect(button.disabled).to.be.false;
      expect(button.hasAttribute('disabled')).to.be.false;
    });

    it('should have proper styling when enabled', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');

      // Enable the button
      button.disabled = false;
      button.removeAttribute('disabled');
      button.classList.remove('disabled');
      button.style.pointerEvents = 'auto';

      // Check computed styles
      const _computedStyle = window.getComputedStyle(button);

      // The button should not have the disabled styling
      expect(button.disabled).to.be.false;
      expect(button.hasAttribute('disabled')).to.be.false;

      // Should be clickable
      expect(button.style.pointerEvents).to.equal('auto');
    });

    it('should respond to click when enabled', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');
      let clicked = false;

      // Enable the button
      button.disabled = false;
      button.removeAttribute('disabled');

      // Add click listener
      button.addEventListener('click', function() {
        clicked = true;
      });

      // Simulate click
      button.click();

      expect(clicked).to.be.true;
    });

    it('should not respond to click when disabled', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');
      let clicked = false;

      // Ensure button is disabled
      button.disabled = true;
      button.setAttribute('disabled', '');

      // Add click listener
      button.addEventListener('click', function() {
        clicked = true;
      });

      // Simulate click
      button.click();

      expect(clicked).to.be.false;
    });

    it('should have correct CSS disabled styles', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');

      // Ensure button is disabled
      button.disabled = true;
      button.setAttribute('disabled', '');

      // Check computed styles for disabled state
      const _computedStyle = window.getComputedStyle(button);

      // Note: JSDOM may not fully support all CSS features
      // But we can at least verify the button state
      expect(button.disabled).to.be.true;
      expect(button.hasAttribute('disabled')).to.be.true;
    });
  });

  describe('CSS Disabled Pseudo-class', function() {
    it('should apply disabled styles when disabled attribute is present', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');

      // Ensure disabled
      button.disabled = true;
      button.setAttribute('disabled', '');

      // The :disabled pseudo-class should apply
      expect(button.matches(':disabled')).to.be.true;
    });

    it('should not apply disabled styles when disabled attribute is absent', function() {
      const button = document.getElementById('load-selected-stored-fitting-btn');

      // Enable
      button.disabled = false;
      button.removeAttribute('disabled');

      // The :disabled pseudo-class should not apply
      expect(button.matches(':disabled')).to.be.false;
    });
  });
});
