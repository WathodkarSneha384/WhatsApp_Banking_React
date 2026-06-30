import { getAPYPreInsAmount, getPmPreInsAmount } from '../services/bankingApi';
import type { PMSocialSubservice } from '../types';

export type PmPreInsScheme = Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY' | 'PMAPY'>;
import { formatInstallmentDisplayDate } from './date';

export interface InsurancePremiumDetails {
  totalPremium: number;
  firstPremium: number;
  nextDebitWindow: string;
}

function formatDDMMYYYY(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function getInsurancePremiumDetails(scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'>): InsurancePremiumDetails {
  const totalPremium = scheme === 'PMJJBY' ? 436 : 20;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let coverageEndYear = today.getFullYear();
  const may31 = new Date(coverageEndYear, 4, 31);
  if (today > may31) coverageEndYear += 1;

  const coverageEnd = new Date(coverageEndYear, 4, 31);
  const daysRemaining = Math.max(1, Math.ceil((coverageEnd.getTime() - today.getTime()) / 86400000));
  const firstPremium = Math.round((totalPremium * daysRemaining) / 365);
  const nextDebitDate = new Date(coverageEndYear + 1, 5, 1);

  return {
    totalPremium,
    firstPremium,
    nextDebitWindow: formatDDMMYYYY(nextDebitDate),
  };
}

export const PENSION_AMOUNT_OPTIONS = [1000, 2000, 3000, 4000, 5000].map(v => ({
  value: String(v),
  label: `₹${v.toLocaleString('en-IN')} / month`,
}));

export type PmapyInstallmentFrequency = 'Monthly' | 'Quarterly' | 'Half Yearly';

export interface PmSchemePremiumFromApi {
  totalPremium: number;
  firstPremium: number;
  nextInstallmentDate?: string;
}

export function parsePmSchemePremiumFromApi(
  data: {
    totalAmount?: string | number;
    insurancePremiumAmount?: string | number;
    siDate?: string;
    siDatedate?: string;
    nextInstallmentDate?: string;
    installmentDate?: string;
    [key: string]: unknown;
  },
  fallback?: { totalPremium: number; firstPremium: number },
): PmSchemePremiumFromApi | null {
  const totalPremium = Number(data.totalAmount);
  const firstPremium = Number(data.insurancePremiumAmount);
  const hasTotal = Number.isFinite(totalPremium);
  const hasInstallment = Number.isFinite(firstPremium);

  if (!hasTotal && !hasInstallment) {
    return fallback ?? null;
  }

  const nextInstallmentDateRaw = [
    data.siDate,
    data.siDatedate,
    data.nextInstallmentDate,
    data.installmentDate,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  const nextInstallmentDate = nextInstallmentDateRaw
    ? formatInstallmentDisplayDate(nextInstallmentDateRaw)
    : undefined;

  return {
    totalPremium: hasTotal ? totalPremium : 0,
    firstPremium: hasInstallment ? firstPremium : totalPremium,
    nextInstallmentDate,
  };
}

function toInstallmentFreqCode(frequency: PmapyInstallmentFrequency | ''): 'M' | 'Q' | 'H' | '' {
  if (frequency === 'Monthly') return 'M';
  if (frequency === 'Quarterly') return 'Q';
  if (frequency === 'Half Yearly') return 'H';
  return '';
}

export async function fetchPmSchemePreInsAmount(
  customerId: string,
  insuranceType: PmPreInsScheme,
  debitAccountNo?: string,
) {
  try {
    return await getPmPreInsAmount({ customerId, insuranceType, debitAccountNo });
  } catch (error) {
    return {
      errorCode: '425',
      status: '02',
      errorMsg: error instanceof Error
        ? error.message
        : 'Failed to fetch premium amount',
    };
  }
}

export async function fetchPmJjbyPreInsAmount(customerId: string) {
  return fetchPmSchemePreInsAmount(customerId, 'PMJJBY');
}

export async function getPmapyInstallmentAmount(
  accountNumber: string,
  pensionAmount: number,
  frequency: PmapyInstallmentFrequency | '',
) {
  if (!accountNumber || !pensionAmount || !frequency) {
    return null;
  }

  const frequencyCode = toInstallmentFreqCode(frequency);
  if (!frequencyCode) {
    return null;
  }

  try {
    return await getAPYPreInsAmount({
      debitAccountNo: accountNumber,
      insuranceType: 'APY',
      pensionamount: pensionAmount.toString(),
      insatllmentFreq: frequencyCode,
    });
  } catch (error) {
    return {
      errorCode: '425',
      status: '02',
      errorMsg: error instanceof Error
        ? error.message
        : 'Failed to fetch installment amount',
    };
  }
}
