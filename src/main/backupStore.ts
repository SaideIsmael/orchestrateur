import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { getStatePath } from './stateStore';
import { getKeyFilePath, canDecryptWithKeyFile, invalidateCachedKey } from './crypto';

const BACKUPS_DIR_NAME = 'backups';
const MANIFEST_FILE_NAME = 'manifest.json';
const DEFAULT_MAX_BACKUPS = 14;

export const getBackupsDir = () => path.join(app.getPath('userData'), BACKUPS_DIR_NAME);

/**
 * Date locale (annee-mois-jour), pas UTC. Date.prototype.toISOString()
 * renvoie toujours l'heure UTC : comparer des prefixes de chaines ISO pour
 * decider "meme jour" desynchronise la cadence quotidienne de l'heure
 * locale reelle de l'utilisateur des qu'il n'est pas a UTC+0.
 */
function localDateStamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type BackupInfo = {
  id: string;
  createdAt: string;
  dir: string;
};

/**
 * Copie state.enc ET state.key dans un dossier horodate sous backups/.
 * Les deux fichiers sont indispensables ensemble : sans la cle, state.enc
 * est illisible (voir crypto.ts). Ne sauvegarde rien si l'un des deux
 * n'existe pas encore (premiere execution, ou safeStorage indisponible).
 */
export function createBackup(): BackupInfo | null {
  const statePath = getStatePath();
  const keyPath = getKeyFilePath();

  if (!fs.existsSync(statePath) || !fs.existsSync(keyPath)) {
    return null;
  }

  const createdAt = new Date().toISOString();
  const id = createdAt.replace(/[:.]/g, '-');
  const backupDir = path.join(getBackupsDir(), id);

  fs.mkdirSync(backupDir, { recursive: true });
  fs.copyFileSync(statePath, path.join(backupDir, path.basename(statePath)));
  fs.copyFileSync(keyPath, path.join(backupDir, path.basename(keyPath)));
  fs.writeFileSync(
    path.join(backupDir, MANIFEST_FILE_NAME),
    JSON.stringify({ createdAt }, null, 2),
    'utf8'
  );

  return { id, createdAt, dir: backupDir };
}

export function listBackups(): BackupInfo[] {
  const dir = getBackupsDir();
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory())
    .map((id) => {
      const backupDir = path.join(dir, id);
      const manifestPath = path.join(backupDir, MANIFEST_FILE_NAME);
      let createdAt = id;
      try {
        createdAt = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).createdAt;
      } catch {
        // Manifest absent ou corrompu : l'id (horodatage) sert de repli.
      }
      return { id, createdAt, dir: backupDir };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Restaure une sauvegarde en ecrasant l'etat et la cle actuels.
 *
 * Limite structurelle a documenter clairement pour l'utilisateur : ceci
 * ne fonctionne que sur la meme machine et le meme profil Windows. La
 * cle elle-meme est chiffree par safeStorage (DPAPI, liee au compte
 * Windows) : une sauvegarde copiee sur un autre poste ou apres une
 * reinstallation du profil sera illisible, quel que soit son contenu.
 *
 * Avant d'ecraser quoi que ce soit : verifie que la paire state.enc/state.key
 * de la sauvegarde se dechiffre reellement (une sauvegarde partiellement
 * ecrite ou modifiee a la main ne sera pas appliquee), puis met de cote
 * l'etat actuellement en place pour que la restauration reste elle-meme
 * reversible. Invalide ensuite la cle en cache : sans cela, le processus
 * en cours continuerait de (de)chiffrer avec l'ancienne cle, qui ne
 * correspond plus au fichier restaure.
 */
export function restoreBackup(id: string): boolean {
  const backupDir = path.join(getBackupsDir(), id);
  const backedUpState = path.join(backupDir, path.basename(getStatePath()));
  const backedUpKey = path.join(backupDir, path.basename(getKeyFilePath()));

  if (!fs.existsSync(backedUpState) || !fs.existsSync(backedUpKey)) {
    return false;
  }

  const backedUpContent = fs.readFileSync(backedUpState, 'utf8').trim();
  if (!canDecryptWithKeyFile(backedUpContent, backedUpKey)) {
    return false;
  }

  createBackup();

  fs.copyFileSync(backedUpState, getStatePath());
  fs.copyFileSync(backedUpKey, getKeyFilePath());
  invalidateCachedKey();

  return true;
}

export function pruneOldBackups(keep: number = DEFAULT_MAX_BACKUPS): void {
  const backups = listBackups();
  for (const backup of backups.slice(keep)) {
    fs.rmSync(backup.dir, { recursive: true, force: true });
  }
}

/**
 * A appeler au demarrage de l'app, puis periodiquement pendant qu'elle
 * tourne (voir main.ts). Cree une sauvegarde uniquement si aucune n'existe
 * deja pour la date du jour en heure locale. Un appel unique au demarrage
 * ne suffit pas a garantir une cadence quotidienne sur un poste laisse
 * ouvert en continu (le cas d'un poste de travail garde allume toute la
 * journee) : sans rappel periodique, aucune sauvegarde n'est jamais prise
 * apres le changement de jour tant que l'app n'est pas redemarree.
 */
export function createDailyBackupIfNeeded(): BackupInfo | null {
  const today = localDateStamp(new Date());
  const alreadyDoneToday = listBackups().some(
    (backup) => localDateStamp(new Date(backup.createdAt)) === today
  );

  if (alreadyDoneToday) {
    return null;
  }

  const backup = createBackup();
  if (backup) {
    pruneOldBackups();
  }
  return backup;
}
