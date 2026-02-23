import { describe, it, expect } from 'vitest';
import config from '../../config/config';

interface TestableConfig {
  tokenLimit: number;
  ollama: { apiUrl: string };
  updateRuntime(key: string, value: unknown): void;
  clearRuntimeOverrides(): void;
  getRuntimeOverrides(): Record<string, unknown>;
}

const cfg = config as unknown as TestableConfig;

describe('Config hot-reload foundation', () => {
  it('applies flat runtime overrides', () => {
    const original = cfg.tokenLimit;
    cfg.updateRuntime('tokenLimit', 999999);
    expect(cfg.tokenLimit).toBe(999999);
    cfg.clearRuntimeOverrides();
    expect(cfg.tokenLimit).toBe(original);
  });

  it('applies nested runtime overrides', () => {
    const original = cfg.ollama.apiUrl;
    cfg.updateRuntime('ollama.apiUrl', 'http://localhost:11435');
    expect(cfg.ollama.apiUrl).toBe('http://localhost:11435');
    cfg.clearRuntimeOverrides();
    expect(cfg.ollama.apiUrl).toBe(original);
  });

  it('getRuntimeOverrides returns a copy', () => {
    cfg.updateRuntime('developer.featureFlags.newFlag', true);
    const overrides = cfg.getRuntimeOverrides();
    expect(overrides).toBeDefined();
    const devOverrides = overrides['developer'] as Record<string, Record<string, unknown>>;
    expect(devOverrides['featureFlags']['newFlag']).toBe(true);
    cfg.clearRuntimeOverrides();
  });
});
