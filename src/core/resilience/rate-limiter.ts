/**
 * Rate Limiting algorithms for high-throughput distributed systems:
 * 1. Token Bucket (with burst allowance & continuous time-delta refill)
 * 2. Sliding Window Log / Counter
 */

export interface TokenBucketConfig {
  capacity: number;       // Maximum burst capacity
  refillRatePerSec: number; // Tokens added per second
}

export class TokenBucketRateLimiter {
  private capacity: number;
  private refillRate: number;
  private tokens: number;
  private lastRefillTimestamp: number;
  private totalRejected = 0;
  private totalAccepted = 0;

  constructor(config: TokenBucketConfig) {
    this.capacity = config.capacity;
    this.refillRate = config.refillRatePerSec;
    this.tokens = config.capacity;
    this.lastRefillTimestamp = Date.now();
  }

  /**
   * Refills tokens based on elapsed time since last refill calculation.
   * Continuous time formulation: T = min(capacity, T + deltaSeconds * refillRate)
   */
  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    if (elapsedSeconds > 0) {
      const addedTokens = elapsedSeconds * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + addedTokens);
      this.lastRefillTimestamp = now;
    }
  }

  /**
   * Attempts to consume specified number of tokens.
   * Returns true if request is permitted, false if rate limited.
   */
  public tryAcquire(tokensRequested = 1): boolean {
    this.refill();

    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      this.totalAccepted++;
      return true;
    }

    this.totalRejected++;
    return false;
  }

  public getAvailableTokens(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  public getStats() {
    this.refill();
    return {
      availableTokens: Number(this.tokens.toFixed(2)),
      capacity: this.capacity,
      refillRatePerSec: this.refillRate,
      totalAccepted: this.totalAccepted,
      totalRejected: this.totalRejected,
      utilizationPercent: Number((((this.capacity - this.tokens) / this.capacity) * 100).toFixed(1)),
    };
  }

  public updateConfig(config: Partial<TokenBucketConfig>): void {
    this.refill();
    if (config.capacity !== undefined) {
      this.capacity = config.capacity;
      this.tokens = Math.min(this.capacity, this.tokens);
    }
    if (config.refillRatePerSec !== undefined) {
      this.refillRate = config.refillRatePerSec;
    }
  }

  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTimestamp = Date.now();
    this.totalAccepted = 0;
    this.totalRejected = 0;
  }
}
