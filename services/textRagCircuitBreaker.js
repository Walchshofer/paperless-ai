class TextRagCircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.resetTimeoutMs = options.resetTimeoutMs || 60 * 1000; // default 60s
    this.state = 'CLOSED';
    this.failureCount = 0;
    this._halfOpen = false;
    this._resetTimer = null;
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    if (this._resetTimer) {
      clearTimeout(this._resetTimer);
      this._resetTimer = null;
    }
  }

  _open() {
    this.state = 'OPEN';
    // Schedule transition to HALF_OPEN after timeout
    if (this._resetTimer) clearTimeout(this._resetTimer);
    this._resetTimer = setTimeout(() => {
      this.state = 'HALF_OPEN';
      this.failureCount = 0;
      this._resetTimer = null;
    }, this.resetTimeoutMs);
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      return Promise.reject(new Error('Circuit is OPEN'));
    }

    try {
      const result = await fn();
      // On success: if HALF_OPEN -> close; else reset failure count
      if (this.state === 'HALF_OPEN') {
        this.reset();
      } else {
        this.failureCount = 0;
      }
      return result;
    } catch (err) {
      this.failureCount += 1;
      if (this.state === 'HALF_OPEN') {
        // failure in half-open -> open again
        this._open();
      } else if (this.failureCount >= this.failureThreshold) {
        this._open();
      }
      throw err;
    }
  }
}

module.exports = TextRagCircuitBreaker;
