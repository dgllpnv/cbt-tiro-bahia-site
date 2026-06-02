// Criptografia do backup exportado. Mesmo esquema de scripts/csv-crypto.ts
// (AES-256-CBC + PBKDF2, formato [salt 16B][iv 16B][ciphertext]) — assim o
// arquivo .enc gerado aqui pode ser descriptografado com:
//   npx tsx scripts/csv-crypto.ts decrypt <arquivo.enc> <saida>
import * as crypto from 'crypto';

const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100_000;

/** Cifra um conteudo com a passphrase. Retorna [salt][iv][ciphertext]. */
export function encryptBuffer(plaintext: string | Buffer, passphrase: string): Buffer {
  if (!passphrase) throw new Error('Passphrase vazia.');
  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf-8') : plaintext;
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([salt, iv, encrypted]);
}
