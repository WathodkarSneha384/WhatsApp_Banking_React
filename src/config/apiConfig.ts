import { RSA_PUBLIC_KEY_PEM } from './rsaPublicKey';

const DEFAULT_API_BASE = '/dmCmsService/rest/endpoints';
const DEFAULT_ENCRYPTED_API_PATH = '/whatsapp/cmrequest/cmdataprocessing';

function resolveApiBase(): string {
  const configured = import.meta.env.VITE_API_BASE?.trim();

  if (!configured) {
    return DEFAULT_API_BASE;
  }

  // Never allow localhost in production builds — use same-origin proxy via nginx.
  if (!import.meta.env.DEV && /localhost|127\.0\.0\.1/i.test(configured)) {
    console.warn(
      '[apiConfig] VITE_API_BASE points to localhost in production; using relative path instead.',
    );
    return DEFAULT_API_BASE;
  }

  return configured.replace(/\/$/, '');
}

function envOrDefault(name: string, fallback: string): string {
  const value = import.meta.env[name]?.trim();
  return value || fallback;
}

function envOptional(name: string): string {
  return import.meta.env[name]?.trim() || '';
}

function normalizeMultilinePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function resolveEncryptedApiPath(): string {
  const configured = import.meta.env.VITE_ENCRYPTED_API_PATH?.trim();
  if (!configured) return DEFAULT_ENCRYPTED_API_PATH;
  return configured.startsWith('/') ? configured : `/${configured}`;
}

export const piEncryptionConfig = {
  /** Enable hybrid RSA/AES encryption for PI-sensitive Channel Manager APIs. */
  enabled: import.meta.env.VITE_PI_ENCRYPTION_ENABLED === 'true',
  apiPath: resolveEncryptedApiPath(),
  publicKeyPem: normalizeMultilinePem(
    envOptional('VITE_RSA_PUBLIC_KEY') || RSA_PUBLIC_KEY_PEM,
  ),
  privateKeyPem: normalizeMultilinePem(envOptional('VITE_RSA_PRIVATE_KEY')),
} as const;

export const apiConfig = {
  apiBase: resolveApiBase(),
  bank: envOrDefault('VITE_BANK_CODE', '068'),
  secretKey: envOrDefault('VITE_API_SECRET_KEY', '35fc015d9308f316bd524c824cce9cd56ea7e455c6fe5b37bf'),
  vendor: envOrDefault('VITE_API_VENDOR', 'MOBILE'),
  username: envOrDefault('VITE_API_USERNAME', 'MOBILE'),
  password: envOrDefault('VITE_API_PASSWORD', '95700e3a92830ae20ce0bddb23a2c1178f96017d70362572be90e293598c6126'),
  channel: envOrDefault('VITE_API_CHANNEL', 'WB'),
  // Optional — when set, session expiry redirects here after trying to close the webview.
  whatsappReturnUrl: envOptional('VITE_WHATSAPP_RETURN_URL'),
} as const;

/** Dev-only fallbacks when URL params are omitted (npm run dev). */
export function getDevCustomerFallback(): { customerId: string; mobileNo: string } | null {
  if (!import.meta.env.DEV) return null;

  const customerId = import.meta.env.VITE_DEV_CUSTOMER_ID?.trim();
  const mobileNo = import.meta.env.VITE_DEV_MOBILE_NO?.trim();

  if (customerId && mobileNo) {
    return { customerId, mobileNo };
  }

  return null;
}
