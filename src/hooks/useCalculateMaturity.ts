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
    const amount = Number(depositAmount);
    const monthNum = Number(months);
    const dayNum = Number(days);

    if (
      !schemeCode ||
      !depositAmount.trim() ||
      Number.isNaN(amount) ||
      amount < 1000 ||
      (monthNum <= 0 && dayNum <= 0)
    ) {
      setMaturityData(null);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError('');

    calculateMaturity(amount, schemeCode, monthNum, dayNum)
      .then((res) => {
        if (!cancelled) {
          setMaturityData(res);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to calculate maturity',
          );
          setMaturityData(null);
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
