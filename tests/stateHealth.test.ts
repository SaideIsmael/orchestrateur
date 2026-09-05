import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, beforeEach } from 'vitest';

let userDataDir: string;

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'userData' ? userDataDir : os.tmpdir())
  },
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`)
  }
}));

describe('checkStateHealth', () => {
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-health-'));
  });

  it('reports ok when no state file exists yet', async () => {
    const { checkStateHealth } = await import('../src/main/stateStore');

    const health = checkStateHealth();

    expect(health.ok).toBe(true);
    expect(health.error).toBeUndefined();
  });

  it('reports ok after a normal save/load roundtrip', async () => {
    const { checkStateHealth, saveState } = await import('../src/main/stateStore');
    const { defaultState } = await import('../src/shared/state');

    saveState({ ...defaultState });
    const health = checkStateHealth();

    expect(health.ok).toBe(true);
  });

  it('reports not ok when the state file is corrupted', async () => {
    const { checkStateHealth, getStatePath } = await import('../src/main/stateStore');

    const filePath = getStatePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'invalide', 'utf8');

    const health = checkStateHealth();

    expect(health.ok).toBe(false);
    expect(health.error).toBeTruthy();
  });
});
