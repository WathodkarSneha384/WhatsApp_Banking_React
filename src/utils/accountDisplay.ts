export function maskAccountNumber(accountNo: string): string {
  if (!accountNo) return '';
  return accountNo.length > 4
    ? 'X'.repeat(accountNo.length - 4) + accountNo.slice(-4)
    : accountNo;
}

export interface AccountDisplayFields {
  label: string;
  branchName?: string;
  subLabel?: string;
}

export function getBranchName(account: AccountDisplayFields): string {
  return account.branchName || account.subLabel || '';
}
