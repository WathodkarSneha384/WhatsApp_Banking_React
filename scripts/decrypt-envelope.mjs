import forge from 'node-forge';
import { createDecipheriv } from 'crypto';
import { readFileSync } from 'fs';

const envelope = {
  encryptedKey:
    'M+GAtsSyKNBq8fqOTcd769vHEWWzRwItNZ7vta1PVq6cB/gWxdLQtub8OM+wyYWdgJztvxURPbdtNn3Byw7YcVcolBTPr25tMXZCbvXXK1s9KP/obB8sG6fuFUDj0sb3vG+6L3JVqhwf+HtipZUvjedG/y0WLZPc2VQuJ3LAwjo/gjMbjLDT7+xU+mjHFSg97YLVhQCcJ+fFu7L9XBNtsvl1+O2tQnKqGnb1gA7n2XG/3DWmpgmbjjP5KfC355vydaCcd7Q9vTIhW+f/JN2e8SBGqtJ5ADbAFSuT1pG2HeHSswW5EV3o+KcKrA0J68q9O8xq5yNBewPkBcl06BzvhA==',
  iv: 'V6v0lz/Cbb49ep+d',
  encryptedData:
    'vRpFVNM8BS5vJoBEA3xXVMZ8swUtW3bn7i5nFRolFemKTpfn3yq+3hZeYWuaVQbjqHI3YFw4CEXTJVFSDt2SeNXTEdXor6ahhMEXvQZvt2a8tk5cLxbGbhSszDDz/3gA/3SupQoTNkzFjIKn1Ic4MS96w8OC/EYm9c/jwGqGwm/eloUR8pZY3jnAz8Kejivq4kKKkqAaYMiQg1R/2HK4wA09VltzTp8netLZVKCbEhK9b7/stpbXvMtD+HlurSefCyZQFwgvwVnqlGt3XhHSsT/HZ/o=',
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
