import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const HOME_REDIRECT_MS = 3000;

export function useRedirectHome(active: boolean, delay = HOME_REDIRECT_MS) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => navigate('/', { replace: true }), delay);
    return () => clearTimeout(timer);
  }, [active, delay, navigate]);
}

export function useGoHome() {
  const navigate = useNavigate();
  return () => navigate('/', { replace: true });
}
