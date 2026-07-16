import forge from 'node-forge';
import { createDecipheriv } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const inputPath = process.argv[2];
const envelope = inputPath
  ? JSON.parse(readFileSync(inputPath, 'utf8'))
  : JSON.parse(process.argv[2] || '{}');

if (!envelope.encryptedKey) {
  console.error('Usage: node scripts/decrypt-once.mjs \'{"encryptedKey":"...","iv":"...","encryptedData":"..."}\'');
  process.exit(1);
}

if (!existsSync('.env')) {
  console.error('No .env file with VITE_RSA_PRIVATE_KEY');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const privatePem = env.VITE_RSA_PRIVATE_KEY.replace(/\\n/g, '\n');
const privateKey = forge.pki.privateKeyFromPem(privatePem);

function rsaOaepOptions() {
  return {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha1.create() },
  };
}

const aesKeyBinary = privateKey.decrypt(
  forge.util.decode64(envelope.encryptedKey),
  'RSA-OAEP',
  rsaOaepOptions(),
);

const iv = Buffer.from(envelope.iv, 'base64');
const data = Buffer.from(envelope.encryptedData, 'base64');
const decipher = createDecipheriv('aes-256-gcm', Buffer.from(aesKeyBinary, 'binary'), iv);
decipher.setAuthTag(data.subarray(-16));
const plain =
  decipher.update(data.subarray(0, -16), undefined, 'utf8') + decipher.final('utf8');

console.log(plain);

try {
  console.log('\nParsed JSON:');
  console.log(JSON.stringify(JSON.parse(plain), null, 2));
} catch {
  // not json
}
