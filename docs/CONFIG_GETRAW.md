# config.getRaw / __getOriginal

Purpose
- Provide safe read-only access to the underlying, unproxied configuration for use cases that require reliable enumeration of keys (e.g., building maps from `modelAliases`).

API
- `config.getRaw(path?: string) -> any`
  - If called without arguments, returns a deep copy of the whole underlying configuration (plain JS object).
  - If called with a `path` (dot-separated), returns the underlying value at that path (for example, `config.getRaw('modelAliases')`). This returns the actual underlying value (not a deep copy) and should be used for enumeration reads.

- `config.__getOriginal(path?: string)` — alias for `getRaw` (same semantics).

Usage examples
- Enumerating model aliases safely:

```js
const aliases = config.getRaw('modelAliases');
for (const [alias, target] of Object.entries(aliases)) {
  // safe enumeration — not affected by proxy traps
}
```

- Getting a deep copy of whole config:

```js
const plainConfigCopy = config.getRaw();
// safe to inspect without affecting runtime overrides
```

Guidance & Caution
- Do not mutate objects returned by `getRaw(path)` for subpaths unless you know what you are doing — for subpath calls the helper returns the actual underlying object (not a deep copy). If you need to modify the configuration for tests or runtime updates, use the `updateRuntime` helper (e.g., `config.updateRuntime('some.path', value)`) instead.
- Prefer `getRaw` for reads and enumerations. The runtime config proxy is intentionally dynamic to support runtime overrides and lazy resolution; `getRaw` exists to provide a stable and plain representation when enumeration is required.

Rationale
- Some consumers enumerate nested config objects (e.g., alias maps). Because the exported runtime config uses proxies, enumeration can be unreliable. `getRaw` gives a safe plain object for enumeration to avoid missing keys due to proxy traps.

Compatibility
- Backwards compatible: existing code that accesses `config.foo` continues to work; prefer `getRaw` only when enumeration or a plain value is required.
