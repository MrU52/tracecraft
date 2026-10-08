# Benchmarks

`npm run bench` times each operation in a tight loop (200k iterations after a 5k warm-up). These are micro-benchmarks, so treat them as a rough sanity check rather than a performance claim.

Last run: Ryzen 9 3900X, Node 25, Windows 10.

| operation | ops/s |
|---|---|
| `TokenBucketRateLimiter.tryAcquire` | ~7.4M |
| `RetryExecutor.calculateDelay` (full jitter) | ~13M |
| `CircuitBreaker.execute`, closed, success | ~2.8M |
| `CircuitBreaker.execute`, open, fallback | ~118k |

The last row is the surprise. A rejected call is much slower than a successful one, which is backwards from what you'd want. It's the `new Error(...)` that gets built (stack trace included) and handed to the fallback on every rejection: creating that error on its own tops out around 220k/s on this machine, while reusing one is orders of magnitude faster. Building the error lazily or preallocating it would fix it. I haven't changed the code yet.

Two back-to-back runs were within a few percent of each other.
