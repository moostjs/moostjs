# @moostjs/swagger — Gaps & TODO

## Legend

- **Impact**: How many users hit this in practice
- **Effort**: Rough implementation complexity (S / M / L)

---

## High Impact

### 2. `info.description` option exists but is not emitted

**Impact**: Medium-high — users pass `description` in options and expect it in the spec
**Effort**: S

`TSwaggerOptions` has `description?: string` but `mapToSwaggerSpec` never includes it in `swaggerSpec.info`. It's a one-liner fix.

**How to fill**: Add `description: options?.description` to the `info` object in `mapToSwaggerSpec`.

---

### 3. `servers` array

**Impact**: Medium-high — without it, Swagger UI defaults to the current host, which breaks for proxied/multi-env setups
**Effort**: S

No `servers` field in the generated spec. OpenAPI 3.0+ uses `servers` to define base URLs.

**How to fill**: Add `servers?: { url: string; description?: string }[]` to `TSwaggerOptions`. Emit in the spec root if provided.

---

### 4. Top-level `tags` array is always empty

**Impact**: Medium — tags appear on endpoints but Swagger UI can't show tag descriptions or ordering
**Effort**: S

`swaggerSpec.tags` is hardcoded to `[]`. While endpoint-level tags work, the top-level `tags` array (which provides descriptions and display order) is never populated.

**How to fill**: Option A — auto-collect unique tags from all endpoints and emit them. Option B — add `tags?: { name: string; description?: string }[]` to `TSwaggerOptions`. Option C — read `@SwaggerDescription` from controllers and auto-populate tag descriptions.

---

### 5. `deprecated` flag

**Impact**: Medium — common need for evolving APIs
**Effort**: S

No way to mark endpoints or schemas as deprecated. OpenAPI supports `deprecated: true` on operations and schema properties.

**How to fill**: Add `@SwaggerDeprecated()` decorator (or piggyback on a core `@Deprecated()` if one exists). Store in metadata, emit on the endpoint spec.

---

## Medium Impact

### 6. `operationId` customization

**Impact**: Medium — auto-generated IDs are ugly (`GET__prefix_test_query`), matter for SDK codegen
**Effort**: S

`operationId` is auto-generated from method + path with aggressive sanitization. No way to override it. Client SDK generators (openapi-generator, orval) use `operationId` as function names.

**How to fill**: Add `@SwaggerOperationId(id)` decorator. If set, use it instead of the auto-generated one.

---

### 7. `info` extended fields (`contact`, `license`, `termsOfService`)

**Impact**: Medium — required for published/public APIs
**Effort**: S

Only `title` and `version` are emitted in `info`. The OpenAPI spec supports `contact`, `license`, and `termsOfService`.

**How to fill**: Extend `TSwaggerOptions` with optional `contact`, `license`, `termsOfService` fields and emit them.

---

### 8. `@Description` maps to `summary`, no way to set `description` on endpoints

**Impact**: Medium — `summary` is a short label, `description` supports markdown and longer text
**Effort**: S

The core `@Description` decorator maps to `summary` on the endpoint (not `description`). `@SwaggerDescription` only works on schemas. There's no way to set the longer `description` field on an operation.

**How to fill**: Either make `@SwaggerDescription` work on methods (maps to operation `description`) or add a separate `@SwaggerSummary` decorator and let `@Description` map to `description`.

---

### 9. Response headers documentation

**Impact**: Medium — important for pagination, rate-limiting, caching headers
**Effort**: M

No way to document response headers (e.g., `X-Total-Count`, `X-Rate-Limit`). OpenAPI supports `headers` on response objects.

**How to fill**: Add `headers` to `@SwaggerResponse` options. Store in metadata and emit in the response object.

---

### 10. Multiple content types per response status code

**Impact**: Low-medium — needed for APIs that return JSON or XML
**Effort**: S

The current `swaggerResponses` structure is `Record<code, Record<contentType, config>>`, which already supports multiple content types per code. However, the mapping code overwrites content when building responses (line 156-161 creates a fresh `content` object per code). If the same status code has both `application/json` and `text/xml`, only the last one survives.

**How to fill**: Merge content types per status code instead of overwriting.

---

## Lower Impact

### 11. `externalDocs`

**Impact**: Low — nice-to-have for linking to external wikis/docs
**Effort**: S

No support for `externalDocs` at spec or operation level.

**How to fill**: Add to `TSwaggerOptions` and/or a `@SwaggerExternalDocs(url, description)` decorator.

---

### 12. `discriminator` for polymorphic schemas

**Impact**: Low — only needed for advanced inheritance/polymorphism patterns
**Effort**: M

No support for `discriminator` in `oneOf`/`anyOf` schemas. Needed when different response shapes are determined by a type field.

**How to fill**: Add `discriminator` to `TSwaggerSchema`. Users can already include it in `toJsonSchema()` output and it will pass through.

---

### 13. `callbacks` (webhooks)

**Impact**: Low — niche, only for APIs that send webhooks
**Effort**: L

No support for OpenAPI `callbacks` (used to document webhook payloads).

**How to fill**: Significant new decorator + mapping work. Low priority unless there's demand.

---

### 14. `links` (response-driven navigation)

**Impact**: Low — rarely used in practice
**Effort**: M

No support for OpenAPI `links` on responses (for HATEOAS-style APIs).

**How to fill**: Add `links` to response options.

---

### 15. YAML output format

**Impact**: Low — most tooling accepts JSON, but some prefer YAML
**Effort**: S

Only JSON output via `spec.json`. Some teams prefer YAML for readability.

**How to fill**: Add a `spec.yaml` endpoint in `SwaggerController` using a lightweight JSON-to-YAML converter (or just offer the option).

---

### 16. Spec validation

**Impact**: Low — helpful for catching issues during development
**Effort**: M

The generated spec is never validated against the OpenAPI schema. Invalid specs can cause Swagger UI rendering issues.

**How to fill**: Optional validation step using `@readme/openapi-parser` or similar. Could be a dev-only check.

---

## Summary

| Priority | Count | Effort mostly |
|----------|-------|---------------|
| High     | 4     | S             |
| Medium   | 5     | S-M           |
| Lower    | 6     | S-M           |

Recommended order: tackle #2 (info.description), #3 (servers), #4 (tags), #5 (deprecated).
