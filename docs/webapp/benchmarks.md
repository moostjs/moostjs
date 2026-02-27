<script setup>
// Source: https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results.json
// Source (with DB): https://raw.githubusercontent.com/prostojs/router-benchmark/refs/heads/main/packages/moost-benchmark/results/results-db.json

const summary = {
  'Moost': 66049,
  'NestJS (Fastify)': 60196,
  'NestJS (Express)': 42359,
}

const publicRoutes = {
  'Short static': {
    'Moost': 79520,
    'NestJS (Fastify)': 77984,
    'NestJS (Express)': 54512,
  },
  'Login (set-cookie)': {
    'Moost': 43504,
    'NestJS (Fastify)': 47984,
    'NestJS (Express)': 40496,
  },
  'Wildcard + cache': {
    'Moost': 79008,
    'NestJS (Fastify)': 80032,
    'NestJS (Express)': 54000,
  },
  'Wildcard deep': {
    'Moost': 77984,
    'NestJS (Fastify)': 81504,
    'NestJS (Express)': 50992,
  },
}

const headerAuthRoutes = {
  'Header-auth static': {
    'Moost': 82016,
    'NestJS (Fastify)': 82016,
    'NestJS (Express)': 55504,
  },
  'Header-auth param': {
    'Moost': 79520,
    'NestJS (Fastify)': 80992,
    'NestJS (Express)': 54992,
  },
  'Header-auth long static + cache': {
    'Moost': 79520,
    'NestJS (Fastify)': 79008,
    'NestJS (Express)': 54992,
  },
  'Header-auth POST small body': {
    'Moost': 45488,
    'NestJS (Fastify)': 50512,
    'NestJS (Express)': 39504,
  },
  'Header-auth FAIL (401)': {
    'Moost': 58512,
    'NestJS (Fastify)': 50480,
    'NestJS (Express)': 40016,
  },
}

const cookieAuthRoutes = {
  'Cookie-auth param+suffix': {
    'Moost': 77024,
    'NestJS (Fastify)': 67488,
    'NestJS (Express)': 46000,
  },
  'Cookie-auth two params': {
    'Moost': 76512,
    'NestJS (Fastify)': 66528,
    'NestJS (Express)': 46000,
  },
  'Cookie-auth four params': {
    'Moost': 76000,
    'NestJS (Fastify)': 66976,
    'NestJS (Express)': 44496,
  },
  'Cookie-auth POST small body': {
    'Moost': 42512,
    'NestJS (Fastify)': 42992,
    'NestJS (Express)': 32504,
  },
  'Cookie-auth PUT small body': {
    'Moost': 42000,
    'NestJS (Fastify)': 42512,
    'NestJS (Express)': 32488,
  },
  'Cookie-auth POST large body': {
    'Moost': 9300,
    'NestJS (Fastify)': 9300,
    'NestJS (Express)': 10564,
  },
  'Cookie-auth FAIL (401)': {
    'Moost': 57488,
    'NestJS (Fastify)': 51024,
    'NestJS (Express)': 38512,
  },
}

const errorRoutes = {
  '404 short': {
    'Moost': 77472,
    'NestJS (Fastify)': 56016,
    'NestJS (Express)': 38992,
  },
  '404 deep': {
    'Moost': 78496,
    'NestJS (Fastify)': 56016,
    'NestJS (Express)': 38992,
  },
  'POST large body + bad header-auth': {
    'Moost': 28984,
    'NestJS (Fastify)': 9004,
    'NestJS (Express)': 10244,
  },
  'POST large body + bad cookie-auth': {
    'Moost': 29000,
    'NestJS (Fastify)': 9004,
    'NestJS (Express)': 9924,
  },
}

const summaryWithDb = {
  'Moost': 49415,
  'NestJS (Fastify)': 48194,
  'NestJS (Express)': 37296,
}
</script>

# Benchmarks: Moost vs NestJS

This isn't a hello-world benchmark. We tested the **full HTTP lifecycle** — routing, header parsing, cookie jars with ~20 cookies, authentication, body parsing, and response serialization — all running through each framework's decorator-based DI layer.

