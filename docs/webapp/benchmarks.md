<script setup>
// Source data (generated 2026-10-19):
//   https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results.json
//   https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results-db.json
// summary / summaryWithDb = summary[framework].mixRps (traffic-mix req/s, weighted harmonic mean);
// per-test groups = perTest[test].frameworks[framework].medianRps

const summary = {
  'Fastify (no DI)': 115810,
  'Wooks (no DI)': 115670,
  'Moost': 102250,
  'NestJS (Fastify)': 73569,
  'Express (no DI)': 62901,
  'NestJS (Express)': 48369,
}

const publicRoutes = {
  'Short static': {
    'Moost': 181306,
    'NestJS (Fastify)': 174559,
    'NestJS (Express)': 98754,
  },
  'Login (set-cookie)': {
    'Moost': 89277,
    'NestJS (Fastify)': 95875,
    'NestJS (Express)': 57000,
  },
  'Wildcard + cache': {
    'Moost': 158274,
    'NestJS (Fastify)': 170603,
    'NestJS (Express)': 88606,
  },
  'Wildcard deep': {
    'Moost': 153156,
    'NestJS (Fastify)': 169681,
    'NestJS (Express)': 86334,
  },
}

const headerAuthRoutes = {
  'Header-auth static': {
    'Moost': 164383,
    'NestJS (Fastify)': 164739,
    'NestJS (Express)': 92800,
  },
  'Header-auth param': {
    'Moost': 151179,
    'NestJS (Fastify)': 155425,
    'NestJS (Express)': 88949,
  },
  'Header-auth long static + cache': {
    'Moost': 151847,
    'NestJS (Fastify)': 160163,
    'NestJS (Express)': 86452,
  },
  'Header-auth POST small body': {
    'Moost': 88985,
    'NestJS (Fastify)': 95050,
    'NestJS (Express)': 55774,
  },
  'Header-auth FAIL (401)': {
    'Moost': 100642,
    'NestJS (Fastify)': 77042,
    'NestJS (Express)': 53661,
  },
}

const cookieAuthRoutes = {
  'Cookie-auth param+suffix': {
    'Moost': 144017,
    'NestJS (Fastify)': 120916,
    'NestJS (Express)': 63371,
  },
  'Cookie-auth two params': {
    'Moost': 142449,
    'NestJS (Fastify)': 120891,
    'NestJS (Express)': 62729,
  },
  'Cookie-auth four params': {
    'Moost': 136882,
    'NestJS (Fastify)': 120077,
    'NestJS (Express)': 59564,
  },
  'Cookie-auth POST small body': {
    'Moost': 81512,
    'NestJS (Fastify)': 77327,
    'NestJS (Express)': 40114,
  },
  'Cookie-auth PUT small body': {
    'Moost': 81501,
    'NestJS (Fastify)': 77593,
    'NestJS (Express)': 40484,
  },
  'Cookie-auth POST large body': {
    'Moost': 13345,
    'NestJS (Fastify)': 12340,
    'NestJS (Express)': 12654,
  },
  'Cookie-auth FAIL (401)': {
    'Moost': 100671,
    'NestJS (Fastify)': 79862,
    'NestJS (Express)': 52673,
  },
}

const errorRoutes = {
  '404 short': {
    'Moost': 163279,
    'NestJS (Fastify)': 85978,
    'NestJS (Express)': 52415,
  },
  '404 deep': {
    'Moost': 157902,
    'NestJS (Fastify)': 85507,
    'NestJS (Express)': 52096,
  },
  'POST large body + bad header-auth': {
    'Moost': 60795,
    'NestJS (Fastify)': 11799,
    'NestJS (Express)': 12357,
  },
  'POST large body + bad cookie-auth': {
    'Moost': 59344,
    'NestJS (Fastify)': 11705,
    'NestJS (Express)': 12118,
  },
}

