import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { app, safeStorage } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_FILE_NAME = 'state.key';

let cachedKey: Buffer | null = null;

export const getKeyFilePath = () => path.join(app.getPath('userData'), KEY_FILE_NAME);

/**
 * Cle d'enveloppe : un secret aleatoire de 32 octets, genere une seule fois,
 * chiffre par safeStorage puis persiste dans state.key. safeStorage.encryptString
 * n'est PAS deterministe (nonce aleatoire a chaque appel) : l'utiliser
 * directement comme source de la cle, sans la persister, produisait une cle
 * differente a chaque demarrage et rendait state.enc illisible des le
 * redemarrage suivant (bug reel decouvert via les tests E2E de restauration
 * d'etat, jamais teste jusque-la sur un vrai cycle fermeture/reouverture).
 */
function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage non disponible sur cette plateforme');
  }

  const keyFilePath = getKeyFilePath();

  if (fs.existsSync(keyFilePath)) {
    const storedEncryptedKey = fs.readFileSync(keyFilePath);
    const decrypted = safeStorage.decryptString(storedEncryptedKey);
    cachedKey = Buffer.from(decrypted, 'base64');
    return cachedKey;
  }

  const newKey = randomBytes(KEY_LENGTH);
  const encryptedKey = safeStorage.encryptString(newKey.toString('base64'));
  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });
  fs.writeFileSync(keyFilePath, encryptedKey);

  cachedKey = newKey;
  return cachedKey;
}

export function encryptState(state: object): string {
  const iv = randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(state);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, ciphertext, authTag]);
  return combined.toString('base64');
}

export function decryptState(encrypted: string): object | null {
  try {
    const combined = Buffer.from(encrypted, 'base64');

    if (combined.length < IV_LENGTH + TAG_LENGTH) {
      return null;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(combined.length - TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

    const key = getEncryptionKey();

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);

    return JSON.parse(plaintext.toString('utf8'));
  } catch {
    return null;
  }
}