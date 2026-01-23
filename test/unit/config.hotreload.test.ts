import { describe, it, expect } from 'vitest';
import config from '../../config/config';

describe('Config hot-reload foundation', () => {
  it('applies flat runtime overrides', () => {
    const original = config.tokenLimit;
    config.updateRuntime('tokenLimit', 999999);
    expect(config.tokenLimit).toBe(999999);
    config.clearRuntimeOverrides();
    expect(config.tokenLimit).toBe(original);
  });

  it('applies nested runtime overrides', () => {
    const original = config.ollama.apiUrl;
    config.updateRuntime('ollama.apiUrl', 'http://localhost:11435');
    expect(config.ollama.apiUrl).toBe('http://localhost:11435');
    config.clearRuntimeOverrides();
    expect(config.ollama.apiUrl).toBe(original);
  });

  it('getRuntimeOverrides returns a copy', () => {
    config.updateRuntime('developer.featureFlags.newFlag', true);
    const overrides = config.getRuntimeOverrides();
    expect(overrides).toBeDefined();
    expect(overrides.developer.featureFlags.newFlag).toBe(true);
    config.clearRuntimeOverrides();
  });
});
