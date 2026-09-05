import fs from 'node:fs';
import path from 'node:path';

export const readStateFileRaw = (filePath: string): string | null => {
  try {
    return fs.readFileSync(filePath, 'utf8').trim();
  } catch {
    return null;
  }
};

export const writeStateFileRaw = (filePath: string, content: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
};