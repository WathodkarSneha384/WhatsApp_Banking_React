const PERIODIC_PAY_MODES = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'];

export function periodToYears(period: number, periodType: 'Days' | 'Months'): number {
  if (periodType === 'Days') return period / 365;
  return period / 12;
}

export function defaultRenewalType(
  interestPayMode: string,
): 'Renew With Interest' | 'Renew Without Interest' {
  if (interestPayMode === 'On Maturity') return 'Renew With Interest';
  if (PERIODIC_PAY_MODES.includes(interestPayMode)) return 'Renew Without Interest';
  return 'Renew Without Interest';
}

export function calculateFdMaturity(input: {
  principal: number;
  rate: number;
  period: number;
  periodType: 'Days' | 'Months';
  depositType: 'Simple' | 'Compound';
  interestPayMode: string;
}): { maturityAmount: number; interestEarned: number } | null {
  const { principal, rate, period, periodType, depositType, interestPayMode } = input;
  if (!principal || !rate || !period || !periodType || !depositType || !interestPayMode) {
    return null;
  }

  const tenureYears = periodToYears(period, periodType);
  if (tenureYears <= 0) return null;

  if (PERIODIC_PAY_MODES.includes(interestPayMode)) {
    const interestEarned =
      depositType === 'Simple'
        ? (principal * rate * tenureYears) / 100
        : principal * (Math.pow(1 + rate / 100, tenureYears) - 1);
    return { maturityAmount: principal, interestEarned };
  }

  if (depositType === 'Simple') {
    const interestEarned = (principal * rate * tenureYears) / 100;
    return { maturityAmount: principal + interestEarned, interestEarned };
  }

  const maturityAmount = principal * Math.pow(1 + rate / 100, tenureYears);
  return { maturityAmount, interestEarned: maturityAmount - principal };
}
