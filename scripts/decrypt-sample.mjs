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

function decryptEnvelope(body, label) {
  const priv = createPrivateKey(privPem);
  for (const hash of ['sha256', 'sha1', undefined]) {
    try {
      const opts = { key: priv, padding: constants.RSA_PKCS1_OAEP_PADDING };
      if (hash) opts.oaepHash = hash;
      const aesRaw = privateDecrypt(opts, Buffer.from(body.encryptedKey, 'base64'));
      const iv = Buffer.from(body.iv, 'base64');
      const data = Buffer.from(body.encryptedData, 'base64');
      const decipher = createDecipheriv('aes-256-gcm', aesRaw, iv);
      decipher.setAuthTag(data.subarray(-16));
      const plain =
        decipher.update(data.subarray(0, -16), undefined, 'utf8') + decipher.final('utf8');
      console.log(`${label} hash ${hash ?? 'default'}: OK`);
      console.log(plain.slice(0, 300));
      return;
    } catch {
      // try next
    }
  }
  console.log(`${label}: all hashes failed`);
}

console.log('=== Java sample REQUEST ===');
decryptEnvelope(sampleRequest, 'request');

const res = await fetch('http://demo.datavsn.com/whatsapp/cmrequest/cmdataprocessing/validatetoken', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(sampleRequest),
});
const sampleResponse = await res.json();
console.log('\n=== Java sample RESPONSE ===');
decryptEnvelope(sampleResponse, 'response');
