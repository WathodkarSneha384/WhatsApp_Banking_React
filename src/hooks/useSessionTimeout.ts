import { useEffect } from 'react';
import { apiConfig } from '../config/apiConfig';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_KEY = 'wa_banking_session_start';

export function clearSessionTimer() {
  sessionStorage.removeItem(SESSION_KEY);
}

/**
 * End the banking session. Tries to close the in-app browser/webview first.
 * Redirects to WhatsApp only when VITE_WHATSAPP_RETURN_URL is configured.
 */
export function exitOnSessionExpiry() {
  clearSessionTimer();

  try {
    window.close();
  } catch {
    // ignore — close may be blocked outside script-opened windows
  }

  const returnUrl = apiConfig.whatsappReturnUrl;
  if (returnUrl) {
    window.location.replace(returnUrl);
  }
}

export function useSessionTimeout(active: boolean) {
  useEffect(() => {
    if (!active) return;

    let start = sessionStorage.getItem(SESSION_KEY);
    if (!start) {
      start = String(Date.now());
      sessionStorage.setItem(SESSION_KEY, start);
    }

    const elapsed = Date.now() - Number(start);
    const remaining = SESSION_TIMEOUT_MS - elapsed;

    if (remaining <= 0) {
      exitOnSessionExpiry();
      return;
    }

    const timer = setTimeout(() => {
      exitOnSessionExpiry();
    }, remaining);

    return () => clearTimeout(timer);
  }, [active]);
}
