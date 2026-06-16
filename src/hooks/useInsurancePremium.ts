import { useEffect, useState } from 'react';
import type { PMSocialSubservice } from '../types';
import { getInsurancePremium, type InsurancePremiumInfo } from '../services/api';

export function useInsurancePremium(scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'> | null) {
  const [premium, setPremium] = useState<InsurancePremiumInfo | null>(null);
  const [loading, setLoading] = useState(Boolean(scheme));

  useEffect(() => {
    if (!scheme) {
      setPremium(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getInsurancePremium(scheme)
      .then((data) => { if (!cancelled) setPremium(data); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [scheme]);

  return { premium, loading };
}
