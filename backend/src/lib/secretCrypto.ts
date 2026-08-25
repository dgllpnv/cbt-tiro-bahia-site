import crypto from 'crypto';

// =====================================================
// secretCrypto — cifra/decifra segredos em repouso (ex.: senha do
// certificado de assinatura digital em ClubDigitalSignature).
//
// Usa SIGNATURE_ENC_SECRET se definido; senao cai para JWT_SECRET (dev).
// Em producao, defina SIGNATURE_ENC_SECRET dedicado — nunca reaproveite o
// JWT_SECRET fora de dev, para nao acoplar a rotacao dos dois segredos.
// A chave crua nunca e usada direto: passa por scrypt para virar uma
// chave de 32 bytes adequada para AES-256-GCM.
// =====================================================

const SOURCE_SECRET = process.env.SIGNATURE_ENC_SECRET || process.env.JWT_SECRET;
if (!SOURCE_SECRET) {
  throw new Error('SIGNATURE_ENC_SECRET ou JWT_SECRET precisa estar definido para cifrar segredos');
}

const KEY = crypto.scryptSync(SOURCE_SECRET, 'cbt-signature-secret-salt-v1', 32);

/** Cifra uma string em texto claro. Retorna "iv.authTag.ciphertext" em base64. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

/** Decifra uma string gerada por encryptSecret. Lanca se o payload foi adulterado. */
export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Payload cifrado invalido');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}
