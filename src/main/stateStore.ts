import path from 'node:path';
import { app } from 'electron';
import { OrchestratorState } from '../shared/state';
import { readStateFile, writeStateFile } from '../shared/stateFile';

const STATE_FILE_NAME = 'state.json';

export const getStatePath = () =>
  path.join(app.getPath('userData'), STATE_FILE_NAME);

export const loadState = (): OrchestratorState => readStateFile(getStatePath());

export const saveState = (state: OrchestratorState) => {
  writeStateFile(getStatePath(), state);
};