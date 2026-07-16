import forge from 'node-forge';
import { createDecipheriv } from 'crypto';
import { readFileSync, existsSync } from 'fs';

const inputPath = process.argv[2] || 'scripts/envelope-temp.json';
const raw = JSON.parse(readFileSync(inputPath, 'utf8'));
const envelopes = Array.isArray(raw) ? raw : [raw];

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

const privateKey = forge.pki.privateKeyFromPem(
  env.VITE_RSA_PRIVATE_KEY.replace(/\\n/g, '\n'),
);

function rsaOaepOptions() {
  return {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha1.create() },
  };
}

function decrypt(envelope) {
  const aesKeyBinary = privateKey.decrypt(
    forge.util.decode64(envelope.encryptedKey),
    'RSA-OAEP',
    rsaOaepOptions(),
  );
  const iv = Buffer.from(envelope.iv, 'base64');
  const data = Buffer.from(envelope.encryptedData, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(aesKeyBinary, 'binary'), iv);
  decipher.setAuthTag(data.subarray(-16));
  return decipher.update(data.subarray(0, -16), undefined, 'utf8') + decipher.final('utf8');
}

envelopes.forEach((envelope, index) => {
  console.log(`\n=== Envelope ${index + 1} ===`);
  try {
    const plain = decrypt(envelope);
    console.log(plain);
    try {
      console.log('\nParsed JSON:');
      console.log(JSON.stringify(JSON.parse(plain), null, 2));
    } catch {
      // not json
    }
  } catch (error) {
    console.error(`Failed: ${error.message}`);
  }
});
