export type DepositType = 'Simple' | 'Compound';
export type RenewalRequired = 'With Interest' | 'Without Interest' | 'Not to Renew';
export type InterestPayModeLabel =
  | 'Monthly'
  | 'Quarterly'
  | 'Half Yearly'
  | 'Yearly'
  | 'On Maturity'
  | 'Reinvest On Maturity';

export const RENEWAL_REQUIRED_OPTIONS: { value: RenewalRequired; label: string }[] = [
  { value: 'With Interest', label: 'With Interest' },
  { value: 'Without Interest', label: 'Without Interest' },
  { value: 'Not to Renew', label: 'Not to Renew' },
];

const SIMPLE_SELECTABLE_MODES: InterestPayModeLabel[] = [
  'Monthly',
  'Quarterly',
  'Half Yearly',
  'Yearly',
  'On Maturity',
];

export function getInterestPayModeOptions(
  depositType: DepositType | '',
  renewalRequired: RenewalRequired | '',
): InterestPayModeLabel[] {
  if (!depositType || !renewalRequired) return [];

  if (depositType === 'Compound') {
    if (renewalRequired === 'With Interest') {
      return ['Reinvest On Maturity'];
    }
    return ['On Maturity'];
  }

  if (renewalRequired === 'With Interest') {
    return ['Reinvest On Maturity'];
  }

  return SIMPLE_SELECTABLE_MODES;
}

export function isInterestPayModeReadonly(
  depositType: DepositType | '',
  renewalRequired: RenewalRequired | '',
): boolean {
  if (!depositType || !renewalRequired) return false;
  if (depositType === 'Compound') return true;
  return renewalRequired === 'With Interest';
}

export function resolveInterestPayMode(
  depositType: DepositType | '',
  renewalRequired: RenewalRequired | '',
  current = '',
): InterestPayModeLabel | '' {
  const options = getInterestPayModeOptions(depositType, renewalRequired);
  if (options.length === 1) return options[0];
  if (current && options.includes(current as InterestPayModeLabel)) {
    return current as InterestPayModeLabel;
  }
  return '';
}

export function toInterestPayModeApiCode(mode: string): string {
  switch (mode) {
    case 'Monthly':
      return 'M';
    case 'Quarterly':
      return 'Q';
    case 'Half Yearly':
      return 'H';
    case 'Yearly':
      return 'Y';
    case 'On Maturity':
    case 'Reinvest On Maturity':
      return 'O';
    default:
      return 'O';
  }
}

export function toRenewalApiCode(renewal: RenewalRequired): 'I' | 'W' | 'N' {
  switch (renewal) {
    case 'With Interest':
      return 'I';
    case 'Without Interest':
      return 'W';
    case 'Not to Renew':
      return 'N';
  }
}

export function toAutoRenewalFlag(renewal: RenewalRequired): 'Y' | 'N' {
  return renewal === 'Not to Renew' ? 'N' : 'Y';
}

export function isPeriodicInterestPayMode(mode: string): boolean {
  return ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'].includes(mode);
}
