const log = require('./logger');

/**
 * ESI Rate Limit Handler
 * Implements automatic retry logic for ESI API rate limiting (429 responses)
 * as described in https://developers.eveonline.com/blog/hold-your-horses-introducing-rate-limiting-to-esi
 */
class RateLimitHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseDelay = options.baseDelay || 1000; // 1 second base delay
    this.maxDelay = options.maxDelay || 30000; // 30 seconds max delay
  }

  /**
   * Execute an axios request with automatic rate limit retry handling
   * @param {Function} requestFn - Function that returns an axios promise
   * @param {Object} options - Options for retry behavior
   * @returns {Promise} - Axios response
   */
  async executeRequest(requestFn, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        lastError = error;

        // Only retry on 429 rate limit errors
        if (error.response?.status !== 429) {
          throw error;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= maxRetries) {
          log.error('Max retries exceeded for rate-limited request', {
            attempts: attempt + 1,
            maxRetries: maxRetries
          });
          throw error;
        }

        // Calculate delay: use Retry-After header if present, otherwise exponential backoff
        const retryAfter = this.getRetryAfter(error.response);
        const exponentialDelay = Math.min(
          this.baseDelay * Math.pow(2, attempt),
          this.maxDelay
        );
        const delayMs = retryAfter || exponentialDelay;

        log.warn('ESI rate limit hit, retrying after delay', {
          attempt: attempt + 1,
          maxRetries: maxRetries,
          delayMs: delayMs,
          retryAfterHeader: retryAfter ? 'present' : 'absent',
          url: error.config?.url
        });

        // Wait before retrying
        await this.sleep(delayMs);
      }
    }

    // This should never be reached, but just in case
    throw lastError;
  }

  /**
   * Extract retry delay from Retry-After header
   * @param {Object} response - Axios response object
   * @returns {number|null} - Delay in milliseconds, or null if not present
   */
  getRetryAfter(response) {
    const retryAfter = response?.headers?.['retry-after'];
    if (!retryAfter) {
      return null;
    }

    // Retry-After can be either seconds (integer) or HTTP date
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000; // Convert to milliseconds
    }

    // Try parsing as HTTP date
    try {
      const retryDate = new Date(retryAfter);
      // Check if date is valid
      if (isNaN(retryDate.getTime())) {
        log.warn('Failed to parse Retry-After header', { retryAfter });
        return null;
      }
      const now = new Date();
      const delayMs = retryDate.getTime() - now.getTime();
      return delayMs > 0 ? delayMs : 0;
    } catch (_e) {
      log.warn('Failed to parse Retry-After header', { retryAfter });
      return null;
    }
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Resolves after delay
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance with default configuration
const defaultHandler = new RateLimitHandler();

module.exports = {
  RateLimitHandler,
  rateLimitHandler: defaultHandler
};
