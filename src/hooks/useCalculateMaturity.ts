import { useEffect, useState } from 'react';
import { calculateMaturity } from '../services/api';
import {
  buildMaturityPreview,
  type MaturityPreview,
} from '../utils/fdMaturity';

export type { MaturityPreview };

export type MaturityValidationField = 'depositAmount' | 'depositPeriod';

export type MaturityValidationError = {
  message: string;
  field: MaturityValidationField | null;
};

function isMaturitySuccess(data: Record<string, unknown>): boolean {
  const errorCode = String(data.errorCode ?? '');
  const status = String(data.status ?? '');
  return errorCode === '00' || status === '00' || data.result === 'success';
}

function getMaturityErrorField(
  errorCode: string,
): MaturityValidationField | null {
  switch (errorCode) {
    case '432':
      return 'depositAmount';
    case '431':
    case '429':
      return 'depositPeriod';
    default:
      return null;
  }
}

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
    return null;
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
  renewalRequired: string,
) {
  const [maturityData, setMaturityData] = useState<MaturityPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [maturityError, setMaturityError] = useState<MaturityValidationError | null>(null);

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
      !renewalRequired ||
      !depositAmount.trim() ||
      Number.isNaN(amount) ||
      amount <= 0 ||
      period <= 0
    ) {
      setMaturityData(null);
      setMaturityError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMaturityError(null);

    calculateMaturity(amount, schemeCode, monthNum, dayNum, interestPayMode)
      .then((res) => {
        if (cancelled) return;

        const data = res as Record<string, unknown>;
        if (!isMaturitySuccess(data)) {
          const errorCode = String(data.errorCode ?? '');
          const message = String(
            data.errorMsg || data.message || 'Unable to calculate maturity amount',
          );
          setMaturityData(null);
          setMaturityError({
            message,
            field: getMaturityErrorField(errorCode),
          });
          return;
        }

        const normalized = normalizeApiMaturity(data, {
          principal: amount,
          period,
          periodType,
          depositType,
          interestPayMode,
        });
        setMaturityData(normalized);
        setMaturityError(
          normalized
            ? null
            : {
                message: 'Unable to calculate maturity amount. Please check your inputs.',
                field: null,
              },
        );
      })
      .catch(() => {
        if (!cancelled) {
          setMaturityData(null);
          setMaturityError({
            message: 'Unable to calculate maturity amount. Please check your connection and try again.',
            field: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    depositAmount,
    schemeCode,
    months,
    days,
    periodType,
    depositType,
    interestPayMode,
    renewalRequired,
  ]);

  return { maturityData, loading, maturityError };
}
