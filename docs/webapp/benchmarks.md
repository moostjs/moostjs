<script setup>
// Source data (generated 2026-10-19):
//   https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results.json
//   https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results-db.json
// summary / summaryWithDb = summary[framework].mixRps (traffic-mix req/s, weighted harmonic mean);
// per-test groups = perTest[test].frameworks[framework].medianRps

const summary = {
  'Fastify (no DI)': 107403,
  'Wooks (no DI)': 100135,
  'Moost': 95304,
  'NestJS (Fastify)': 72506,
  'Express (no DI)': 63585,
  'NestJS (Express)': 47702,
}

const publicRoutes = {
  'Short static': {
    'Moost': 177155,
    'NestJS (Fastify)': 167036,
    'NestJS (Express)': 94964,
  },
  'Login (set-cookie)': {
    'Moost': 89285,
    'NestJS (Fastify)': 98359,
    'NestJS (Express)': 56708,
  },
  'Wildcard + cache': {
    'Moost': 156587,
    'NestJS (Fastify)': 167714,
    'NestJS (Express)': 88889,
  },
  'Wildcard deep': {
    'Moost': 150514,
    'NestJS (Fastify)': 162602,
    'NestJS (Express)': 85938,
  },
}

const headerAuthRoutes = {
  'Header-auth static': {
    'Moost': 165297,
    'NestJS (Fastify)': 163039,
    'NestJS (Express)': 91777,
  },
  'Header-auth param': {
    'Moost': 151786,
    'NestJS (Fastify)': 154829,
    'NestJS (Express)': 88557,
  },
  'Header-auth long static + cache': {
    'Moost': 153215,
    'NestJS (Fastify)': 158380,
    'NestJS (Express)': 86159,
  },
  'Header-auth POST small body': {
    'Moost': 88688,
    'NestJS (Fastify)': 96765,
    'NestJS (Express)': 55718,
  },
  'Header-auth FAIL (401)': {
    'Moost': 99257,
    'NestJS (Fastify)': 74162,
    'NestJS (Express)': 53581,
  },
}

const cookieAuthRoutes = {
  'Cookie-auth param+suffix': {
    'Moost': 146013,
    'NestJS (Fastify)': 117795,
    'NestJS (Express)': 62299,
  },
  'Cookie-auth two params': {
    'Moost': 136364,
    'NestJS (Fastify)': 112839,
    'NestJS (Express)': 60535,
  },
  'Cookie-auth four params': {
    'Moost': 136883,
    'NestJS (Fastify)': 116877,
    'NestJS (Express)': 59306,
  },
  'Cookie-auth POST small body': {
    'Moost': 82091,
    'NestJS (Fastify)': 78325,
    'NestJS (Express)': 39863,
  },
  'Cookie-auth PUT small body': {
    'Moost': 82620,
    'NestJS (Fastify)': 78317,
    'NestJS (Express)': 40182,
  },
  'Cookie-auth POST large body': {
    'Moost': 9199,
    'NestJS (Fastify)': 12283,
    'NestJS (Express)': 12412,
  },
  'Cookie-auth FAIL (401)': {
    'Moost': 100281,
    'NestJS (Fastify)': 76011,
    'NestJS (Express)': 52768,
  },
}

const errorRoutes = {
  '404 short': {
    'Moost': 160661,
    'NestJS (Fastify)': 84702,
    'NestJS (Express)': 51645,
  },
  '404 deep': {
    'Moost': 156809,
    'NestJS (Fastify)': 84762,
    'NestJS (Express)': 51407,
  },
  'POST large body + bad header-auth': {
    'Moost': 62005,
    'NestJS (Fastify)': 11760,
    'NestJS (Express)': 12210,
  },
  'POST large body + bad cookie-auth': {
    'Moost': 58963,
    'NestJS (Fastify)': 11743,
    'NestJS (Express)': 12007,
  },
}

const summaryWithDb = {
  'Moost': 68346,
  'NestJS (Fastify)': 59632,
  'NestJS (Express)': 42168,
}

