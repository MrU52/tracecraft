# TraceCraft Resilience Performance Benchmarks

All micro-benchmarks are executed on bare metal using `npm run bench` with 50,000 continuous iterations per component.

## Benchmark Results

| Primitive Subsystem | Operations / Second | Algorithmic Complexity |
|---|---|---|
| **Token Bucket Acquire (O(1) continuous time)** | **~10,030,000 ops/sec** | $O(1)$ constant time |
| **Exponential Backoff & Jitter Calculation** | **~19,490,000 ops/sec** | $O(1)$ constant time |
| **Circuit Breaker Fast-Fail Execution (0ms overhead)** | **~135,000 ops/sec** | $O(1)$ constant time |

---

## Reproducing Benchmarks

Run the benchmark suite directly:

```bash
npm run bench
```
