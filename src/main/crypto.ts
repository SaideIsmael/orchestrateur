import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { safeStorage } from 'electron';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  if (cachedKey) {
    return cachedKey;
  }

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('safeStorage non disponible sur cette plateforme');
  }

  const encryptedKey = safeStorage.encryptString('orchestrateur-state-key');
  const keyBuffer = Buffer.from(encryptedKey as unknown as string, 'base64');

  cachedKey = keyBuffer.length >= KEY_LENGTH
    ? keyBuffer.subarray(0, KEY_LENGTH)
    : Buffer.concat([keyBuffer, randomBytes(KEY_LENGTH - keyBuffer.length)]).subarray(0, KEY_LENGTH);

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