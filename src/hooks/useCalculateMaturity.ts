import { useEffect, useState } from 'react';
import { calculateMaturity } from '../services/api';
import {
  buildMaturityPreview,
  type MaturityPreview,
} from '../utils/fdMaturity';

export type { MaturityPreview };

function normalizeApiMaturity(
  data: Record<string, unknown>,
  input: {
    principal: number;
    period: number;
    periodType: 'Days' | 'Months';
    depositType: 'Simple' | 'Compound';
    interestPayMode: string;
  },
): MaturityPreview | null {
  const maturityAmount = Number(data.maturityAmount ?? data.MATURITYAMT);
  const interestAmount = Number(data.interestAmount ?? data.INTERESTAMT);
  const interestRate = Number(data.interestRate ?? data.INTRATE);

  if (!Number.isFinite(maturityAmount) || maturityAmount <= 0) {
    return buildMaturityPreview({
      ...input,
      rate: Number.isFinite(interestRate) && interestRate > 0 ? interestRate : undefined,
      maturityDateRaw: data.maturityDate ?? data.maturitydate,
    });
  }

  const rate = Number.isFinite(interestRate) && interestRate > 0
    ? interestRate
    : (buildMaturityPreview(input)?.interestRate ?? 0);

  return {
    interestRate: rate,
    maturityAmount,
    interestAmount: Number.isFinite(interestAmount)
      ? interestAmount
      : Math.max(0, maturityAmount - input.principal),
    maturityDate: buildMaturityPreview({
      ...input,
      rate,
      maturityDateRaw: data.maturityDate ?? data.maturitydate,
    })!.maturityDate,
    isEstimate: false,
  };
}

export function useCalculateMaturity(
  depositAmount: string,
  schemeCode: string,
  months: string,
  days: string,
  periodType: 'Days' | 'Months' | '',
  depositType: 'Simple' | 'Compound' | '',
  interestPayMode: string,
) {
  const [maturityData, setMaturityData] = useState<MaturityPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const amount = Number(depositAmount);
    const monthNum = Number(months);
    const dayNum = Number(days);
    const period = periodType === 'Days' ? dayNum : monthNum;

    if (
      !schemeCode ||
      !periodType ||
      !depositType ||
      !interestPayMode ||
      !depositAmount.trim() ||
      Number.isNaN(amount) ||
      amount < 1000 ||
      period <= 0
    ) {
      setMaturityData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const localPreview = buildMaturityPreview({
      principal: amount,
      period,
      periodType,
      depositType,
      interestPayMode,
    });

    calculateMaturity(amount, schemeCode, monthNum, dayNum,interestPayMode)
      .then((res) => {
        if (cancelled) return;
        const normalized = normalizeApiMaturity(res as Record<string, unknown>, {
          principal: amount,
          period,
          periodType,
          depositType,
          interestPayMode,
        });
        setMaturityData(normalized ?? localPreview);
      })
      .catch(() => {
        if (!cancelled) {
          setMaturityData(localPreview);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [depositAmount, schemeCode, months, days, periodType, depositType, interestPayMode]);

  return { maturityData, loading };
}
