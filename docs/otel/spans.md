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
| **Name** | Updated to `{METHOD} {route}` for HTTP (e.g. `GET /users/:id`), or `{EventType} {route}` for other event types |
| **Kind** | `INTERNAL` |
| **Attributes** | See [controller attributes](#controller-attributes) below |
| **Metrics** | Event duration histogram is recorded when this span ends |

For HTTP events, the root span is typically created by the OpenTelemetry HTTP instrumentation (`@opentelemetry/instrumentation-http`). The `SpanInjector` attaches to it rather than creating a duplicate.

For non-HTTP events (CLI, Workflow), the `SpanInjector` creates a span named `"{EventType} Event"` (e.g. `CLI Event`, `WF Event`).

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
| `moost.event_type` | Event type | `HTTP`, `CLI`, `WF` |
| `moost.ignore` | Whether span is filtered | `true` / `false` |

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

The following events do **not** produce spans:

- **`init` events** — Application initialization is not traced
- **`WF_STEP` method** — Workflow steps are skipped to prevent interference with the parent `WF_FLOW` span
- **`__SYSTEM__` method** — Internal system handlers (e.g. 404 fallback controllers) are skipped
- **Handlers with `@OtelIgnoreSpan()`** — The lifecycle phase spans (`Interceptors:before`, `Handler:...`, etc.) are skipped entirely; the callback runs without wrapping

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

Custom span attributes added via `customSpanAttr()` appear on the root event span alongside the controller attributes.
