import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_KEY = 'wa_banking_session_start';

export function clearSessionTimer() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function useSessionTimeout(active: boolean) {
  const navigate = useNavigate();

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
      clearSessionTimer();
      navigate('/?session=expired', { replace: true });
      return;
    }

    const timer = setTimeout(() => {
      clearSessionTimer();
      navigate('/?session=expired', { replace: true });
    }, remaining);

    return () => clearTimeout(timer);
  }, [active, navigate]);
}
