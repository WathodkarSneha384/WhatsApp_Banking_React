/**
 * Mirrors backend com.datavsn.whatsappbanking:
 *   EncryptionDecryptionService.encrypt / decrypt
 *   AESUtil  — AES/GCM/NoPadding, 256-bit key, 12-byte IV, 128-bit tag
 *   RSAUtil  — RSA/ECB/OAEPWithSHA-256AndMGF1Padding on aesKey.getEncoded()
 *
 * Java OAEP uses SHA-256 for the main digest and SHA-1 for MGF1. Web Crypto uses
 * SHA-256 for both, so RSA uses node-forge to match the backend cipher exactly.
 *
 * Keys must match PemKeyLoader on the server:
 *   VITE_RSA_PUBLIC_KEY  → pemKeyLoader.loadPublicKey()  (encrypt requests)
 *   VITE_RSA_PRIVATE_KEY → pemKeyLoader.loadPrivateKey() (decrypt responses)
 */

import forge from 'node-forge';
import { piEncryptionConfig } from '../config/apiConfig';

/** Same shape as backend EncryptResponse / DecryptRequest. */
export interface EncryptResponse {
  encryptedKey: string;
  iv: string;
  encryptedData: string;
}

export type DecryptRequest = EncryptResponse;
export type EncryptedEnvelope = EncryptResponse;

const AES_KEY_BITS = 256;
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 128;

function binaryToUint8Array(binary: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Java RSA/ECB/OAEPWithSHA-256AndMGF1Padding (MGF1 uses SHA-1). */
function rsaOaepOptions() {
  return {
    md: forge.md.sha256.create(),
    mgf1: { md: forge.md.sha1.create() },
  };
}

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
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

function resolveAesKeyLength(byteLength: number): 128 | 192 | 256 {
  if (byteLength === 16) return 128;
  if (byteLength === 24) return 192;
  if (byteLength === 32) return 256;
  throw new Error(`Unsupported AES key length: ${byteLength} bytes`);
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

/** Server returns null fields when it cannot decrypt the request envelope. */
export function isValidEncryptedEnvelope(value: unknown): value is EncryptedEnvelope {
  if (!isEncryptedEnvelope(value)) return false;
  return Boolean(value.encryptedKey && value.iv && value.encryptedData);
}

const publicKeyCache = new Map<string, forge.pki.rsa.PublicKey>();
const privateKeyCache = new Map<string, forge.pki.rsa.PrivateKey>();

function getForgePublicKey(publicKeyPem: string): forge.pki.rsa.PublicKey {
  let cached = publicKeyCache.get(publicKeyPem);
  if (!cached) {
    cached = forge.pki.publicKeyFromPem(publicKeyPem);
    publicKeyCache.set(publicKeyPem, cached);
  }
  return cached;
}

function getForgePrivateKey(privateKeyPem: string): forge.pki.rsa.PrivateKey {
  let cached = privateKeyCache.get(privateKeyPem);
  if (!cached) {
    cached = forge.pki.privateKeyFromPem(privateKeyPem);
    privateKeyCache.set(privateKeyPem, cached);
  }
  return cached;
}

export function resetPiEncryptionKeyCache(): void {
  publicKeyCache.clear();
  privateKeyCache.clear();
}

/** aesUtil.generateKey() — AES-256 */
async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_BITS },
    true,
    ['encrypt', 'decrypt'],
  );
}

/** aesUtil.generateIV() */
function generateIV(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(GCM_IV_LENGTH));
}

/** aesUtil.encrypt(json, aesKey, iv) → Base64 ciphertext (+ GCM tag) */
async function aesEncrypt(
  plainText: string,
  aesKey: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
    aesKey,
    new TextEncoder().encode(plainText),
  );
  return arrayBufferToBase64(encrypted);
}

/** aesUtil.decrypt(encryptedData, aesKey, iv) */
async function aesDecrypt(
  encryptedData: string,
  aesKey: CryptoKey,
  iv: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: GCM_TAG_LENGTH },
    aesKey,
    base64ToUint8Array(encryptedData),
  );
  return new TextDecoder().decode(plainBuf);
}

