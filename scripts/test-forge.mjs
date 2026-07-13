import forge from 'node-forge';
import {
  createPrivateKey,
  privateDecrypt,
  constants,
  createDecipheriv,
} from 'crypto';

const sampleRequest = {
  encryptedKey:
    'Efy6djqN5r74n0+Zdky1RwBmywfMgKHAaaIonvKmZs+5s+vp719YNFvZIn/G4vMvip0HOT1DBhJ1p8Xu+Xjooh32U1mSo7GGkdYaZIotWwAbvmwcHWwfX00QoBaTZ0Ofj5hMUwKQtRYdazDOUFfoSnoDtsu8emUdhSeGU6cCg9jqFfsiK40DWFaRx4zH9JBX42rHWc8+IETpURaZKuQbO6p6DU2abT/1hGKuQ9gJ6WCd7hVP3kk+d6L/FhRbS1QjwTdaZcAYVDQZGzBiFHpf//mWyjEWAQzIbZgDCJUy1Iaf8crWY3UKGKUP/UhHfzoEEvW89NX+AhBbRyObaTvZAA==',
  iv: 'qJh7UmioZ03K1JSG',
  encryptedData:
    'YmfURej/1YG3ORBXEHqPKpybhHoE2CnysoMEJI5JRG14H5Hiw89CEh+R1FlDSeY9KloBwbtecK4/0HOUD3rlvm9Df+Nt55K/yulkg64Pmo51YWRdigVNFfanr8/26Wn0J/LkXypTaaTaa24hRCSJQ7da8a3SWGBYetMwFao46W6ggGFg8pwlJ0zTPiuSST5ROpaUnxxc7UNUEb7vOZd4RzvcnReHAJsJVXGoMZAxSY5x1gFiiygX+fnCO/xSlkzyMKhFNCnS+oLljlVcIgzljmsDRzhW05TdXlG0qu36wzNj8f7OJ4NTqmyELqDlcFL5LD0Z46vwXv4qXlQ1tG4zEVcMs9CrqkqDVJgLggTjJLE/Mu7G+FQEKgwMXDj5I5UMvPwOQ4m/iDsv5xlFI6DnUi0NSw/zSYhyr1efzg8Nx1rEP8O1V55h/YUCdQ11KALh4guUjzgHjD3Cwq2geqA3bErS42huFncdUO1v4FZnimKRxpNBUus62DxzEmrVLDTSheWmDPBGSDv6P1e4IV+GAs43mw5myS6X4quqINBedUIgg13y4LUVU94a1dUNocd5gtAaoQ1hkZo8bIeGpoW2tyCrHy129cnBXeiidE0nzj+KBl+gcXX6G4W62ntiCLaAHN0Hywh/S9b+yGonPT/3ww==',
};

const privPem = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCvUNy/JtHfjYN5
1OgKYJsHsVMfLUW5sdlnIY2MSm3hrqWa/7inRuCE+2bthhz9hnUIYF5YdSOY3NBU
pnDgFdA6z9KPPbgKpgNNX6rNskcAHULbUcafL6NNxEobwnurwiRWOf3AscpIHypx
12UbzMrf0WDLdutuMDG5Ba7cSRIdU/LxK3bp4+cmEZMzIJx2RArHtFV/tuTAaMDY
NGXV+w7pEgrhF/c4S1QBcqGM5WtO/Y1MuNQUrzM8d25JM41epQxfHFz2jrwMDfSE
d+wG88n1XhijKJIzgfAKeXtjMa/KMvpUs79DObeWxyDey3uicf/tIibZ7nKM6kTR
OwBSRe0tAgMBAAECggEAL6DTv9ifhtDOya/2NC+HnqDlmKA3g5nWGscKSfVEgd3t
Hr1fYI6IW4hjL59SS+wV6mcn6nc0awh+TqkDHFXAwuGH7iNR1w6/8erOH+DRmi3Y
5nWCdOe/wVZU3dLJv2FYdtZ9YjbK4ioZYWEnllReP00GM3CEyGQudfodxbnSQoYD
NAghY+dXWDXHlFdNcGzBMMcsZMymHgkTNEXcMk4z7kcClVBlR3QamB9XQBTW0Ymk
/Y9pIKX26BFUAn8xNuGodS9O7vsSde0mtGzA/i2d/7FqiDa8DxmOx4HDHKIhXEZV
aHUZ43H4qqop5I76eDRz5T25qU0aoSQFJHZQZT4HTwKBgQDhS/p65rtwlrv6nLsy
BUh+uMCEjzwsSZ6Tv6vt6cktl3EcfK95kiyfubg14knvBxP6fShElrLjmo8a/wkO
0tJY/7MAFDOSDUhY0J64nGzHRkhO7Fq2/kfAm5ZU+hx+k9y5L+jHqo0whUZQhpVa
6sJAHGQ2yx8Mq3orkQyn0xFphwKBgQDHNS3M/MGgFX14aCvcvTMcWFWfZ/3uhiv+
/mRqQsLpW05fXaEKKBwDyEAXURYTuRl/CZ5s/15Bf38ldgvB6kFD/ib/Z/lxMm6N
aMliw9+DnEeG2HPxvcFuHWPXk0XOP0cKHQryLqgrWpdJVAz9pzeaHqKXaFOAGnBY
n6slG5QQqwKBgHTGfekQCR2dc4e9jyWpKV9NgbPzzhuieQhZ89KYN8di1KUQV5+q
zWhoyftb9DhpschG8QVEGyrv5Lb4dAhz68Vnm68xyV0td09ZqrtDkPplCnul9Isf
F6/UtUIMdZKCL4jpNT2wwAfjPIPmjimWvuKeFK917v0RMHy+bRHbzA2nAoGBALUo
kFk9dpwtTuhD27enO6bIUj1f5daXn8UJ9amIwxZSWYhybjP9W9S4tEhADlKrXxtf
VPqMlVv9JVSc8H5NmULLCw3zsS2XDmB87b9qn4Zhhc6EY5Rw20pXYee236F7fBAf
b0fk1Dxw6undjN7TxcXbnEMStfTmlkqSEaLyXIl3AoGASV2jNzO1FVwPFlrtCaXL
ZvGZrJoHCpGLcxxFUMi4+VFoK08U+HfIQUubPqiQ4nxSdsdmWBUzjeUDhzjXsdO2
dEOyyt1grcCPY3tkVvv6FjHr/E269lun7MDWgtZTd69JR7uhu53W+Ueu7K73R/sA
MqY8M0fPmW05EQDxNjHJDWA=
-----END PRIVATE KEY-----`;

const pubPem = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr1DcvybR342DedToCmCb
B7FTHy1FubHZZyGNjEpt4a6lmv+4p0bghPtm7YYc/YZ1CGBeWHUjmNzQVKZw4BXQ
Os/Sjz24CqYDTV+qzbJHAB1C21HGny+jTcRKG8J7q8IkVjn9wLHKSB8qcddlG8zK
39Fgy3brbjAxuQWu3EkSHVPy8St26ePnJhGTMyCcdkQKx7RVf7bkwGjA2DRl1fsO
6RIK4Rf3OEtUAXKhjOVrTv2NTLjUFK8zPHduSTONXqUMXxxc9o68DA30hHfsBvPJ
9V4YoyiSM4HwCnl7YzGvyjL6VLO/Qzm3lscg3st7onH/7SIm2e5yjOpE0TsAUkXt
LQIDAQAB
-----END PUBLIC KEY-----`;

