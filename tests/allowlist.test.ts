import { describe, expect, it } from 'vitest';
import { allowNavigation } from '../src/shared/allowlist';

describe('allowlist', () => {
  it('allows exact domains and subdomains', () => {
    const allowlist = ['example.com'];
    expect(allowNavigation('https://example.com/', allowlist)).toBe(true);
    expect(allowNavigation('https://sub.example.com/path', allowlist)).toBe(true);
  });

  it('blocks unrelated domains', () => {
    const allowlist = ['example.com'];
    expect(allowNavigation('https://example.net/', allowlist)).toBe(false);
  });

  it('supports regex patterns', () => {
    const allowlist = ['regex:^https://.+\\.trusted\\.ai/'];
    expect(allowNavigation('https://app.trusted.ai/', allowlist)).toBe(true);
    expect(allowNavigation('https://trusted.ai/', allowlist)).toBe(false);
  });

  it('allows non-http protocols', () => {
    const allowlist = ['example.com'];
    expect(allowNavigation('about:blank', allowlist)).toBe(true);
  });
});