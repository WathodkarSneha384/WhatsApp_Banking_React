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

const publicPem = env.VITE_RSA_PUBLIC_KEY.replace(/\\n/g, '\n');
const publicKey = forge.pki.publicKeyFromPem(publicPem);

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

const javaSample = {
  encryptedKey:
    'Efy6djqN5r74n0+Zdky1RwBmywfMgKHAaaIonvKmZs+5s+vp719YNFvZIn/G4vMvip0HOT1DBhJ1p8Xu+Xjooh32U1mSo7GGkdYaZIotWwAbvmwcHWwfX00QoBaTZ0Ofj5hMUwKQtRYdazDOUFfoSnoDtsu8emUdhSeGU6cCg9jqFfsiK40DWFaRx4zH9JBX42rHWc8+IETpURaZKuQbO6p6DU2abT/1hGKuQ9gJ6WCd7hVP3kk+d6L/FhRbS1QjwTdaZcAYVDQZGzBiFHpf//mWyjEWAQzIbZgDCJUy1Iaf8crWY3UKGKUP/UhHfzoEEvW89NX+AhBbRyObaTvZAA==',
  iv: 'qJh7UmioZ03K1JSG',
  encryptedData:
    'YmfURej/1YG3ORBXEHqPKpybhHoE2CnysoMEJI5JRG14H5Hiw89CEh+R1FlDSeY9KloBwbtecK4/0HOUD3rlvm9Df+Nt55K/yulkg64Pmo51YWRdigVNFfanr8/26Wn0J/LkXypTaaTaa24hRCSJQ7da8a3SWGBYetMwFao46W6ggGFg8pwlJ0zTPiuSST5ROpaUnxxc7UNUEb7vOZd4RzvcnReHAJsJVXGoMZAxSY5x1gFiiygX+fnCO/xSlkzyMKhFNCnS+oLljlVcIgzljmsDRzhW05TdXlG0qu36wzNj8f7OJ4NTqmyELqDlcFL5LD0Z46vwXv4qXlQ1tG4zEVcMs9CrqkqDVJgLggTjJLE/Mu7G+FQEKgwMXDj5I5UMvPwOQ4m/iDsv5xlFI6DnUi0NSw/zSYhyr1efzg8Nx1rEP8O1V55h/YUCdQ11KALh4guUjzgHjD3Cwq2geqA3bErS42huFncdUO1v4FZnimKRxpNBUus62DxzEmrVLDTSheWmDPBGSDv6P1e4IV+GAs43mw5myS6X4quqINBedUIgg13y4LUVU94a1dUNocd5gtAaoQ1hkZo8bIeGpoW2tyCrHy129cnBXeiidE0nzj+KBl+gcXX6G4W62ntiCLaAHN0Hywh/S9b+yGonPT/3ww==',
};

const validatetokenPayload = {
  action: 'validatetoken',
  checkSum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  passwd: env.VITE_API_PASSWORD,
  timeStamp: '14072026150000000',
  uname: 'MOBILE',
  vendor: 'MOBILE',
  jwtToken: 'test-jwt',
};

const hosts = [
  'http://demo.datavsn.com',
  'http://10.2.0.121:8182',
];

async function post(host, label, body) {
  try {
    const res = await fetch(`${host}/whatsapp/cmrequest/cmdataprocessing/validatetoken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text();
    const ok = !text.includes('"encryptedKey":null');
    console.log(`${label} @ ${host}: ${ok ? 'OK' : 'NULL'} ${text.slice(0, 90)}`);
  } catch (e) {
    console.log(`${label} @ ${host}: ERROR ${e.message}`);
  }
}

for (const host of hosts) {
  await post(host, 'java-sample', javaSample);
  await post(host, 'forge-validatetoken', encryptPayload(validatetokenPayload));
}
