import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { parseProvidersJson, ProvidersConfigResult } from '../shared/providers';

export const getProvidersConfigPath = () =>
  path.join(app.getAppPath(), 'config', 'providers.json');

export const loadProvidersConfig = (): ProvidersConfigResult => {
  const configPath = getProvidersConfigPath();
  try {
    const contents = fs.readFileSync(configPath, 'utf8');
    return parseProvidersJson(contents);
  } catch (error) {
    return {
      ok: false,
      errors: [
        `Impossible de lire ${configPath}: ${(error as Error).message}`
      ]
    };
  }
};