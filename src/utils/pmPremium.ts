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
