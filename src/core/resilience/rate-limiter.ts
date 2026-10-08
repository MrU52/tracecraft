// Token bucket. Tokens are topped up lazily from the elapsed time whenever
// the bucket is touched, so there's no timer and no per-request history.

export interface TokenBucketConfig {
  capacity: number;
  refillRatePerSec: number;
}

export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRate: number;
  private tokens: number;
  private lastRefill = Date.now();
  private totalRejected = 0;
  private totalAccepted = 0;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRatePerSec;
    this.tokens = config.capacity;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefill) / 1000;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.refillRate);
      this.lastRefill = now;
    }
  }

  tryAcquire(n = 1): boolean {
    this.refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      this.totalAccepted++;
      return true;
    }
    this.totalRejected++;
    return false;
  }

  getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  getStats() {
    this.refill();
    return {
      availableTokens: Number(this.tokens.toFixed(2)),
      capacity: this.capacity,
      refillRatePerSec: this.refillRate,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
    };
  }

  updateConfig(config: Partial<TokenBucketConfig>): void {
    this.refill();
    if (config.capacity !== undefined) {
      this.capacity = config.capacity;
      this.tokens = Math.min(this.capacity, this.tokens);
    }
    if (config.refillRatePerSec !== undefined) {
      this.refillRate = config.refillRatePerSec;
    }
  }

  reset(): void {
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
    this.totalAccepted = 0;
    this.totalRejected = 0;
  }
}
