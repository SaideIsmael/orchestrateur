import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addOpenedProvider, defaultState, sanitizeState } from '../src/shared/state';
import { readStateFile, writeStateFile } from '../src/shared/stateFile';

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

  it('persists state to disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-'));
    const filePath = path.join(dir, 'state.json');

    const state = {
      openedProviders: ['chatgpt', 'claude'],
      lastActiveProviderId: 'claude'
    };

    writeStateFile(filePath, state);
    const loaded = readStateFile(filePath);

    expect(loaded).toEqual(state);
  });
});