Moost and NestJS share the same programming model (decorators, DI, controllers), but Moost is built on [Wooks](https://wooks.moost.org) instead of Express or Fastify. We wanted to know: **how much does the DI framework itself cost?**

::: details Benchmark setup and methodology
**Source code:** [prostojs/router-benchmark](https://github.com/prostojs/router-benchmark)

| Framework | HTTP Layer | Router | DI System |
|---|---|---|---|
| **Moost** | Wooks (@wooksjs/event-http) | @prostojs/router | @prostojs/mate + functional DI |
| **NestJS (Fastify)** | Fastify | find-my-way | @nestjs/core DI container |
| **NestJS (Express)** | Express | Express router | @nestjs/core DI container |

We used **autocannon** (100 connections, 10 pipelining) across **20 test scenarios** modeling a project management SaaS API with 21 routes. Traffic is weighted to reflect real-world patterns: public pages (20%), API calls with header auth (25%), browser routes with cookie auth (35%), and error responses (20%).
:::

## How Much Does DI Cost?

Both frameworks add overhead on top of their underlying HTTP layer. The difference is how much:

- **Moost** adds roughly **6%** on top of raw Wooks
- **NestJS** adds **10–12%** on top of raw Fastify/Express

For the underlying layer benchmarks, see [Wooks HTTP](https://wooks.moost.org/benchmarks/wooks-http) and [Router](https://wooks.moost.org/benchmarks/router).

## Overall Throughput

<ClientOnly>
  <BenchmarkBars :data="summary" title="Weighted average throughput (req/s)" />
</ClientOnly>

Across all 20 scenarios, Moost is about **10% faster** than NestJS on Fastify and **56% faster** than NestJS on Express.

## Public & Static Routes

<ClientOnly>
  <BenchmarkChart :data="publicRoutes" mode="stacked" unit="req/s" title="Public & static routes (req/s)" />
</ClientOnly>

On simple static routes, Moost and NestJS (Fastify) are neck and neck. Fastify has a slight edge on **login with set-cookie** thanks to its highly optimized cookie serialization.

## Header-Auth API Routes

<ClientOnly>
  <BenchmarkChart :data="headerAuthRoutes" mode="stacked" unit="req/s" title="Header-auth API routes (req/s)" />
</ClientOnly>

Standard API routes with Bearer token auth are closely matched. Two interesting differences:
- Moost handles **auth failures faster** — Wooks short-circuits before allocating response resources
- NestJS (Fastify) handles **small POST bodies faster** — Fastify's request pipeline is tightly optimized for this path

## Cookie-Auth Browser Routes

<ClientOnly>
  <BenchmarkChart :data="cookieAuthRoutes" mode="stacked" unit="req/s" title="Cookie-auth browser routes (req/s)" />
</ClientOnly>

This is where Moost pulls ahead clearly — about **14% faster** across cookie-authenticated routes. The reason: Wooks parses cookies **lazily**, only touching the ones your handler actually needs. NestJS parses the entire cookie jar upfront regardless.

## Error Responses & Edge Cases

<ClientOnly>
  <BenchmarkChart :data="errorRoutes" mode="stacked" unit="req/s" title="Error responses & edge cases (req/s)" />
</ClientOnly>

Two results stand out:

- **404 responses** — Moost is about **40% faster** because NestJS routes 404s through its exception filter pipeline
- **Large body with bad auth** — Moost is over **3x faster** because Wooks skips body parsing entirely when authentication fails first. NestJS parses the full body before the guard rejects the request.

## Where Each Framework Shines

**Moost is faster when:**
- Requests carry lots of cookies (lazy parsing pays off)
- Requests fail early (404s, auth rejections)
- Large request bodies arrive with bad credentials

**NestJS (Fastify) is faster when:**
- Responses set cookies (Fastify's serialization is fast)
- Handling small POST/PUT bodies (Fastify's request pipeline is very tight)

## With Real Database Calls

In practice, your handlers do more than parse headers — they talk to databases. When we added simulated Redis calls (~1ms) to every handler, the picture changed:

<ClientOnly>
  <BenchmarkBars :data="summaryWithDb" title="Throughput with simulated Redis calls (req/s)" />
</ClientOnly>

With I/O in the mix, the gap between Moost and NestJS (Fastify) shrinks to just **~2.5%**. The DI framework overhead becomes a rounding error next to actual business logic.

::: info The bottom line
All three options are fast enough for production. Choose your framework for **developer experience and architecture**, not benchmarks. The real question is whether you prefer Moost's composable approach or NestJS's module system.
:::

## Why Moost

- **Familiar patterns** — same decorators and DI as NestJS, without the module boilerplate (`@Module()`, `providers` arrays, `forRoot()`)
- **Less DI overhead** — roughly half the cost of NestJS's DI layer
- **Built on Wooks** — lazy evaluation, typed context, composable functions
- **One architecture for everything** — HTTP, CLI, WebSocket, and Workflows
- **Powerful router** — regex constraints, multiple wildcards, optional params, case-insensitive matching via [@prostojs/router](https://github.com/niciam/router)

See also: [Router benchmark](https://wooks.moost.org/benchmarks/router) | [Wooks HTTP benchmark](https://wooks.moost.org/benchmarks/wooks-http)

---

<small>

**Source:** [prostojs/router-benchmark](https://github.com/prostojs/router-benchmark) | **Date:** February 2026 | **Method:** autocannon, 100 connections, 10 pipelining, 0.5s/test, 20 scenarios

</small>
