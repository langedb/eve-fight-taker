const { expect } = require('chai');
const sinon = require('sinon');
const { RateLimitHandler } = require('../lib/rate-limit-handler');

describe('RateLimitHandler', function() {
  let handler;
  let clock;

  beforeEach(function() {
    handler = new RateLimitHandler();
    clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    clock.restore();
    sinon.restore();
  });

  describe('constructor', function() {
    it('should use default options when none provided', function() {
      const defaultHandler = new RateLimitHandler();
      expect(defaultHandler.maxRetries).to.equal(3);
      expect(defaultHandler.baseDelay).to.equal(1000);
      expect(defaultHandler.maxDelay).to.equal(30000);
    });

    it('should accept custom options', function() {
      const customHandler = new RateLimitHandler({
        maxRetries: 5,
        baseDelay: 2000,
        maxDelay: 60000
      });
      expect(customHandler.maxRetries).to.equal(5);
      expect(customHandler.baseDelay).to.equal(2000);
      expect(customHandler.maxDelay).to.equal(60000);
    });
  });

  describe('executeRequest', function() {
    it('should execute request successfully on first try', async function() {
      const mockResponse = { data: 'success' };
      const requestFn = sinon.stub().resolves(mockResponse);

      const result = await handler.executeRequest(requestFn);

      expect(result).to.equal(mockResponse);
      expect(requestFn.callCount).to.equal(1);
    });

    it('should throw error immediately for non-429 errors', async function() {
      const error = new Error('Server error');
      error.response = { status: 500 };
      const requestFn = sinon.stub().rejects(error);

      try {
        await handler.executeRequest(requestFn);
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('Server error');
        expect(requestFn.callCount).to.equal(1);
      }
    });

    it('should retry on 429 error and succeed', async function() {
      const mockResponse = { data: 'success' };
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        headers: { 'retry-after': '1' } // 1 second
      };

      const requestFn = sinon.stub();
      requestFn.onFirstCall().rejects(error);
      requestFn.onSecondCall().resolves(mockResponse);

      const promise = handler.executeRequest(requestFn);

      // Advance time to trigger retry
      await clock.tickAsync(1000);

      const result = await promise;

      expect(result).to.equal(mockResponse);
      expect(requestFn.callCount).to.equal(2);
    });

    it('should use exponential backoff when Retry-After header is absent', async function() {
      const mockResponse = { data: 'success' };
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        headers: {}
      };

      const requestFn = sinon.stub();
      requestFn.onCall(0).rejects(error);
      requestFn.onCall(1).rejects(error);
      requestFn.onCall(2).resolves(mockResponse);

      const promise = handler.executeRequest(requestFn);

      // First retry: 1000ms (baseDelay * 2^0)
      await clock.tickAsync(1000);

      // Second retry: 2000ms (baseDelay * 2^1)
      await clock.tickAsync(2000);

      const result = await promise;

      expect(result).to.equal(mockResponse);
      expect(requestFn.callCount).to.equal(3);
    });

    it('should respect maxRetries limit', async function() {
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        headers: { 'retry-after': '1' }
      };

      const requestFn = sinon.stub().rejects(error);

      const promise = handler.executeRequest(requestFn);

      // Advance through all retries
      await clock.tickAsync(1000); // First retry
      await clock.tickAsync(1000); // Second retry
      await clock.tickAsync(1000); // Third retry
      await clock.tickAsync(1000); // Final attempt completes

      try {
        await promise;
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('Rate limited');
        expect(requestFn.callCount).to.equal(4); // Initial + 3 retries
      }
    });

    it('should respect custom maxRetries option in executeRequest', async function() {
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        headers: { 'retry-after': '1' }
      };

      const requestFn = sinon.stub().rejects(error);

      const promise = handler.executeRequest(requestFn, { maxRetries: 1 });

      // Advance through retries
      await clock.tickAsync(1000); // First retry
      await clock.tickAsync(1000); // Final attempt completes

      try {
        await promise;
        expect.fail('Should have thrown error');
      } catch (err) {
        expect(err.message).to.equal('Rate limited');
        expect(requestFn.callCount).to.equal(2); // Initial + 1 retry
      }
    });

    it('should cap exponential backoff at maxDelay', async function() {
      const mockResponse = { data: 'success' };
      const error = new Error('Rate limited');
      error.response = {
        status: 429,
        headers: {}
      };

      const shortMaxDelay = new RateLimitHandler({
        baseDelay: 1000,
        maxDelay: 2000
      });

      const requestFn = sinon.stub();
      requestFn.onCall(0).rejects(error);
      requestFn.onCall(1).rejects(error);
      requestFn.onCall(2).resolves(mockResponse);

      const promise = shortMaxDelay.executeRequest(requestFn);

      // First retry: 1000ms
      await clock.tickAsync(1000);

      // Second retry should be capped at 2000ms instead of 4000ms
      await clock.tickAsync(2000);

      const result = await promise;

      expect(result).to.equal(mockResponse);
      expect(requestFn.callCount).to.equal(3);
    });
  });

  describe('getRetryAfter', function() {
    it('should parse integer Retry-After header as seconds', function() {
      const response = {
        headers: { 'retry-after': '5' }
      };

      const result = handler.getRetryAfter(response);

      expect(result).to.equal(5000); // 5 seconds in milliseconds
    });

    it('should parse HTTP date Retry-After header', function() {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 10000); // 10 seconds in future
      const response = {
        headers: { 'retry-after': futureDate.toUTCString() }
      };

      const result = handler.getRetryAfter(response);

      // Should be close to 10000ms (allow small variance)
      expect(result).to.be.closeTo(10000, 100);
    });

    it('should return null for missing Retry-After header', function() {
      const response = {
        headers: {}
      };

      const result = handler.getRetryAfter(response);

      expect(result).to.be.null;
    });

    it('should return null for invalid Retry-After header', function() {
      const response = {
        headers: { 'retry-after': 'invalid' }
      };

      const result = handler.getRetryAfter(response);

      expect(result).to.be.null;
    });

    it('should return 0 for past HTTP date', function() {
      const pastDate = new Date(Date.now() - 10000); // 10 seconds ago
      const response = {
        headers: { 'retry-after': pastDate.toUTCString() }
      };

      const result = handler.getRetryAfter(response);

      expect(result).to.equal(0);
    });
  });

  describe('sleep', function() {
    it('should resolve after specified milliseconds', async function() {
      const promise = handler.sleep(1000);

      let resolved = false;
      promise.then(() => { resolved = true; });

      await clock.tickAsync(500);
      expect(resolved).to.be.false;

      await clock.tickAsync(500);
      await promise;
      expect(resolved).to.be.true;
    });
  });

  describe('integration with axios-like errors', function() {
    it('should handle axios error structure correctly', async function() {
      const mockResponse = { data: 'success' };
      const axiosError = new Error('Request failed with status code 429');
      axiosError.response = {
        status: 429,
        headers: { 'retry-after': '2' }
      };
      axiosError.config = {
        url: 'https://esi.evetech.net/latest/characters/12345/'
      };

      const requestFn = sinon.stub();
      requestFn.onFirstCall().rejects(axiosError);
      requestFn.onSecondCall().resolves(mockResponse);

      const promise = handler.executeRequest(requestFn);

      await clock.tickAsync(2000);

      const result = await promise;

      expect(result).to.equal(mockResponse);
      expect(requestFn.callCount).to.equal(2);
    });
  });
});
