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