const privateKey = forge.pki.privateKeyFromPem(privPem);
const publicKey = forge.pki.publicKeyFromPem(pubPem);

function forgeRsaDecrypt(encryptedKeyB64, md, mgf1Md) {
  const bytes = forge.util.decode64(encryptedKeyB64);
  return privateKey.decrypt(bytes, 'RSA-OAEP', {
    md: forge.md[md].create(),
    mgf1: { md: forge.md[mgf1Md].create() },
  });
}

function aesDecrypt(encryptedData, aesKeyBytes, ivB64) {
  const iv = forge.util.decode64(ivB64);
  const data = forge.util.decode64(encryptedData);
  const tagLen = 16;
  const cipherBytes = data.slice(0, data.length - tagLen);
  const tag = data.slice(data.length - tagLen);
  const decipher = forge.cipher.createDecipher('AES-GCM', aesKeyBytes);
  decipher.start({ iv, tag: forge.util.createBuffer(tag) });
  decipher.update(forge.util.createBuffer(cipherBytes));
  const ok = decipher.finish();
  if (!ok) throw new Error('AES-GCM auth failed');
  return decipher.output.toString();
}

function tryDecrypt(body, label) {
  const combos = [
    ['sha256', 'sha1'],
    ['sha256', 'sha256'],
    ['sha1', 'sha1'],
  ];
  for (const [md, mgf1] of combos) {
    try {
      const aesKey = forgeRsaDecrypt(body.encryptedKey, md, mgf1);
      const plain = aesDecrypt(body.encryptedData, aesKey, body.iv);
      console.log(`${label} forge md=${md} mgf1=${mgf1}: OK`);
      console.log(plain.slice(0, 300));
      return true;
    } catch (e) {
      console.log(`${label} forge md=${md} mgf1=${mgf1}: FAIL (${e.message})`);
    }
  }
  return false;
}

console.log('=== Forge decrypt Java REQUEST ===');
tryDecrypt(sampleRequest, 'request');

const res = await fetch('http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sampleRequest),
});
const sampleResponse = await res.json();
console.log('\n=== Forge decrypt Java RESPONSE ===');
tryDecrypt(sampleResponse, 'response');

// Test encrypt with forge sha256/mgf1-sha1 and post to API
console.log('\n=== Forge encrypt + API test ===');
const plain = JSON.stringify({
  action: 'validatetoken',
  checkSum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  passwd: '95700e3a92830ae20ce0bddb23a2c1178f96017d70362572be90e293598c6126',
  timeStamp: '13072026140000000',
  uname: 'MOBILE',
  vendor: 'MOBILE',
  jwtToken: 'test-jwt',
});

const aesKey = forge.random.getBytesSync(32);
const iv = forge.random.getBytesSync(12);
const cipher = forge.cipher.createCipher('AES-GCM', aesKey);
cipher.start({ iv });
cipher.update(forge.util.createBuffer(plain, 'utf8'));
cipher.finish();
const encrypted = cipher.output.getBytes();
const tag = cipher.mode.tag.getBytes();
const encryptedData = forge.util.encode64(encrypted + tag);
const encryptedKey = forge.util.encode64(
  publicKey.encrypt(aesKey, 'RSA-OAEP', {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha1.create() },
  }),
);
const body = {
  encryptedKey,
  iv: forge.util.encode64(iv),
  encryptedData,
};
const apiRes = await fetch('http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const apiText = await apiRes.text();
console.log('forge encrypt API:', apiText.includes('"encryptedKey":null') ? 'NULL' : 'OK', apiText.slice(0, 120));

// verify local roundtrip
const aesBack = forgeRsaDecrypt(encryptedKey, 'sha256', 'sha1');
const roundtrip = aesDecrypt(encryptedData, aesBack, forge.util.encode64(iv));
console.log('forge roundtrip:', roundtrip === plain ? 'PASS' : 'FAIL');
