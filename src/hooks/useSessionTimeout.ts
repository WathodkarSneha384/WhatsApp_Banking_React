import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { buildHomePath } from '../utils/linkParams';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_KEY = 'wa_banking_session_start';

export function clearSessionTimer() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function useSessionTimeout(active: boolean) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!active) return;

    let start = sessionStorage.getItem(SESSION_KEY);
    if (!start) {
      start = String(Date.now());
      sessionStorage.setItem(SESSION_KEY, start);
    }

    const elapsed = Date.now() - Number(start);
    const remaining = SESSION_TIMEOUT_MS - elapsed;
    const expiredPath = buildHomePath(searchParams, { session: 'expired' });

    if (remaining <= 0) {
      clearSessionTimer();
      navigate(expiredPath, { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      clearSessionTimer();
      navigate(expiredPath, { replace: true });
    }, remaining);

    return () => clearTimeout(timer);
  }, [active, navigate, searchParams]);
}
