import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearSessionTimer } from './useSessionTimeout';
import { buildHomePath } from '../utils/linkParams';

export const HOME_REDIRECT_MS = 3000;

export function useRedirectHome(active: boolean, delay = HOME_REDIRECT_MS) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      clearSessionTimer();
      navigate(buildHomePath(searchParams), { replace: true });
    }, delay);
    return () => clearTimeout(timer);
  }, [active, delay, navigate, searchParams]);
}

export function useGoHome() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  return () => {
    clearSessionTimer();
    navigate(buildHomePath(searchParams), { replace: true });
  };
}
