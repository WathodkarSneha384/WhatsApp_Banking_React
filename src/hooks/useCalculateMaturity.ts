import { useEffect, useState } from 'react';
import { calculateMaturity } from '../services/api';

export function useCalculateMaturity(
  depositAmount: string,
  schemeCode: string,
  months: string,
  days: string,
) {
  const [maturityData, setMaturityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!depositAmount || !schemeCode) {
      setMaturityData(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError('');

    calculateMaturity(
      Number(depositAmount),
      schemeCode,
      Number(months),
      Number(days),
    )
      .then((res) => {
        if (!cancelled) {
          setMaturityData(res);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Unable to calculate maturity');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [depositAmount, schemeCode, months, days]);

  return {
    maturityData,
    loading,
    error,
  };
}