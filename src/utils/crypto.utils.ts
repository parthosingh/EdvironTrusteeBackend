import * as crypto from 'crypto';

export async function encryptEas(data: string, keyBase64: string, ivBase64: string) {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');

  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    key as unknown as crypto.CipherKey,
    iv as unknown as crypto.BinaryLike,
  );

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted.toUpperCase();
}

export async function decryptEas(encryptedData: string, keyBase64: string, ivBase64: string) {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = Buffer.from(ivBase64, 'base64');

  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key as unknown as crypto.CipherKey,
    iv as unknown as crypto.BinaryLike,
  );

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}