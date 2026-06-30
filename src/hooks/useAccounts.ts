import { useEffect, useState } from 'react';
import { getAccounts, type AccountOption } from '../services/api';

export function useAccounts(customerId: string | null, productType = 'DD') {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAccounts(customerId, productType)
      .then((data) => { if (!cancelled) setAccounts(data); })
      .catch((err: Error) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [customerId, productType]);

  return { accounts, loading, error };
}
