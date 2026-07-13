import forge from 'node-forge';
import { createDecipheriv } from 'crypto';
import { readFileSync } from 'fs';

const envelope = {
  encryptedKey:
    'cCGKFWqtND32JqJuChWe4fTtZlo8THnYn/XC4Memkvs88LsEuInv/SZJn/B80z+7WsbiySJ1VaTphdnpCZcBKcSYHqc21sgMBRRRPtMwPgO7Vwwjh8RS2nIlxwfj0mvwWapRHOJjAcsYkLWsrQKWqI1GqetoxKO/GiGNn2APE76SiPEc/l+Ol+KWQ7vaAhaTbm6xelMEkb0Gqyu8oYu1Ft5M+E3mUrVUFxyKF2dUXrkeLRdISPKDWNJuYdbkgjCztC20IzsGOvrO9nDm+xb/uiT+a1SLUu3z8nnQZ8O1onNeZ06QQsf5DsklMs0Ikrae98cF4zBUzaSvJxpOYHX8Rw==',
  iv: '2Cs60/MVhmOtAg4I',
  encryptedData:
    'ZB8d2poohO/b85MVRkealq5G4r84qZd1MEN0516mpWFEIguQS5AvDfGQ0IB+f7aBlMly0i/6wM1ywU1fzE+wOpCpDPQ5OIwAaQmWh4v39qnLSndVRHEi3Kng/dmW/9VqZzYDgC2WAPA5x8B7LL+ekI0Phe06/uJa8hjGToSVKFdb0FlNSoj4HxUOl9xqLpzRZADH+AZCmCcgBkMgmHoUXvbG+nHJ2t6fnFleVGVZtVfFCtAKNDNkENZpNUV0UId6p2d+mwMPuuEa',
};

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
