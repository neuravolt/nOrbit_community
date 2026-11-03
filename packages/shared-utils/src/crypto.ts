import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set (or is too short). ' +
        'Refusing to fall back to a hardcoded default key.',
    );
  }
  return key;
}

export function getJwtSecret(): string {
  const key = process.env.JWT_SECRET;
  if (!key || key.length < 16) {
    throw new Error(
      'JWT_SECRET environment variable is not set (or is too short). ' +
        'Refusing to fall back to a hardcoded default key.',
    );
  }
  return key;
}

export function getJwtRefreshSecret(): string {
  const key = process.env.JWT_REFRESH_SECRET;
  if (!key || key.length < 16) {
    throw new Error(
      'JWT_REFRESH_SECRET environment variable is not set (or is too short). ' +
        'Refusing to fall back to a hardcoded default key.',
    );
  }
  return key;
}

export function encrypt(text: string, secretKey: string): string {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(secretKey)).digest();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string, secretKey: string): string {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) return '';
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const key = crypto.createHash('sha256').update(String(secretKey)).digest();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    return '';
  }
}
