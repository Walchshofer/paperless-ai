/**
 * Type declaration for config/config.js.
 *
 * config.js exports a Proxy-wrapped object. TypeScript cannot infer the Proxy's
 * dynamically-added runtime-override methods (updateRuntime, clearRuntimeOverrides,
 * getRuntimeOverrides) from the JS source alone, so they are declared explicitly here.
 *
 * All static config properties are covered by the index signature [key: string]: unknown.
 * Callers that need a specific property type should use a single precision cast:
 *   const apiUrl = config.ollama as { apiUrl: string };
 */
declare const config: {
  updateRuntime(key: string, value: unknown): void;
  clearRuntimeOverrides(): void;
  getRuntimeOverrides(): Record<string, unknown>;
  readonly [key: string]: unknown;
};

export = config;
