import { describe, it, expect } from 'vitest';
import runtime from '../../src/islands/runtime';
const { _eventSchemas } = runtime;

describe('Settings event schemas (runtime)', () => {
  it('has settings:changed schema and validates payload', () => {
    const schema = _eventSchemas['settings:changed'];
    expect(schema).toBeDefined();
    const payload = { type: 'settings:changed', category: 'ai-provider', settings: { provider: 'ollama' }, requiresRestart: false };
    const result = schema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('has settings:restart-required schema and validates payload', () => {
    const schema = _eventSchemas['settings:restart-required'];
    expect(schema).toBeDefined();
    const payload = { type: 'settings:restart-required', reason: 'AI provider change', settings: ['AI Provider'] };
    const result = schema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('has developer:toggled schema and validates payload', () => {
    const schema = _eventSchemas['developer:toggled'];
    expect(schema).toBeDefined();
    const payload = { type: 'developer:toggled', enabled: true };
    const result = schema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});
