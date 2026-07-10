/**
 * Hybrid encryption for Channel Manager cmdataprocessing endpoint.
 * Matches backend: AES-256-GCM (12-byte IV, 128-bit tag) + RSA-OAEP SHA-256.
 */

export interface EncryptedEnvelope {
  encryptedKey: string;
  iv: string;
  encryptedData: string;
}

const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 128;

function stripPem(pem: string, label: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
  return pem
    .replace(`-----BEGIN ${label}-----`, '')
    .replace(`-----END ${label}-----`, '')
    .replace(/\s/g, '');
}

function pemToArrayBuffer(pem: string, label: 'PUBLIC KEY' | 'PRIVATE KEY'): ArrayBuffer {
  const binary = atob(stripPem(pem, label));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.encryptedKey === 'string'
    && typeof obj.iv === 'string'
    && typeof obj.encryptedData === 'string'
  );
}

let publicKeyPromise: Promise<CryptoKey> | null = null;
let privateKeyPromise: Promise<CryptoKey> | null = null;

async function getPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  if (!publicKeyPromise) {
    publicKeyPromise = crypto.subtle.importKey(
      'spki',
      pemToArrayBuffer(publicKeyPem, 'PUBLIC KEY'),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
  }
  return publicKeyPromise;
}

async function getPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  if (!privateKeyPromise) {
    privateKeyPromise = crypto.subtle.importKey(
      'pkcs8',
      pemToArrayBuffer(privateKeyPem, 'PRIVATE KEY'),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt'],
    );
  }
  return privateKeyPromise;
}

export function resetPiEncryptionKeyCache(): void {
  publicKeyPromise = null;
  privateKeyPromise = null;
}

export async function encryptJson(
  plainJson: string,
  publicKeyPem: string,
): Promise<EncryptedEnvelope> {
  const publicKey = await getPublicKey(publicKeyPem);
  const aesKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
  const encryptedDataBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
    aesKey,
    new TextEncoder().encode(plainJson),
  );
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  const encryptedKeyBuf = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAes);

  return {
    encryptedKey: arrayBufferToBase64(encryptedKeyBuf),
    iv: arrayBufferToBase64(iv.buffer),
    encryptedData: arrayBufferToBase64(encryptedDataBuf),
  };
}

export async function decryptJson(
  envelope: EncryptedEnvelope,
  privateKeyPem: string,
): Promise<string> {
  const privateKey = await getPrivateKey(privateKeyPem);
  const aesKeyRaw = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    base64ToUint8Array(envelope.encryptedKey),
  );
  const aesKey = await crypto.subtle.importKey(
    'raw',
    aesKeyRaw,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const iv = base64ToUint8Array(envelope.iv);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
    aesKey,
    base64ToUint8Array(envelope.encryptedData),
  );
  return new TextDecoder().decode(plainBuf);
}

export async function parseMaybeEncryptedResponse<T>(
  raw: unknown,
  privateKeyPem: string,
): Promise<T> {
  if (isEncryptedEnvelope(raw)) {
    const json = await decryptJson(raw, privateKeyPem);
    return JSON.parse(json) as T;
  }
  return raw as T;
}
