import type { PMSocialSubservice, ServiceType } from '../types';

export interface CustomerLinkSession {
  customerId: string;
  mobileNo: string;
  customerName: string | null;
}

const CUSTOMER_KEYS = ['customerId', 'customerID', 'customer_id', 'cif', 'customerCode'] as const;
const MOBILE_KEYS = ['mobile', 'mobileNo', 'mobileNO', 'mobileNumber', 'mobile_number'] as const;
const NAME_KEYS = ['customerName', 'customer_name', 'name'] as const;
const TOKEN_KEYS = ['token', 'jwtToken', 'jwt'] as const;
const VALID_SERVICES: ServiceType[] = ['pps', 'nominee', 'pmsocial', 'openfd'];
const PM_SOCIAL_SUBSERVICES: PMSocialSubservice[] = ['PMJJBY', 'PMSBY', 'PMAPY'];

function readFirstParam(params: URLSearchParams, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

/** True when the value looks like a JWT (WhatsApp link puts it in ?service=). */
export function isJwtToken(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('eyJ') && trimmed.split('.').length === 3;
}

/** Normalize mobile from URL — strips spaces and +91 country prefix when present. */
export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  return digits || value.trim();
}

/** JWT from ?service=<jwt> (primary) or legacy ?token= / ?jwtToken=. */
export function getJwtFromParams(params: URLSearchParams): string | null {
  const serviceParam = params.get('service')?.trim();
  if (serviceParam && isJwtToken(serviceParam)) return serviceParam;
  return readFirstParam(params, TOKEN_KEYS);
}

export function getTokenFromParams(params: URLSearchParams): string | null {
  return getJwtFromParams(params);
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

/** True when URL has a JWT or legacy customerId + mobile pair. */
export function hasRequiredLinkParams(params: URLSearchParams): boolean {
  return getJwtFromParams(params) !== null || extractCustomerFromUrl(params) !== null;
}

export function resolvePmSocialSubservice(subService: string | null | undefined): PMSocialSubservice | null {
  if (!subService) return null;
  const normalized = subService.trim().toUpperCase();
  return PM_SOCIAL_SUBSERVICES.includes(normalized as PMSocialSubservice)
    ? (normalized as PMSocialSubservice)
    : null;
}

function appendAuthParams(next: URLSearchParams, params: URLSearchParams): void {
  const jwt = getJwtFromParams(params);
  const session = extractCustomerFromUrl(params);

  if (jwt) {
    next.set('service', jwt);
    return;
  }

  if (session) {
    next.set('customerId', session.customerId);
    next.set('mobile', session.mobileNo);
    if (session.customerName) next.set('customerName', session.customerName);
  }
}

/** Query string to preserve on home / redirects (JWT in service or legacy params). */
export function getPreservedLinkQuery(params: URLSearchParams): string {
  const next = new URLSearchParams();
  appendAuthParams(next, params);

  const query = next.toString();
  return query ? `?${query}` : '';
}

export function buildServicePath(
  service: string,
  params: URLSearchParams,
  subservice?: string | null,
): string {
  const jwt = getJwtFromParams(params);
  if (jwt) {
    return `/?service=${encodeURIComponent(jwt)}`;
  }

  const next = new URLSearchParams();
  if (VALID_SERVICES.includes(service as ServiceType)) {
    next.set('service', service);
  }
  appendAuthParams(next, params);

  if (subservice) next.set('subservice', subservice);

  return `/?${next.toString()}`;
}

export function buildHomePath(params: URLSearchParams, extra?: Record<string, string>): string {
  const next = new URLSearchParams();
  appendAuthParams(next, params);

  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      next.set(key, value);
    }
  }

  const query = next.toString();
  return query ? `/?${query}` : '/';
}
