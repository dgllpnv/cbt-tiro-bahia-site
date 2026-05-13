/**
 * Criptografa/descriptografa arquivos usando AES-256-CBC + PBKDF2.
 * Formato do blob: [salt 16B][iv 16B][ciphertext].
 *
 * Uso:
 *   tsx scripts/csv-crypto.ts encrypt <in> <out> [--pass=...]
 *   tsx scripts/csv-crypto.ts decrypt <in> <out> [--pass=...]
 *
 * Passphrase vem (em ordem):
 *   1. flag --pass=...
 *   2. env MIGRATION_PASSPHRASE
 *   3. stdin (modo interativo)
 *
 * Usado pelo start-dev.ps1 para descriptografar backend/data/backup_adm_clube.csv.enc
 * em backend/data/backup_adm_clube.csv antes de rodar a migração.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import * as crypto from 'crypto';
import * as readline from 'readline';

const SALT_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const ITERATIONS = 100_000;

function getPassphrase(): Promise<string> {
  const flag = process.argv.find((a) => a.startsWith('--pass='));
  if (flag) return Promise.resolve(flag.slice('--pass='.length));
  if (process.env.MIGRATION_PASSPHRASE) return Promise.resolve(process.env.MIGRATION_PASSPHRASE);
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Passphrase: ', (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function encrypt(inPath: string, outPath: string): Promise<void> {
  if (!existsSync(inPath)) throw new Error(`Arquivo de entrada nao encontrado: ${inPath}`);
  const passphrase = await getPassphrase();
  if (!passphrase) throw new Error('Passphrase vazia.');

  const data = readFileSync(inPath);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);

  // Formato: [salt 16][iv 16][ciphertext]
  writeFileSync(outPath, Buffer.concat([salt, iv, encrypted]));
  console.log(`✓ Criptografado ${data.length} bytes -> ${outPath} (${encrypted.length + SALT_LENGTH + IV_LENGTH} bytes)`);
}

async function decrypt(inPath: string, outPath: string): Promise<void> {
  if (!existsSync(inPath)) throw new Error(`Arquivo de entrada nao encontrado: ${inPath}`);
  const passphrase = await getPassphrase();
  if (!passphrase) throw new Error('Passphrase vazia.');

  const blob = readFileSync(inPath);
  if (blob.length < SALT_LENGTH + IV_LENGTH + 16) {
    throw new Error('Arquivo criptografado muito curto / formato invalido.');
  }
  const salt = blob.subarray(0, SALT_LENGTH);
  const iv = blob.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = blob.subarray(SALT_LENGTH + IV_LENGTH);
  const key = crypto.pbkdf2Sync(passphrase, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted: Buffer;
  try {
    decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (e) {
    throw new Error('Falha ao descriptografar — passphrase incorreta ou arquivo corrompido.');
  }

  writeFileSync(outPath, decrypted);
  console.log(`✓ Descriptografado -> ${outPath} (${decrypted.length} bytes)`);
}

async function main() {
  const mode = process.argv[2];
  const inPath = process.argv[3];
  const outPath = process.argv[4];

  if (!mode || !inPath || !outPath) {
    console.error('Uso: tsx csv-crypto.ts <encrypt|decrypt> <in> <out> [--pass=...]');
    process.exit(2);
  }

  if (mode === 'encrypt') await encrypt(inPath, outPath);
  else if (mode === 'decrypt') await decrypt(inPath, outPath);
  else {
    console.error(`Modo desconhecido: ${mode}`);
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
