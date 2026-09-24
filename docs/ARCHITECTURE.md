# Architecture & Resilience Design

TraceCraft isolates network and service calls through three layered resilience patterns: Token Bucket rate limiting, a Finite State Machine circuit breaker, and Exponential Backoff retries with full jitter.

## Subsystems

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. RATE LIMITING (Token Bucket)                                             │
│                                                                             │
│  Mathematical Model:                                                        │
│  T(now) = min(capacity, T(last) + (now - lastRefill) * refillRatePerSec)    │
│                                                                             │
│  • Memory complexity: O(1) state (no timestamp arrays or sliding logs)      │
│  • Time complexity: O(1) continuous time evaluation                         │
│  • Rejection code: HTTP 429 Too Many Requests                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Permitted
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. FAULT ISOLATION (Circuit Breaker FSM)                                    │
│                                                                             │
│               [ CLOSED ] ──(Failure Rate >= 50%)──► [ OPEN ]                │
│                   ▲                                    │                    │
│                   │                                    │ (After 5s Cooldown)│
│                   │                                    ▼                    │
│             (All Probes Pass) ◄── [ HALF_OPEN ] ◄──────┘                    │
│                                           │                                 │
│                                     (Probe Fails) ──► [ OPEN ]              │
│                                                                             │
│  • CLOSED: Writes outcomes to rolling sliding window (size: 6)              │
│  • OPEN: Fails fast in 0 ms; prevents thread starvation & cascading failure │
│  • HALF_OPEN: Routes trial probes to verify downstream health before closing│
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Closed or Probing
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. TRANSIENT RECOVERY (Exponential Backoff with Full Jitter)                │
│                                                                             │
│  Delay Calculation:                                                         │
│  rawExponential = min(maxDelay, baseDelay * 2^attempt)                      │
│  jitteredDelay  = floor(random() * (rawExponential + 1))                    │
│                                                                             │
│  • Prevents Thundering Herd: desynchronizes concurrent retrying clients     │
│  • Error Predicate: fails fast on 4xx; retries transient 5xx timeouts       │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Architectural trade-offs

### 1. Token Bucket vs Sliding Window Log
- **Choice:** Token Bucket with continuous-time refill.
- **Rationale:** Sliding window logs require storing every request timestamp in memory ($O(N)$ storage). Under high burst traffic (e.g. 50,000 req/sec), timestamp arrays trigger garbage collection pauses. Token bucket stores only two floating-point numbers (`tokens`, `lastRefillTimestamp`), achieving $O(1)$ time and memory overhead.

### 2. AWS Full Jitter vs Equal Jitter vs Deterministic Exponential Backoff
- **Choice:** Full Jitter ($\text{rand}(0, \text{base} \times 2^{\text{attempt}})$).
- **Rationale:** Deterministic exponential backoff causes retrying clients to synchronize into periodic spikes, crashing a recovering database repeatedly. Equal jitter keeps half the delay deterministic; Full Jitter minimizes both total client queue wait time and upstream server contention.

### 3. Fast-Fail Fallbacks vs Queued Retries
- **Choice:** 0 ms fast-fail when Circuit Breaker is `OPEN`.
- **Rationale:** When an upstream dependency (e.g. payment gateway) is experiencing a severe outage, queueing requests in memory exhausts client thread pools and RAM. Fast-failing immediately frees compute resources and allows graceful degradation (e.g. serving cached data or routing to an offline processing queue).
