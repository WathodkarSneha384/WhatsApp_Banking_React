import {
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  constants,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';
import { readFileSync } from 'fs';

const PUBLIC_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr1DcvybR342DedToCmCb
B7FTHy1FubHZZyGNjEpt4a6lmv+4p0bghPtm7YYc/YZ1CGBeWHUjmNzQVKZw4BXQ
Os/Sjz24CqYDTV+qzbJHAB1C21HGny+jTcRKG8J7q8IkVjn9wLHKSB8qcddlG8zK
39Fgy3brbjAxuQWu3EkSHVPy8St26ePnJhGTMyCcdkQKx7RVf7bkwGjA2DRl1fsO
6RIK4Rf3OEtUAXKhjOVrTv2NTLjUFK8zPHduSTONXqUMXxxc9o68DA30hHfsBvPJ
9V4YoyiSM4HwCnl7YzGvyjL6VLO/Qzm3lscg3st7onH/7SIm2e5yjOpE0TsAUkXt
LQIDAQAB
-----END PUBLIC KEY-----`;

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
const pub = createPublicKey(PUBLIC_PEM);
const priv = createPrivateKey(privatePem);

function encryptEnvelope(plain) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    encryptedKey: publicEncrypt(
      { key: pub, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      aesKey,
    ).toString('base64'),
    iv: iv.toString('base64'),
    encryptedData: Buffer.concat([enc, tag]).toString('base64'),
  };
}

function decryptEnvelope(body) {
  const aesRaw = privateDecrypt(
    { key: priv, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(body.encryptedKey, 'base64'),
  );
  const iv = Buffer.from(body.iv, 'base64');
  const data = Buffer.from(body.encryptedData, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', aesRaw, iv);
  decipher.setAuthTag(data.subarray(-16));
  return decipher.update(data.subarray(0, -16), undefined, 'utf8') + decipher.final('utf8');
}

const plain = JSON.stringify({
  action: 'validatetoken',
  checkSum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  passwd: env.VITE_API_PASSWORD,
  timeStamp: '13072026140000000',
  uname: 'MOBILE',
  vendor: 'MOBILE',
  jwtToken: 'test-jwt',
});

const body = encryptEnvelope(plain);
const roundtrip = decryptEnvelope(body);
console.log('Key pair roundtrip:', roundtrip === plain ? 'PASS' : 'FAIL');

async function post(label, oaepHash) {
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const opts = { key: pub, padding: constants.RSA_PKCS1_OAEP_PADDING };
  if (oaepHash) opts.oaepHash = oaepHash;
  const body = {
    encryptedKey: publicEncrypt(opts, aesKey).toString('base64'),
    iv: iv.toString('base64'),
    encryptedData: Buffer.concat([enc, tag]).toString('base64'),
  };
  const res = await fetch('http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const ok = !text.includes('"encryptedKey":null');
  console.log(`${label}:`, ok ? 'OK' : 'NULL', text.slice(0, 80));
}

await post('oaep-sha256', 'sha256');
await post('oaep-sha1', 'sha1');
await post('oaep-default', undefined);

const sample = {
  encryptedKey: 'Efy6djqN5r74n0+Zdky1RwBmywfMgKHAaaIonvKmZs+5s+vp719YNFvZIn/G4vMvip0HOT1DBhJ1p8Xu+Xjooh32U1mSo7GGkdYaZIotWwAbvmwcHWwfX00QoBaTZ0Ofj5hMUwKQtRYdazDOUFfoSnoDtsu8emUdhSeGU6cCg9jqFfsiK40DWFaRx4zH9JBX42rHWc8+IETpURaZKuQbO6p6DU2abT/1hGKuQ9gJ6WCd7hVP3kk+d6L/FhRbS1QjwTdaZcAYVDQZGzBiFHpf//mWyjEWAQzIbZgDCJUy1Iaf8crWY3UKGKUP/UhHfzoEEvW89NX+AhBbRyObaTvZAA==',
  iv: 'qJh7UmioZ03K1JSG',
  encryptedData: 'YmfURej/1YG3ORBXEHqPKpybhHoE2CnysoMEJI5JRG14H5Hiw89CEh+R1FlDSeY9KloBwbtecK4/0HOUD3rlvm9Df+Nt55K/yulkg64Pmo51YWRdigVNFfanr8/26Wn0J/LkXypTaaTaa24hRCSJQ7da8a3SWGBYetMwFao46W6ggGFg8pwlJ0zTPiuSST5ROpaUnxxc7UNUEb7vOZd4RzvcnReHAJsJVXGoMZAxSY5x1gFiiygX+fnCO/xSlkzyMKhFNCnS+oLljlVcIgzljmsDRzhW05TdXlG0qu36wzNj8f7OJ4NTqmyELqDlcFL5LD0Z46vwXv4qXlQ1tG4zEVcMs9CrqkqDVJgLggTjJLE/Mu7G+FQEKgwMXDj5I5UMvPwOQ4m/iDsv5xlFI6DnUi0NSw/zSYhyr1efzg8Nx1rEP8O1V55h/YUCdQ11KALh4guUjzgHjD3Cwq2geqA3bErS42huFncdUO1v4FZnimKRxpNBUus62DxzEmrVLDTSheWmDPBGSDv6P1e4IV+GAs43mw5myS6X4quqINBedUIgg13y4LUVU94a1dUNocd5gtAaoQ1hkZo8bIeGpoW2tyCrHy129cnBXeiidE0nzj+KBl+gcXX6G4W62ntiCLaAHN0Hywh/S9b+yGonPT/3ww==',
};
const sampleRes = await fetch('http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sample),
});
const sampleText = await sampleRes.text();
console.log('java-sample:', sampleText.includes('"encryptedKey":null') ? 'NULL' : 'OK', sampleText.slice(0, 80));
