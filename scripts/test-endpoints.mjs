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

function rsaOaepOptions() {
  return { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha1.create() } };
}

function encryptPayload(obj) {
  const plain = JSON.stringify(obj);
  const aesKey = forge.random.getBytesSync(32);
  const iv = forge.random.getBytesSync(12);
  const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
  cipher.start({ iv });
  cipher.update(forge.util.createBuffer(plain, 'utf8'));
  cipher.finish();
  return {
    encryptedKey: forge.util.encode64(publicKey.encrypt(aesKey, 'RSA-OAEP', rsaOaepOptions())),
    iv: forge.util.encode64(iv),
    encryptedData: forge.util.encode64(cipher.output.getBytes() + cipher.mode.tag.getBytes()),
  };
}

async function test(action, body) {
  const res = await fetch(`http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(encryptPayload(body)),
  });
  const text = await res.text();
  const ok = !text.includes('"encryptedKey":null');
  console.log(`${action}: ${ok ? 'OK' : 'NULL'}`, text.slice(0, 100));
}

await test('getpreinsamount', {
  action: 'getpreinsamount',
  checkSum: 'fdc52076625ceafa488079ee37255a5be1ca1e425bbadd083a65e294df4eeaeb',
  passwd: env.VITE_API_PASSWORD,
  timeStamp: '14072026150000000',
  uname: 'MOBILE',
  vendor: 'MOBILE',
  bank: '068',
  customerId: '0000995092008866',
  insuranceType: 'PMJJBY',
  insuranceCoId: 'PMJJBY',
});

await test('validatetoken', {
  action: 'validatetoken',
  checkSum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  passwd: env.VITE_API_PASSWORD,
  timeStamp: '14072026150000000',
  uname: 'MOBILE',
  vendor: 'MOBILE',
  jwtToken: 'test-jwt',
});
