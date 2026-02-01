import { describe, expect, it } from 'vitest';
import { parseProvidersJson } from '../src/shared/providers';

describe('providers parsing', () => {
  it('accepts a valid config', () => {
    const json = JSON.stringify([
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        url_home: 'https://chatgpt.com/',
        allowlist: ['chatgpt.com']
      }
    ]);

    const result = parseProvidersJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].id).toBe('chatgpt');
    }
  });

  it('rejects duplicates', () => {
    const json = JSON.stringify([
      {
        id: 'dup',
        name: 'Provider A',
        url_home: 'https://a.test/',
        allowlist: ['a.test']
      },
      {
        id: 'dup',
        name: 'Provider B',
        url_home: 'https://b.test/',
        allowlist: ['b.test']
      }
    ]);

    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toContain('duplique');
    }
  });

  it('rejects invalid allowlist', () => {
    const json = JSON.stringify([
      {
        id: 'bad',
        name: 'Bad',
        url_home: 'https://bad.test/',
        allowlist: []
      }
    ]);

    const result = parseProvidersJson(json);
    expect(result.ok).toBe(false);
  });
});