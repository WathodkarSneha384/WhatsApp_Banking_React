import { getAPYPreInsAmount } from '../services/bankingApi';
import type { PMSocialSubservice } from '../types';

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

/** Indicative monthly APY contribution per ₹1,000/month pension (scaled by amount). */
const PMAPY_MONTHLY_CONTRIBUTION_PER_1000 = 42;

export type PmapyInstallmentFrequency = 'Monthly' | 'Quarterly' | 'Half Yearly';

export async function getPmapyInstallmentAmount(
  accountNumber: string,
  pensionAmount: number,
  frequency: PmapyInstallmentFrequency | '',
): Promise<number | null> {
  if (!accountNumber || !pensionAmount || !frequency) {
    return null;
  }

  const frequencyCode =
    frequency === 'Monthly'
      ? 'M'
      : frequency === 'Quarterly'
      ? 'Q'
      : frequency === 'Half Yearly'
      ? 'H'
      : '';

  if (!frequencyCode) {
    return null;
  }

  try {
    const response = await getAPYPreInsAmount({
      Debitaccountnon: accountNumber,
      insuranceType: 'APY',
      pensionamount: pensionAmount.toString(),
      insatllmentFreq: frequencyCode,
    });

    if (response.errorCode === '00') {
      return Number(response.insurancePremiumAmount);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch installment amount', error);
    return null;
  }
}