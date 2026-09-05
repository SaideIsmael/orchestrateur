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

describe('backupStore', () => {
  beforeEach(() => {
    vi.resetModules();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orchestrateur-backup-'));
  });

  it('ne cree aucune sauvegarde si aucun etat n\'existe encore', async () => {
    const { createBackup } = await import('../src/main/backupStore');

    expect(createBackup()).toBeNull();
  });

  it('sauvegarde state.enc et state.key ensemble', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState, addOpenedProvider } = await import('../src/shared/state');
    const { createBackup, listBackups } = await import('../src/main/backupStore');

    saveState(addOpenedProvider({ ...defaultState }, 'chatgpt'));
    const backup = createBackup();

    expect(backup).not.toBeNull();
    expect(fs.existsSync(path.join(backup!.dir, 'state.enc'))).toBe(true);
    expect(fs.existsSync(path.join(backup!.dir, 'state.key'))).toBe(true);
    expect(listBackups()).toHaveLength(1);
  });

  it('restaure une sauvegarde apres perte de l\'etat courant', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState, addOpenedProvider } = await import('../src/shared/state');
    const { createBackup, restoreBackup } = await import('../src/main/backupStore');

    saveState(addOpenedProvider({ ...defaultState }, 'claude'));
    const backup = createBackup();
    expect(backup).not.toBeNull();

    // Simule une perte reelle : suppression des fichiers vivants.
    fs.rmSync(path.join(userDataDir, 'state.enc'));
    fs.rmSync(path.join(userDataDir, 'state.key'));

    const restored = restoreBackup(backup!.id);
    expect(restored).toBe(true);

    // Simule un redemarrage pour eviter toute cle en cache en memoire.
    vi.resetModules();
    const { loadState } = await import('../src/main/stateStore');
    expect(loadState().openedProviders).toEqual(['claude']);
  });

  it('refuse de restaurer une sauvegarde dont la cle ne correspond pas', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState, addOpenedProvider } = await import('../src/shared/state');
    const { createBackup, restoreBackup, getBackupsDir } = await import('../src/main/backupStore');

    saveState(addOpenedProvider({ ...defaultState }, 'gemini'));
    const goodBackup = createBackup();
    expect(goodBackup).not.toBeNull();

    // Une deuxieme sauvegarde, dont on remplace la cle par une cle
    // etrangere : la paire ne doit plus se dechiffrer.
    saveState(addOpenedProvider({ ...defaultState }, 'perplexity'));
    const badBackup = createBackup();
    expect(badBackup).not.toBeNull();
    fs.writeFileSync(
      path.join(getBackupsDir(), badBackup!.id, 'state.key'),
      Buffer.from('encrypted:une-cle-qui-ne-correspond-a-rien')
    );

    const restored = restoreBackup(badBackup!.id);

    expect(restored).toBe(false);
  });

  it('sauvegarde l\'etat courant avant de le remplacer par une restauration', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState, addOpenedProvider } = await import('../src/shared/state');
    const { createBackup, restoreBackup, listBackups } = await import('../src/main/backupStore');

    saveState(addOpenedProvider({ ...defaultState }, 'chatgpt'));
    const oldBackup = createBackup();

    saveState(addOpenedProvider({ ...defaultState }, 'claude'));
    // Etat courant = 'claude', pas encore sauvegarde a cet instant.

    restoreBackup(oldBackup!.id);

    // La restauration doit avoir cree une sauvegarde de l'etat 'claude'
    // avant de le remplacer par 'chatgpt'.
    expect(listBackups().length).toBeGreaterThanOrEqual(2);
  });

  it('compare des jours en heure locale, pas un prefixe de chaine ISO (UTC)', async () => {
    const { getBackupsDir, createDailyBackupIfNeeded } = await import('../src/main/backupStore');
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState } = await import('../src/shared/state');

    saveState({ ...defaultState });

    const offsetMinutes = new Date().getTimezoneOffset();
    if (offsetMinutes === 0) {
      // Ce poste est configure en UTC+0 (le cas de ce projet) : la
      // distinction local/UTC ne peut pas etre demontree ici sans forcer
      // un fuseau horaire different, donc on se contente de verifier le
      // comportement nominal.
      expect(createDailyBackupIfNeeded()).not.toBeNull();
      return;
    }

    // Construit un horodatage dont le jour LOCAL est aujourd'hui, mais
    // dont le prefixe de chaine ISO (UTC) tombe sur un jour different -
    // exactement le cas que la comparaison par slice(0,10) traitait a tort
    // comme "pas aujourd'hui".
    const localNow = new Date();
    const sameLocalDayDifferentUtcDate = new Date(
      localNow.getFullYear(),
      localNow.getMonth(),
      localNow.getDate(),
      offsetMinutes > 0 ? 0 : 23,
      offsetMinutes > 0 ? 1 : 59
    );
    const id = sameLocalDayDifferentUtcDate.toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(getBackupsDir(), id);
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify({ createdAt: sameLocalDayDifferentUtcDate.toISOString() }),
      'utf8'
    );

    const result = createDailyBackupIfNeeded();

    expect(result).toBeNull();
  });

  it('ne cree qu\'une seule sauvegarde par jour', async () => {
    const { saveState } = await import('../src/main/stateStore');
    const { defaultState } = await import('../src/shared/state');
    const { createDailyBackupIfNeeded, listBackups } = await import('../src/main/backupStore');

    saveState({ ...defaultState });

    const first = createDailyBackupIfNeeded();
    const second = createDailyBackupIfNeeded();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(listBackups()).toHaveLength(1);
  });

  it('ne conserve que les N sauvegardes les plus recentes', async () => {
    const { getBackupsDir, listBackups, pruneOldBackups } = await import('../src/main/backupStore');

    const dir = getBackupsDir();
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < 5; i += 1) {
      const id = `2026-01-0${i + 1}T00-00-00-000Z`;
      const backupDir = path.join(dir, id);
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(
        path.join(backupDir, 'manifest.json'),
        JSON.stringify({ createdAt: `2026-01-0${i + 1}T00:00:00.000Z` }),
        'utf8'
      );
    }

    pruneOldBackups(2);

    const remaining = listBackups();
    expect(remaining).toHaveLength(2);
    expect(remaining.map((b) => b.id)).toEqual([
      '2026-01-05T00-00-00-000Z',
      '2026-01-04T00-00-00-000Z'
    ]);
  });
});
