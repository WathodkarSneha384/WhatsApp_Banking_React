import type { AccountOption } from '../services/api';

export const INSUFFICIENT_BALANCE_MSG = 'Insufficient balance in selected account';

export function getInsufficientBalanceError(
  account: AccountOption | undefined,
  requiredAmount: number | null | undefined,
): string {
  if (!account || requiredAmount == null || requiredAmount <= 0 || Number.isNaN(requiredAmount)) {
    return '';
  }
  return account.balance < requiredAmount ? INSUFFICIENT_BALANCE_MSG : '';
}
