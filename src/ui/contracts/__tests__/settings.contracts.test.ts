import { describe, it, expect } from 'vitest';
import { ConnectionSettingsSchema } from '../Settings.Connection.contract';
import { AIProviderSettingsSchema } from '../Settings.AIProvider.contract';
import { ExpertModelsSettingsSchema } from '../Settings.ExpertModels.contract';
import { AdvancedSettingsSchema } from '../Settings.Advanced.contract';
import { DeveloperSettingsSchema } from '../Settings.Developer.contract';

describe('Settings Zod Contracts (smoke tests)', () => {
  it('validates ConnectionSettings sample', () => {
    const sample = { paperlessApiUrl: 'http://localhost:8000', paperlessApiToken: 'secret' };
    const parsed = ConnectionSettingsSchema.parse(sample);
    expect(parsed.paperlessApiUrl).toBe(sample.paperlessApiUrl);
  });

  it('validates AIProviderSettings sample', () => {
    const sample = { provider: 'ollama', ollama: { apiUrl: 'http://localhost:11434', model: 'qwen3-vl:8b' } };
    const parsed = AIProviderSettingsSchema.parse(sample);
    expect(parsed.provider).toBe('ollama');
    expect(parsed.ollama?.apiUrl).toBe(sample.ollama.apiUrl);
  });

  it('validates ExpertModelsSettings sample', () => {
    const sample = { medical: { enabled: true, vision: 'llava-med-v1.6' }, expertPipelineEnabled: true };
    const parsed = ExpertModelsSettingsSchema.parse(sample);
    expect(parsed.medical?.enabled).toBe(true);
  });

  it('validates AdvancedSettings sample', () => {
    const sample = { tags: ['a','b','c'], systemPrompt: null };
    const parsed = AdvancedSettingsSchema.parse(sample);
    expect(Array.isArray(parsed.tags)).toBe(true);
  });

  it('validates DeveloperSettings sample', () => {
    const sample = { developerMode: true, featureFlags: { islands: true } };
    const parsed = DeveloperSettingsSchema.parse(sample);
    expect(parsed.developerMode).toBe(true);
  });
});
