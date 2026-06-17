import { useEffect, useState } from 'react';
import { getFdInterestRate } from '../services/api';

export function useFdInterestRate(
  depositType: string,
  periodType: string,
  depositPeriod: string,
) {
  const [interestRate, setInterestRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const period = Number(depositPeriod);
    if (!depositType || !periodType || !depositPeriod.trim() || Number.isNaN(period) || period < 1) {
      setInterestRate(null);
      setError('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    getFdInterestRate({
      depositType,
      periodType: periodType as 'Days' | 'Months',
      depositPeriod: period,
    })
      .then((rate) => {
        if (!cancelled) setInterestRate(rate);
      })
      .catch(() => {
        if (!cancelled) {
          setInterestRate(null);
          setError('Unable to fetch interest rate');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [depositType, periodType, depositPeriod]);

  return { interestRate, loading, error };
}
