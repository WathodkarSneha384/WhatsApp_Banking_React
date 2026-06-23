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

export function getPmapyInstallmentAmount(
  pensionAmount: number,
  frequency: PmapyInstallmentFrequency | '',
): number | null {
  if (!pensionAmount || !frequency) return null;

  const monthly = Math.round((pensionAmount / 1000) * PMAPY_MONTHLY_CONTRIBUTION_PER_1000);
  switch (frequency) {
    case 'Monthly':
      return monthly;
    case 'Quarterly':
      return monthly * 3;
    case 'Half Yearly':
      return monthly * 6;
    default:
      return null;
  }
}
