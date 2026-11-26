# Upgrading to 0.7

Moost `0.7.0` builds on wooks `0.8`. All `moost` / `@moostjs/*` packages share one version: upgrade them together, and upgrade `@prostojs/wf` to `^0.3.1` if your app lists it (`^0.3.0` up to `0.7.5`), so it shares one copy with `@moostjs/event-wf`. This page is a checklist; each item links to the page that documents the current behaviour. The full list is in the [changelog](https://github.com/moostjs/moostjs/blob/main/CHANGELOG.md); the wooks side is in the [wooks 0.8.0 changelog](https://github.com/wooksjs/wooksjs/blob/main/CHANGELOG.md).

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
- **Run scopes:** every run releases its DI scope when it ends or pauses, whoever starts it. Up to and including `0.7.2`, a `createOutletHandler(wooksWf)` built **before** `new MoostWf(wooksWf)` missed the release; since `0.7.3` (on `@wooksjs/event-wf` `0.8.1`) the order no longer matters. → [`getWfApp()`](/wf/api#getwfapp).
- **Out-of-band tokens** (`0.7.10`, on `@wooksjs/event-wf` `0.8.6`): a pause delivered out of band (email, SMS) always gets a fresh token. Before, such a pause reached by a resume on the same strategy delivered the caller's own token, so the page that sent the email could continue the recipient's run. Now that page's token answers 410 `WF_EXPIRED` with `HandleStateStrategy`. An encapsulated token still replays the state from before the step, never the recipient's. Check the page that waits after the email is sent: a "Resend" button there must start a new run, polling the run from it stops working, and a type-in code belongs on an in-band `outletHttp` pause whose step sends the code itself. → [What the waiting page can no longer do](/wf/outlets#what-the-waiting-page-can-no-longer-do).
- **Token cookie** (`0.7.10`): with `token.write: 'cookie'`, the trigger expires the token cookie when a resume finishes the run or pauses it out of band, if the cookie holds exactly the resumed token. A start (`wfid`) whose only token is a gone or malformed cookie ignores that token and starts; before, it got 410 until the cookie went away. A resume without `wfid` still gets 410, and the cookie is left alone. Send `wfid` only to start, and give cookie triggers that do not share `state` distinct `token.name` values. → [Out-of-Band Outlets](/wf/outlets#out-of-band-outlets).
- **Runs started inside a step** (`0.7.10`): `wf.start(…, { eventContext: current() })` and `wf.mint(…)` inside a step keep their own strategy name, swaps and renewals; before, they could overwrite the enclosing run's strategy name. `swapStrategy()` and `useWfStrategy().current()` now throw outside a workflow run. `current()` also throws in a run that has no strategy name, such as a `wf.start()` without `strategy`; before, a nested run returned the enclosing run's name. The paused output's `inputRequired` is a copy, so the outlet object a step returned is never written to.
- **Nested runs are isolated** (`0.7.10`): `@WorkflowParam(…)`, `useWfState()`, `useWfFinished()`, `useWfOutlet()` and `useWfStrategy()` in a run started inside a step act on that run. Before, they could return the enclosing run's state once the enclosing step had read it. A run also no longer overwrites the HTTP request's route params.
- **Controller context** (`0.7.10`): a workflow run under an HTTP request (`handleOutlet()`, or `wf.start(…, { eventContext: current() })`) no longer replaces the request's controller context. Before, after-interceptors that ran after the run saw the last step's controller and method in `useControllerContext()`.

### Shutdown

- `app.dispose()` awaits in-flight [`runDetached`](/moost/app-dispose#background-work-app-rundetached) runs before the dispose hooks, and ignores hooks registered after `dispose()` was called. → [Application Dispose](/moost/app-dispose).

## New in 0.7

- [`app.runDetached(name, fn)`](/moost/app-dispose#background-work-app-rundetached) — background work with its own event scope; [`app.addDisposeHook(fn)`](/moost/app-dispose#programmatic-hooks-app-adddisposehook).
- [`@Locale()`, `useLocale()`, `setTranslator()` / `useTranslate()`](/moost/i18n) — per-event locale and a translation hook for your own i18n library.
- [Error `code` and `params`](/webapp/response#error-codes-and-params) on `HttpError` bodies, and `transformErrorBody` on `MoostHttp`.
- [`MoostWf.mint()`](/wf/api#mint-options) (headless start that returns a resume token), [`resolveSchemaId()`](/wf/api#resolveschemaid-id-opts), and the trigger hooks `around`, `beforePersist`, `renderEnvelope`, `restoreOnError` → [Outlets configuration](/wf/outlets#configuration).
- `0.7.5`: the workflow trigger's [`resumeOnly`](/wf/outlets#access-control-and-refusals) list, [per-field wording and `pathPrefix: false`](/moost/i18n#wording-per-field) for translated error bodies, `trustProxy: { addresses, hops }` ([client IP](/webapp/request#ip-address)), and a warning when [two apps share one Wooks router](/moost/#several-apps-in-one-process).
- `0.7.6`: [when a paused state expires](/wf/outlets#when-a-paused-state-expires) — `strategy.expiresAtFor()`, `resolveExpiresAt`.
- `0.7.7` (on `@wooksjs/event-wf` `0.8.4`): the workflow trigger's [`startOnly`](/wf/outlets#access-control-and-refusals) list (started here, never resumed) and the [`beforeResume`](/wf/outlets#refusing-a-resume-with-beforeresume) hook (refuse a resume before the token is consumed).
- `0.7.10` (on wooks `0.8.6`): [`renewStateToken()`](/wf/outlets#renewing-the-token) moves a run to a new state token from the next pause on, for a step that raises the privilege of the token holder. Behaviour changes in the same release are listed under [Workflows](#workflows).
- `0.7.9` (on wooks `0.8.5`): the [constructor-params warning](/moost/subclassing#constructor-params-across-extends) is logged also when the inherited constructor throws without its dependencies and `init()` rejects; before, only the constructor's own error showed.
- `0.7.8` (on wooks `0.8.5`):
  - `@moostjs/vite`: the [`headers`](/webapp/vite#response-headers) option (middleware mode) sets headers on every response (pages, SPA shell, static files, routes) in dev and production; an SSR render can return a [CSP `nonce`](/webapp/ssr#content-security-policy-nonce); `createSSRServer().use()` middlewares now run before routes, files and pages in dev too (they ran after Vite's own middlewares and the SSR page), and a failing one (`next(error)`, a throw, a rejection) fails the request instead of the process — see [Custom Server Entry](/webapp/vite#custom-server-entry).
  - The [route-drop warning](/moost/subclassing#the-route-drop-trap) also fires when a subclass without `@Inherit()` re-declares only some of its ancestor's routes, and names the dropped ones. You may see new warnings on upgrade: add `@Inherit()`, re-declare the routes, or mark a deliberate drop with `@Inherit(false)`.
  - `@moostjs/event-http` re-exports `DEFAULT_FORWARD_HEADERS` and `securityHeaders()`, so apps need no direct `@wooksjs/event-http` import for them.
  - `HttpError` bodies keep `statusCode`, `message` and `error` typed after `error instanceof HttpError`.
