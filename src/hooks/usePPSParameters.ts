import { useEffect, useState } from 'react';
import { getPPSParameters, type PPSParameters } from '../services/api';

export function usePPSParameters() {
  const [params, setParams] = useState<PPSParameters | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPPSParameters()
      .then((data) => { if (!cancelled) setParams(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { params, loading };
}