</script>

# Benchmarks: Moost vs NestJS

This isn't a hello-world benchmark. It tests the **full HTTP lifecycle** — routing, header parsing, cookie jars with ~20 cookies, authentication, body parsing, and response serialization — through each framework's decorator-based DI layer.

Moost and NestJS share the same programming model (decorators, DI, controllers), but Moost is built on [Wooks](https://wooks.moost.org) instead of Express or Fastify. The question: **how much does the DI framework itself cost?**

::: details Benchmark setup and methodology
**Source code:** [prostojs/router-benchmark](https://github.com/prostojs/router-benchmark)

| Framework | HTTP Layer | Router | DI System |
|---|---|---|---|
| **Moost** | Wooks (@wooksjs/event-http) | @prostojs/router | @prostojs/infact (DI container) + @prostojs/mate (metadata) |
| **NestJS (Fastify)** | Fastify | find-my-way | @nestjs/core DI container |
| **NestJS (Express)** | Express | Express router | @nestjs/core DI container |

Both frameworks use TypeScript decorators evaluated at runtime with `emitDecoratorMetadata`; the servers are compiled ahead of time and run as plain `node`, each in its own process. The same run also measures Wooks, Fastify and Express without a DI layer, so the DI cost is computed from one consistent measurement.

Load is generated with **autocannon** (100 connections, pipelining 10) across **20 test scenarios** modeling a project management SaaS API with 22 routes. A pre-flight check verifies that every server returns the same responses. The headline number is the **traffic-mix throughput** (weighted harmonic mean of the per-test results) with these weights: cookie-auth reads 42%, cookie-auth writes 18%, header-auth API calls 16%, public/static 10%, auth failures 5%, 404s 5%, bot/scanner traffic 4%.

Moost rejects unauthorized requests before parsing the body. NestJS parses the body before its guards run, which is its default behaviour and is not worked around.

Indicative estimate, single round on a laptop: Apple M4 MacBook Air (fanless), Node.js 24.22, 1 s warmup + 2 s measured per test (1 s in DB mode).
:::

## How Much Does DI Cost?

Each DI framework compared with its own HTTP layer, measured in the same run (traffic-mix req/s):

| DI framework | HTTP layer alone | With DI | DI-layer cost |
|---|---:|---:|---:|
| Moost | Wooks: 100,135 | 95,304 | **4.8%** |
| NestJS (Fastify) | Fastify: 107,403 | 72,506 | **32.5%** |
| NestJS (Express) | Express: 63,585 | 47,702 | **25.0%** |

A large part of NestJS's cost comes from the two bot/scanner tests (large POST body with bad credentials, 4% of traffic), because NestJS parses the body before its guards reject the request. Without those two tests the DI-layer cost is 4.9% for Moost and about 15% for NestJS on either platform.

For the underlying layer benchmarks, see [Wooks HTTP](https://wooks.moost.org/benchmarks/wooks-http) and [Router](https://wooks.moost.org/benchmarks/router).

## Overall Throughput

<ClientOnly>
  <BenchmarkBars :data="summary" title="Traffic-mix throughput (req/s)" />
</ClientOnly>

Across all 20 scenarios, Moost is **1.31x** ahead of NestJS on Fastify and **2.0x** ahead of NestJS on Express. Plain Fastify and plain Wooks (no DI) are 1.13x and 1.05x ahead of Moost.

## Public & Static Routes

<ClientOnly>
  <BenchmarkChart :data="publicRoutes" mode="stacked" unit="req/s" title="Public & static routes (req/s)" />
</ClientOnly>

Moost is 6% ahead of NestJS (Fastify) on the short static route. NestJS (Fastify) is 7–8% ahead on the wildcard routes and 10% ahead on **login with set-cookie**.

## Header-Auth API Routes

<ClientOnly>
  <BenchmarkChart :data="headerAuthRoutes" mode="stacked" unit="req/s" title="Header-auth API routes (req/s)" />
</ClientOnly>

The GET routes with Bearer token auth are level between Moost and NestJS (Fastify). Two differences:
- Moost handles **auth failures (401)** about 1.3x faster than NestJS (Fastify)
- NestJS (Fastify) handles the **small POST body** 9% faster

## Cookie-Auth Browser Routes

<ClientOnly>
  <BenchmarkChart :data="cookieAuthRoutes" mode="stacked" unit="req/s" title="Cookie-auth browser routes (req/s)" />
</ClientOnly>

On the cookie-authenticated GET routes Moost is **17–24% faster** than NestJS (Fastify), and about 5% faster on the small POST/PUT bodies. Wooks parses cookies **lazily**, only when the handler reads one; the NestJS servers use `@fastify/cookie` / `cookie-parser`, which parse the cookie header on every request.

On the **large (~25 KB) JSON body**, Moost is the slowest of the three (9,199 req/s vs about 12,300 for both NestJS platforms).

## Error Responses & Edge Cases

<ClientOnly>
  <BenchmarkChart :data="errorRoutes" mode="stacked" unit="req/s" title="Error responses & edge cases (req/s)" />
</ClientOnly>

Two results stand out:

- **404 responses** — Moost is about **1.9x faster** than NestJS (Fastify) (157–161k vs about 85k req/s). Moost's 404s are as fast as plain Wooks'.
- **Large body with bad auth** — Moost is about **5x faster** (59–62k vs about 12k req/s), because Moost rejects the request before parsing the body while NestJS parses the full body before the guard runs.

## Where Each Framework Is Faster

**Moost is faster when:**
- Requests carry lots of cookies and the handler reads few of them
- Requests fail early (404s, auth failures)
- Large request bodies arrive with bad credentials

**NestJS (Fastify) is faster when:**
- Requests carry a large JSON body that has to be parsed
- Responses set cookies (login)
- Serving wildcard routes and the header-auth small POST

## With Real Database Calls

In practice, your handlers do more than parse headers — they talk to databases. With a simulated Redis call (one network round-trip to a local Redis server) in every authenticated handler:

<ClientOnly>
  <BenchmarkBars :data="summaryWithDb" title="Throughput with simulated Redis calls (req/s)" />
</ClientOnly>

With I/O in the mix, Moost's lead over NestJS (Fastify) narrows from 1.31x to **1.15x**, and that lead comes from the bot/scanner tests. Without them NestJS (Fastify) is slightly ahead (about 72k vs 69k req/s). Per category, with the DB call: cookie-auth reads are level, NestJS (Fastify) is 24–31% faster on the header-auth routes, and Moost is about 1.9x faster on 404s.

::: info The bottom line
All three options handle tens of thousands of requests per second on a single process. Choose your framework for **developer experience and architecture**, and measure your own workload if speed matters. The real question is whether you prefer Moost's composable approach or NestJS's module system.
:::

## Why Moost

- **Familiar patterns** — same decorators and DI as NestJS, without the module boilerplate (`@Module()`, `providers` arrays, `forRoot()`)
- **Small DI-layer cost** — 4.8% on top of Wooks in this benchmark, versus about 15–33% for NestJS on top of Fastify or Express
- **Built on Wooks** — lazy evaluation, typed context, composable functions
- **One architecture for everything** — HTTP, CLI, WebSocket, and Workflows
- **Feature-rich router** — regex constraints, multiple wildcards, optional params, case-insensitive matching via [@prostojs/router](https://github.com/prostojs/router)

See also: [Router benchmark](https://wooks.moost.org/benchmarks/router) | [Wooks HTTP benchmark](https://wooks.moost.org/benchmarks/wooks-http)

---

<small>

**Source:** [prostojs/router-benchmark](https://github.com/prostojs/router-benchmark) | **Date:** October 2026 | **Method:** autocannon, 100 connections, pipelining 10, 1 s warmup + 2 s measured per test (1 s with DB), 1 round, 20 scenarios, traffic-mix = weighted harmonic mean | **Machine:** Apple M4 MacBook Air (fanless), Node.js 24.22 — indicative estimate, single round on a laptop

</small>
