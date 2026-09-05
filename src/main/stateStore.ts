import path from 'node:path';
import { app } from 'electron';
import { OrchestratorState } from '../shared/state';
import { readStateFileRaw, writeStateFileRaw } from '../shared/stateFile';
import { encryptState, decryptState } from './crypto';
import { defaultState, sanitizeState } from '../shared/state';

const STATE_FILE_NAME = 'state.enc';

export const getStatePath = () =>
  path.join(app.getPath('userData'), STATE_FILE_NAME);

export const loadState = (): OrchestratorState => {
  const filePath = getStatePath();
  const raw = readStateFileRaw(filePath);

  if (!raw) {
    return { ...defaultState };
  }

  const decrypted = decryptState(raw);
  if (!decrypted) {
    return { ...defaultState };
  }

  return sanitizeState(decrypted);
};

export const saveState = (state: OrchestratorState) => {
  const encrypted = encryptState(state);
  writeStateFileRaw(getStatePath(), encrypted);
};

export type StateHealth = {
  ok: boolean;
  path: string;
  error?: string;
};

/**
 * Verifie a la demande si l'etat persiste peut reellement etre lu et
 * dechiffre, sans modifier quoi que ce soit. Contrairement a loadState()
 * qui retombe silencieusement sur l'etat par defaut en cas d'echec,
 * cette fonction rend l'echec visible pour le canal de sante IPC.
 */
export const checkStateHealth = (): StateHealth => {
  const filePath = getStatePath();
  const raw = readStateFileRaw(filePath);

  // null = aucun fichier (premiere execution, cas sain). Une chaine vide
  // signifie que le fichier existe mais est vide/tronque (ecriture non
  // atomique interrompue) : ce n'est PAS le meme cas, il doit tomber dans
  // la verification de dechiffrement ci-dessous plutot que d'etre traite
  // comme "pas encore d'etat".
  if (raw === null) {
    return { ok: true, path: filePath };
  }

  const decrypted = decryptState(raw);
  if (!decrypted) {
    return {
      ok: false,
      path: filePath,
      error: 'Dechiffrement du fichier d\'etat impossible (safeStorage indisponible ou fichier corrompu).'
    };
  }

  return { ok: true, path: filePath };
};