const summaryWithDb = {
  'Moost': 73910,
  'NestJS (Fastify)': 60518,
  'NestJS (Express)': 42691,
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

Indicative estimate on a laptop: Apple M4 MacBook Air (fanless), Node.js 24.22. Main run (with the no-DI baselines): 3 rounds of 1 s warmup + 2 s measured per test. DB run: 1 round, 1 s measured per test.
:::

## How Much Does DI Cost?

Each DI framework compared with its own HTTP layer, measured in the same run (traffic-mix req/s):

| DI framework | HTTP layer alone | With DI | DI-layer cost |
|---|---:|---:|---:|
| Moost | Wooks: 115,670 | 102,250 | **11.6%** |
| NestJS (Fastify) | Fastify: 115,810 | 73,569 | **36.5%** |
| NestJS (Express) | Express: 62,901 | 48,369 | **23.1%** |

A large part of NestJS's cost comes from the two bot/scanner tests (large POST body with bad credentials, 4% of traffic), because NestJS parses the body before its guards reject the request. Without those two tests the DI-layer cost is 11.5% for Moost, 19.9% for NestJS on Fastify and 12.7% for NestJS on Express.

For the underlying layer benchmarks, see [Wooks HTTP](https://wooks.moost.org/benchmarks/wooks-http) and [Router](https://wooks.moost.org/benchmarks/router).

## Overall Throughput

<ClientOnly>
  <BenchmarkBars :data="summary" title="Traffic-mix throughput (req/s)" />
</ClientOnly>

Across all 20 scenarios, Moost is **1.39x** ahead of NestJS on Fastify and **2.1x** ahead of NestJS on Express. Plain Wooks and plain Fastify (no DI) are both 1.13x ahead of Moost.

## Public & Static Routes

<ClientOnly>
  <BenchmarkChart :data="publicRoutes" mode="stacked" unit="req/s" title="Public & static routes (req/s)" />
</ClientOnly>

Moost is 4% ahead of NestJS (Fastify) on the short static route. NestJS (Fastify) is 8–11% ahead on the wildcard routes and 7% ahead on **login with set-cookie**.

## Header-Auth API Routes

<ClientOnly>
  <BenchmarkChart :data="headerAuthRoutes" mode="stacked" unit="req/s" title="Header-auth API routes (req/s)" />
</ClientOnly>

The GET routes with Bearer token auth are close between Moost and NestJS (Fastify): level on the static route, NestJS (Fastify) 3–5% ahead on the param and long static routes. Two differences:
- Moost handles **auth failures (401)** about 1.3x faster than NestJS (Fastify)
- NestJS (Fastify) handles the **small POST body** 7% faster

## Cookie-Auth Browser Routes

<ClientOnly>
  <BenchmarkChart :data="cookieAuthRoutes" mode="stacked" unit="req/s" title="Cookie-auth browser routes (req/s)" />
</ClientOnly>

On the cookie-authenticated GET routes Moost is **14–19% faster** than NestJS (Fastify), and 5% faster on the small POST/PUT bodies. Wooks parses cookies **lazily**, only when the handler reads one; the NestJS servers use `@fastify/cookie` / `cookie-parser`, which parse the cookie header on every request.

On the **large (~25 KB) JSON body**, Moost is the fastest of the three (13,345 req/s vs 12,340 for NestJS (Fastify) and 12,654 for NestJS (Express)).

## Error Responses & Edge Cases

<ClientOnly>
  <BenchmarkChart :data="errorRoutes" mode="stacked" unit="req/s" title="Error responses & edge cases (req/s)" />
</ClientOnly>

Two results stand out:

- **404 responses** — Moost is about **1.9x faster** than NestJS (Fastify) (158–163k vs about 86k req/s), 7% below plain Wooks.
- **Large body with bad auth** — Moost is about **5x faster** (59–61k vs about 12k req/s), because Moost rejects the request before parsing the body while NestJS parses the full body before the guard runs.

## Where Each Framework Is Faster

**Moost is faster when:**
- Requests carry lots of cookies and the handler reads few of them
- Requests fail early (404s, auth failures)
- Large request bodies arrive with bad credentials
- Requests carry JSON bodies on the cookie-auth routes (small POST/PUT and the large body)

**NestJS (Fastify) is faster when:**
- Responses set cookies (login)
- Serving wildcard routes, the header-auth param and long static routes, and the header-auth small POST

## With Real Database Calls

In practice, your handlers do more than parse headers — they talk to databases. With a simulated Redis call (one network round-trip to a local Redis server) in every authenticated handler:

<ClientOnly>
  <BenchmarkBars :data="summaryWithDb" title="Throughput with simulated Redis calls (req/s)" />
</ClientOnly>

With I/O in the mix, Moost's lead over NestJS (Fastify) narrows from 1.39x to **1.22x**, and that lead comes from the bot/scanner tests. Without them the two are about level (about 75k vs 73k req/s). Per category, with the DB call: cookie-auth reads are level, NestJS (Fastify) is 14–18% faster on the header-auth GET routes, and Moost is about 1.2x faster on auth failures and about 1.9x faster on 404s.

::: info The bottom line
All three options handle tens of thousands of requests per second on a single process. Choose your framework for **developer experience and architecture**, and measure your own workload if speed matters. The real question is whether you prefer Moost's composable approach or NestJS's module system.
:::

## Why Moost

- **Familiar patterns** — same decorators and DI as NestJS, without the module boilerplate (`@Module()`, `providers` arrays, `forRoot()`)
- **Lower DI-layer cost** — 11.6% on top of Wooks in this benchmark, versus 36.5% for NestJS on top of Fastify and 23.1% on top of Express
- **Built on Wooks** — lazy evaluation, typed context, composable functions
- **One architecture for everything** — HTTP, CLI, WebSocket, and Workflows
- **Feature-rich router** — regex constraints, multiple wildcards, optional params, case-insensitive matching via [@prostojs/router](https://github.com/prostojs/router)

See also: [Router benchmark](https://wooks.moost.org/benchmarks/router) | [Wooks HTTP benchmark](https://wooks.moost.org/benchmarks/wooks-http)

---

<small>

**Source:** [prostojs/router-benchmark](https://github.com/prostojs/router-benchmark) | **Date:** October 2026 | **Method:** autocannon, 100 connections, pipelining 10, 1 s warmup + 2 s measured per test, 3 rounds (DB run: 1 s measured, 1 round), 20 scenarios, traffic-mix = weighted harmonic mean | **Machine:** Apple M4 MacBook Air (fanless), Node.js 24.22 — indicative estimate on a laptop

</small>
