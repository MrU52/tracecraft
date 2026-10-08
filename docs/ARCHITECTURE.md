# Design notes

A call goes through the layers in this order:

```
rate limiter -> circuit breaker -> retry loop -> your function
```

Each layer can answer without going any further down.

## Why this order

The limiter goes first because a rejected call should cost as little as possible. The breaker sits outside the retry loop on purpose: the whole retried call counts as one success or one failure. If the breaker were inside the loop, a single flaky request that retried three times would count as three failures and trip it too eagerly.

The downside is that the breaker reacts more slowly during a real outage, since each recorded failure has already burned through all its retries.

## Token bucket, not a sliding window log

A window log keeps a timestamp per request. A bucket keeps two numbers (`tokens`, `lastRefill`) and works out the refill when it's asked. It also doesn't have the fixed-window problem where 10 calls at the end of one minute and 10 at the start of the next both pass.

The cost is that it's a slightly fuzzier idea of "rate": a full bucket lets a burst of `capacity` through at once.

## Jitter

All four strategies from the AWS post are implemented. The workbench and the pipeline default to full jitter, `random(0, min(max, base * 2^attempt))`. It spreads retries out the most, at the price of sometimes retrying almost immediately (the delay can be close to 0).

## Circuit breaker details

```
CLOSED --failure rate >= threshold--> OPEN --wait elapsed--> HALF_OPEN
   ^                                    ^                        |
   |                                    +------ probe fails -----+
   +----------- enough probes pass -----------------------------+
```

- It needs at least 3 samples in the window (or the window size, if that's smaller) before it'll trip, so one early failure doesn't open it.
- The open to half-open move happens lazily, the next time something asks for the state. There's no timer.
- In half-open, `permittedCallsInHalfOpen` calls are let through. Extra callers get the fallback (or an error) until those probes finish.
- When open, rejected calls build an `Error` for the fallback, which turned out to be the slow part of that path. See [BENCHMARKS.md](BENCHMARKS.md).

## Known gaps

- The half-open probe counter counts calls started, not calls finished, so a probe that hangs holds a slot until it settles.
- No timeout handling. If the wrapped function never resolves, nothing here will notice.
- Nothing is shared across processes.
