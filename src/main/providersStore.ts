import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { parseProvidersJson, ProvidersConfigResult } from '../shared/providers';

const getExternalConfigPath = () => {
  const basePath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : app.getAppPath();
  return path.join(basePath, 'config', 'providers.json');
};

export const getProvidersConfigPath = () => {
  const externalPath = getExternalConfigPath();
  if (fs.existsSync(externalPath)) {
    return externalPath;
  }

  return path.join(app.getAppPath(), 'config', 'providers.json');
};

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
