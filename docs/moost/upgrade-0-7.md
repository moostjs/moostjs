# Upgrading to 0.7

Moost `0.7.0` builds on wooks `0.8`. All `moost` / `@moostjs/*` packages share one version: upgrade them together, and upgrade `@prostojs/wf` to `^0.3.0` if your app lists it. This page is a checklist; each item links to the page that documents the current behaviour. The full list is in the [changelog](https://github.com/moostjs/moostjs/blob/main/CHANGELOG.md); the wooks side is in the [wooks 0.8.0 changelog](https://github.com/wooksjs/wooksjs/blob/main/CHANGELOG.md).

## Check these in your app

### Interceptors

- After and error hooks now run as **one chain over the current value**, innermost first: each hook sees what the previous one replied, a throw switches the rest of the chain to error hooks, and a non-Error `reply()` recovers it.
- An outer error-only hook (logger, audit trail) no longer sees an error that an inner `CATCH_ERROR` hook recovered — read the third argument `original` (class-based: `useInterceptOriginal()`) in its `after` hook.
- An outer `after` envelope now also wraps error bodies that an error hook replied with.

Details and examples: [The after/error chain](/moost/interceptors#the-after-error-chain).

### HTTP

- **Default status:** PUT, PATCH and DELETE with a body answer `200` (were `201` / `202` / `202`). Add `@SetStatus()` where clients rely on the old codes. → [Setting status codes](/webapp/response#setting-status-codes). `@moostjs/swagger` documents the same defaults → [Swagger responses](/swagger/responses).
- **Durations are seconds:** a numeric cookie `maxAge` or `Cache-Control` `maxAge` is seconds (was milliseconds); bare digit strings like `'3600'` now throw. Remove any `* 1000`. → [Setting cookies](/webapp/response#setting-cookies).
- **Error responses are never cacheable:** they carry `Cache-Control: no-store`, also replacing a `cache-control` set with `@SetHeader(…, { when: 'error' | 'always' })`. → [Setting headers](/webapp/response#setting-headers).
- **Conditional requests:** a GET/HEAD `200` with an `ETag` or `Last-Modified` now answers `304` / `412` automatically, also when the handler set the `ETag`. → [Conditional requests](/webapp/response#conditional-requests).
- **Proxies are untrusted by default:** `@Ip({ trustProxy: true })` is deprecated and now trusts one hop (the right-most `X-Forwarded-For` entry). Configure `trustProxy` on `MoostHttp` and use `@Ip()`. → [IP address](/webapp/request#ip-address).
- **`@Query()`** resolves `{}` instead of `undefined` when there is no query string. → [Query parameters](/webapp/request#query-parameters).
- **Programmatic `fetch()` / `request()`** outside a request has an unknown client address (`@Ip()` is `''`, was `127.0.0.1`). On a fetch runtime pass the peer: `http.fetch(req, { remoteAddress })`. → [Serving a fetch runtime](/webapp/fetch#serving-a-fetch-runtime).

### `@moostjs/vite`

- An unmatched route under `prefix` returns Moost's JSON `404` (after a static-file attempt for GET/HEAD) instead of the SPA shell or SSR page. `prefixFallthrough: true` keeps the old behaviour. → [Middleware Mode](/webapp/vite#middleware-mode).
- `sirv` is a regular dependency now — you can drop it from your own `dependencies` if you added it only for the generated server.

### Workflows

- **Trigger refusals are thrown** `HttpError`s with a `code` (`WF_EXPIRED`, `WF_FORBIDDEN`, …) and reach your error interceptors; the text moved from `body.error` to `body.message`. Clients reading `body.message ?? body.error` work with both. → [Access control and refusals](/wf/outlets#access-control-and-refusals).
- **`allow: []` admits nothing** (it allowed everything), and `allow` / `block` also apply on resume.
- **Run scopes:** create `createOutletHandler(wooksWf)` **after** `new MoostWf(wooksWf)`, or use `MoostWf.handleOutlet()` — a handler built before it misses the scope release. → [`getWfApp()`](/wf/api#getwfapp).

### Shutdown

- `app.dispose()` awaits in-flight [`runDetached`](/moost/app-dispose#background-work-app-rundetached) runs before the dispose hooks, and ignores hooks registered after `dispose()` was called. → [Application Dispose](/moost/app-dispose).

## New in 0.7

- [`app.runDetached(name, fn)`](/moost/app-dispose#background-work-app-rundetached) — background work with its own event scope; [`app.addDisposeHook(fn)`](/moost/app-dispose#programmatic-hooks-app-adddisposehook).
- [`@Locale()`, `useLocale()`, `setTranslator()` / `useTranslate()`](/moost/i18n) — per-event locale and a translation hook for your own i18n library.
- [Error `code` and `params`](/webapp/response#error-codes-and-params) on `HttpError` bodies, and `transformErrorBody` on `MoostHttp`.
- [`MoostWf.mint()`](/wf/api#mint-options) (headless start that returns a resume token), [`resolveSchemaId()`](/wf/api#resolveschemaid-id-opts), and the trigger hooks `around`, `beforePersist`, `renderEnvelope`, `restoreOnError` → [Outlets configuration](/wf/outlets#configuration).
