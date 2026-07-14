import forge from 'node-forge';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const publicKey = forge.pki.publicKeyFromPem(env.VITE_RSA_PUBLIC_KEY.replace(/\\n/g, '\n'));
const privateKey = forge.pki.privateKeyFromPem(env.VITE_RSA_PRIVATE_KEY.replace(/\\n/g, '\n'));

function rsaOaepOptions() {
  return { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha1.create() } };
}

function encryptLikePiEncryption(json) {
  const aesKeyBytes = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(12);
  const cipher = forge.cipher.createCipher('AES-GCM', aesKeyBytes);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(json, 'utf8'));
  cipher.finish();
  return {
    encryptedKey: forge.util.encode64(
      publicKey.encrypt(aesKeyBytes, 'RSA-OAEP', rsaOaepOptions()),
    ),
    iv: forge.util.encode64(iv),
    encryptedData: forge.util.encode64(cipher.output.getBytes() + cipher.mode.tag.getBytes()),
  };
}

function encryptWithBinaryRawEncode(json) {
  const aesKeyBytes = forge.random.getBytesSync(32);
  const ivBytes = forge.random.getBytesSync(12);
  const iv = new Uint8Array([...ivBytes].map((c) => c.charCodeAt(0)));
  // simulate Web Crypto AES - use forge for both for this test
  const cipher = forge.cipher.createCipher('AES-GCM', aesKeyBytes);
  cipher.start({ iv: ivBytes });
  cipher.update(forge.util.createBuffer(json, 'utf8'));
  cipher.finish();
  const rawAes = new Uint8Array([...aesKeyBytes].map((c) => c.charCodeAt(0)));
  return {
    encryptedKey: forge.util.encode64(
      publicKey.encrypt(forge.util.binary.raw.encode(rawAes), 'RSA-OAEP', rsaOaepOptions()),
    ),
    iv: forge.util.encode64(ivBytes),
    encryptedData: forge.util.encode64(cipher.output.getBytes() + cipher.mode.tag.getBytes()),
  };
}

const json = '{"action":"validatetoken","test":true}';
const a = encryptLikePiEncryption(json);
const b = encryptWithBinaryRawEncode(json);

const decA = privateKey.decrypt(forge.util.decode64(a.encryptedKey), 'RSA-OAEP', rsaOaepOptions());
console.log('Roundtrip A:', decA.length === 32 ? 'PASS' : 'FAIL');
const decB = privateKey.decrypt(forge.util.decode64(b.encryptedKey), 'RSA-OAEP', rsaOaepOptions());
console.log('Roundtrip B:', decB.length === 32 ? 'PASS' : 'FAIL');

const hosts = [
  'http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken',
  'http://10.2.0.121:8182/whatsapp/cmrequest/cmdataprocessing/validatetoken',
  'http://10.2.0.121:8182/dmCmsService/whatsapp/cmrequest/cmdataprocessing/validatetoken',
];

for (const url of hosts) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(a),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const ok = !text.includes('"encryptedKey":null');
    console.log(`${res.status} ${ok ? 'OK' : 'NULL'} ${url}`);
    if (!text.startsWith('<')) console.log(' ', text.slice(0, 90));
  } catch (e) {
    console.log(`ERR ${url}: ${e.message}`);
  }
}
