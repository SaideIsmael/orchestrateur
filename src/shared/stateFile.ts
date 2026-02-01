import fs from 'node:fs';
import path from 'node:path';
import { defaultState, OrchestratorState, sanitizeState } from './state';

export const readStateFile = (filePath: string): OrchestratorState => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return sanitizeState(JSON.parse(raw));
  } catch {
    return { ...defaultState };
  }
};

export const writeStateFile = (filePath: string, state: OrchestratorState) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
};