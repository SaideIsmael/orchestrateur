import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addOpenedProvider, defaultState, sanitizeState } from '../src/shared/state';
import { readStateFileRaw, writeStateFileRaw } from '../src/shared/stateFile';

describe('state helpers', () => {
  it('adds opened providers without duplicates', () => {
    const initial = { ...defaultState };
    const withFirst = addOpenedProvider(initial, 'chatgpt');
    const withSecond = addOpenedProvider(withFirst, 'chatgpt');

    expect(withFirst.openedProviders).toEqual(['chatgpt']);
    expect(withSecond.openedProviders).toEqual(['chatgpt']);
  });

  it('sanitizes invalid state', () => {
    const sanitized = sanitizeState({ openedProviders: ['ok', 123, 'ok'], lastActiveProviderId: 55 });
    expect(sanitized.openedProviders).toEqual(['ok']);
    expect(sanitized.lastActiveProviderId).toBeNull();
  });

  it('persists raw state to disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-'));
    const filePath = path.join(dir, 'state.json');

    const rawContent = JSON.stringify({
      openedProviders: ['chatgpt', 'claude'],
      lastActiveProviderId: 'claude'
    });

    writeStateFileRaw(filePath, rawContent);
    const loaded = readStateFileRaw(filePath);

    expect(loaded).toBe(rawContent);
  });
});