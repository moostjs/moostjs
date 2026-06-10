# Automatic Spans

When `enableOtelForMoost()` is active, every event produces a tree of spans that mirrors Moost's [event lifecycle](/moost/event-lifecycle). No decorators or manual instrumentation are needed — spans are created automatically by the `SpanInjector` context injector.

## Span tree

Here is the full span hierarchy for a typical HTTP request with one interceptor:

```
Event:start                                    ← root event span
  ├─ Interceptors:before                       ← before phase wrapper
  │    └─ Interceptor:AuthGuard                ← per-interceptor span
  │         └─ Arguments:resolve               ← interceptor param resolution
  ├─ Arguments:resolve                         ← handler param resolution
  ├─ Handler:/users/:id                        ← handler execution
  └─ Interceptors:after                        ← after phase wrapper
       └─ Interceptor:AuthGuard                ← per-interceptor span
            └─ Arguments:resolve               ← interceptor param resolution
```

Each span corresponds to a phase in the [event lifecycle](/moost/event-lifecycle). The root `Event:start` span wraps the entire lifecycle and closes only after all inner phases complete.

## Span reference

### Event:start

The root span that wraps the entire event lifecycle. Created when an event enters the system.

| Property | Value |
|----------|-------|
| **Name** | Updated to `{EventType} {route}` after the controller is resolved (see [span naming](#span-naming)) |
| **Kind** | `INTERNAL` |
| **Attributes** | See [controller attributes](#controller-attributes) below |
| **Metrics** | Event duration histogram is recorded when this span ends |

For HTTP events, the root span is designed to come from the OpenTelemetry HTTP instrumentation (`@opentelemetry/instrumentation-http`), with the `SpanInjector` attaching to it rather than creating a duplicate.

For non-HTTP events (CLI, Workflow), the `SpanInjector` creates a span named `"{EventType} Event"` (e.g. `CLI Event`, `WF Event`).

::: info
The `moost.event_type` attribute value for HTTP events is the lowercase `http`.
:::

### Interceptors:before

Wraps the entire "before" phase of all interceptors.

| Property | Value |
|----------|-------|
| **Name** | `Interceptors:before` |
| **Kind** | `INTERNAL` |
| **Contains** | One `Interceptor:{Name}` child span per interceptor |

### Interceptor:{Name}

Created for each individual interceptor's execution. `{Name}` is the interceptor class name (e.g. `Interceptor:AuthGuard`, `Interceptor:LoggingInterceptor`).

| Property | Value |
|----------|-------|
| **Name** | `Interceptor:{ClassName}` |
| **Kind** | `INTERNAL` |
| **Attribute** | `moost.interceptor.stage` — `'before'`, `'after'`, or `'onError'` |
| **Contains** | `Arguments:resolve` child span if the interceptor method has parameters |

The same interceptor may appear in both `Interceptors:before` and `Interceptors:after`, distinguished by the `moost.interceptor.stage` attribute.

### Arguments:resolve

Created when handler or interceptor parameters are resolved through the [pipes pipeline](/moost/pipes/).

| Property | Value |
|----------|-------|
| **Name** | `Arguments:resolve` |
| **Kind** | `INTERNAL` |

This span appears:
- Inside an `Interceptor:{Name}` span when the interceptor's `@Before()`, `@After()`, or `@OnError()` method has decorator-injected parameters (e.g. `@Param()`, `@Body()`, custom resolvers)
- As a direct child of `Event:start` for the handler method's parameter resolution

### Handler:{path}

Wraps the actual handler method execution.

| Property | Value |
|----------|-------|
| **Name** | `Handler:{targetPath}` (e.g. `Handler:/users/:id`) |
| **Kind** | `INTERNAL` |
| **Attributes** | `moost.handler` — method name, `moost.controller` — controller class name |

### Interceptors:after

Wraps the "after" phase (or "onError" phase if the handler threw).

| Property | Value |
|----------|-------|
| **Name** | `Interceptors:after` |
| **Kind** | `INTERNAL` |
| **Contains** | One `Interceptor:{Name}` child span per interceptor with after/error hooks |

## Controller attributes

When a controller and handler are resolved, the `SpanInjector` sets these attributes on the root event span:

| Attribute | Description | Example |
|-----------|-------------|---------|
| `moost.controller` | Controller class name | `UsersController` |
| `moost.handler` | Handler method name | `getUser` |
| `moost.handler_description` | From `@Description()` decorator | `'Fetch user by ID'` |
| `moost.handler_label` | From `@Label()` decorator | `'Get User'` |
| `moost.handler_id` | From `@Id()` decorator | `'users.get'` |
| `moost.route` | Resolved route path | `/users/:id` |
| `moost.event_type` | Event type | `http`, `CLI`, `WF` |
| `moost.ignore` | Set by `@OtelIgnoreSpan()` | `true` (absent when not ignored) |

## Span naming

The root span is renamed after the controller is resolved to include meaningful route information:

- **HTTP events:** `{HTTP_METHOD} {route}` (e.g. `GET /users/:id`)
- **Other events:** `{EventType} {route}` (e.g. `CLI users list`, `WF process-order`)
- **Unresolved routes:** `{EventType} <unresolved>` when no route was matched

## Error handling

When an error occurs at any lifecycle phase:

1. The exception is **recorded** on the active span (`span.recordException(error)`)
2. The span status is set to `ERROR` with the error message
3. If the handler returns an `Error` instance (rather than throwing), it is also recorded as an exception

## Skipped spans

Span creation is skipped in these cases:

- **`init` events** — Application initialization does not get a root event span
- **Handlers with `@OtelIgnoreSpan()`** — The lifecycle phase spans (`Interceptors:before`, `Handler:...`, etc.) are skipped entirely; the callback runs without wrapping. The root event span is still created, tagged `moost.ignore: true`, and dropped by the [Moost span processors](/otel/setup#span-processors) before export

For **`WF_STEP`** (workflow steps) and **`__SYSTEM__`** (internal handlers, e.g. the 404 fallback controller), the `SpanInjector` skips only the controller-registration processing — root span renaming and metric attribution — to prevent interference with the parent `WF_FLOW` span. Lifecycle spans are still emitted for them unless `@OtelIgnoreSpan()` applies.

## Example trace

Here is what a trace looks like in Jaeger for a `GET /hello/world` request with a `LoggingInterceptor`:

```
GET /hello/world                              12.5ms
├─ Interceptors:before                         0.8ms
│    └─ Interceptor:LoggingInterceptor         0.3ms  stage=before
│         └─ Arguments:resolve                 0.1ms
├─ Arguments:resolve                           0.1ms
├─ Handler:/hello/:name                        0.2ms  handler=hello controller=App
└─ Interceptors:after                          0.4ms
     └─ Interceptor:LoggingInterceptor         0.2ms  stage=after
          └─ Arguments:resolve                 0.1ms
```

Custom span attributes added via `customSpanAttr()` are applied to the Moost-created spans that end after the attribute is set — see [Composables](/otel/composables#customspanattrname-value) for details.
