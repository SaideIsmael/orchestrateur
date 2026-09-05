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
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^encrypted:/, '')
  }
}));

describe('checkStateHealth', () => {
  beforeEach(() => {
    // Chaque test doit repartir d'un module crypto.ts vierge : sa cle en
    // cache est un etat de module qui, sans reset, survivrait entre les
    // tests et masquerait le vrai comportement au demarrage d'un processus.
    vi.resetModules();
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

  it('survit a un redemarrage de processus (cle re-chargee depuis disque)', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState, addOpenedProvider } = await import('../src/shared/state');

    const state = addOpenedProvider({ ...defaultState }, 'chatgpt');
    saveState(state);

    // Simule un vrai redemarrage : le cache en memoire de la cle
    // (module-level dans crypto.ts) disparait, seul ce qui est sur disque
    // (state.enc + state.key) doit permettre de relire l'etat.
    vi.resetModules();
    const { loadState, checkStateHealth } = await import('../src/main/stateStore');

    const health = checkStateHealth();
    const reloaded = loadState();

    expect(health.ok).toBe(true);
    expect(reloaded.openedProviders).toEqual(['chatgpt']);
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
