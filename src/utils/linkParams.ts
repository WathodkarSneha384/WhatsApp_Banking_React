export interface CustomerLinkSession {
  customerId: string;
  mobileNo: string;
  customerName: string | null;
}

const CUSTOMER_KEYS = ['customerId', 'customerID', 'customer_id', 'cif', 'customerCode'] as const;
const MOBILE_KEYS = ['mobile', 'mobileNo', 'mobileNO', 'mobileNumber', 'mobile_number'] as const;
const NAME_KEYS = ['customerName', 'customer_name', 'name'] as const;

function readFirstParam(params: URLSearchParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

/** Normalize mobile from URL — strips spaces and +91 country prefix when present. */
export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits || value.trim();
}

export function getCustomerIdFromParams(params: URLSearchParams): string | null {
  return readFirstParam(params, CUSTOMER_KEYS);
}

export function getMobileFromParams(params: URLSearchParams): string | null {
  const raw = readFirstParam(params, MOBILE_KEYS);
  return raw ? normalizeMobile(raw) : null;
}

export function getCustomerNameFromParams(params: URLSearchParams): string | null {
  return readFirstParam(params, NAME_KEYS);
}

/** Read customerId, mobile, and optional name directly from the URL query string. */
export function extractCustomerFromUrl(params: URLSearchParams): CustomerLinkSession | null {
  const customerId = getCustomerIdFromParams(params);
  const mobileNo = getMobileFromParams(params);

  if (!customerId || !mobileNo) return null;

  return {
    customerId,
    mobileNo,
    customerName: getCustomerNameFromParams(params),
  };
}

export function hasRequiredLinkParams(params: URLSearchParams): boolean {
  return extractCustomerFromUrl(params) !== null;
}

/** Query string to preserve on home / redirects (customerId + mobile). */
export function getPreservedLinkQuery(params: URLSearchParams): string {
  const session = extractCustomerFromUrl(params);
  if (!session) return '';

  const preserved = new URLSearchParams();
  preserved.set('customerId', session.customerId);
  preserved.set('mobile', session.mobileNo);
  if (session.customerName) preserved.set('customerName', session.customerName);

  const query = preserved.toString();
  return query ? `?${query}` : '';
}

export function buildServicePath(
  service: string,
  params: URLSearchParams,
  subservice?: string | null,
): string {
  const session = extractCustomerFromUrl(params);
  const next = new URLSearchParams();
  next.set('service', service);

  if (session) {
    next.set('customerId', session.customerId);
    next.set('mobile', session.mobileNo);
    if (session.customerName) next.set('customerName', session.customerName);
  }

  if (subservice) next.set('subservice', subservice);

  return `/?${next.toString()}`;
}

export function buildHomePath(params: URLSearchParams, extra?: Record<string, string>): string {
  const session = extractCustomerFromUrl(params);
  const next = new URLSearchParams();

  if (session) {
    next.set('customerId', session.customerId);
    next.set('mobile', session.mobileNo);
    if (session.customerName) next.set('customerName', session.customerName);
  }

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `/?${query}` : '/';
}
