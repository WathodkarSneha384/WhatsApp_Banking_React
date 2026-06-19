const DEFAULT_API_BASE = '/dmCmsService/rest/endpoints';

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

export const apiConfig = {
  apiBase: resolveApiBase(),
  bank: envOrDefault('VITE_BANK_CODE', '068'),
  secretKey: envOrDefault('VITE_API_SECRET_KEY', ''),
  vendor: envOrDefault('VITE_API_VENDOR', 'MOBILE'),
  username: envOrDefault('VITE_API_USERNAME', 'MOBILE'),
  password: envOrDefault('VITE_API_PASSWORD', ''),
  channel: envOrDefault('VITE_API_CHANNEL', 'WB'),
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