/** rsaUtil.encryptAESKey — RSA/ECB/OAEPWithSHA-256AndMGF1Padding on aesKey.getEncoded() */
async function rsaEncryptAESKey(
  aesKey: CryptoKey,
  publicKeyPem: string,
): Promise<string> {
  const publicKey = getForgePublicKey(publicKeyPem);
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const encryptedKey = publicKey.encrypt(
    forge.util.binary.raw.encode(rawAes),
    'RSA-OAEP',
    rsaOaepOptions(),
  );
  return forge.util.encode64(encryptedKey);
}

/** rsaUtil.decryptAESKey — RSA/ECB/OAEPWithSHA-256AndMGF1Padding → SecretKeySpec(bytes, "AES") */
async function rsaDecryptAESKey(
  encryptedKey: string,
  privateKeyPem: string,
): Promise<CryptoKey> {
  const privateKey = getForgePrivateKey(privateKeyPem);
  const aesKeyBinary = privateKey.decrypt(
    forge.util.decode64(encryptedKey),
    'RSA-OAEP',
    rsaOaepOptions(),
  );
  const aesKeyRaw = binaryToUint8Array(aesKeyBinary);
  return crypto.subtle.importKey(
    'raw',
    aesKeyRaw,
    { name: 'AES-GCM', length: resolveAesKeyLength(aesKeyRaw.byteLength) },
    false,
    ['decrypt'],
  );
}

/**
 * Encrypt JSON — mirrors EncryptionDecryptionService.encrypt(String json).
 */
export async function encrypt(
  json: string,
  publicKeyPem = piEncryptionConfig.requestPublicKeyPem,
): Promise<EncryptResponse> {
  if (!publicKeyPem) {
    throw new Error('VITE_RSA_PUBLIC_KEY is required to encrypt API requests.');
  }

  const aesKey = await generateAesKey();
  const iv = generateIV();
  const encryptedData = await aesEncrypt(json, aesKey, iv);
  const encryptedKey = await rsaEncryptAESKey(aesKey, publicKeyPem);

  return {
    encryptedKey,
    iv: arrayBufferToBase64(iv),
    encryptedData,
  };
}

/**
 * Decrypt envelope — mirrors EncryptionDecryptionService.decrypt(DecryptRequest).
 */
export async function decrypt(
  request: DecryptRequest,
  privateKeyPem = piEncryptionConfig.responsePrivateKeyPem,
): Promise<string> {
  if (!privateKeyPem) {
    throw new Error('VITE_RSA_PRIVATE_KEY is required to decrypt API responses.');
  }

  const aesKey = await rsaDecryptAESKey(request.encryptedKey, privateKeyPem);
  const iv = base64ToUint8Array(request.iv);
  return aesDecrypt(request.encryptedData, aesKey, iv);
}

/** @deprecated Use encrypt() */
export async function encryptJson(
  plainJson: string,
  publicKeyPem: string,
): Promise<EncryptedEnvelope> {
  return encrypt(plainJson, publicKeyPem);
}

/** @deprecated Use decrypt() */
export async function decryptJson(
  envelope: DecryptRequest,
  privateKeyPem: string,
): Promise<string> {
  return decrypt(envelope, privateKeyPem);
}

export async function encryptPayload(payload: unknown): Promise<EncryptResponse> {
  return encrypt(JSON.stringify(payload));
}

export async function parseMaybeEncryptedResponse<T>(
  raw: unknown,
  privateKeyPem: string,
): Promise<T> {
  if (isEncryptedEnvelope(raw) && !isValidEncryptedEnvelope(raw)) {
    throw new Error(
      'Bank API returned an empty encrypted response. The server could not decrypt the request — verify VITE_RSA_PUBLIC_KEY matches rsaUtil on the backend.',
    );
  }

  if (isValidEncryptedEnvelope(raw)) {
    try {
      const json = await decrypt(raw, privateKeyPem);
      return JSON.parse(json) as T;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Unknown decryption error';
      throw new Error(
        `Failed to decrypt bank API response. Verify VITE_RSA_PRIVATE_KEY matches rsaUtil on the backend. (${detail})`,
      );
    }
  }

  return raw as T;
}
