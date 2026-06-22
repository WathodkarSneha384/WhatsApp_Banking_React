import type { AccountOption } from '../../services/api';
import { getBranchName } from '../../utils/accountDisplay';

interface Props {
  account?: Pick<AccountOption, 'label' | 'branchName' | 'subLabel'> | null;
  className?: string;
}

export default function AccountDisplay({ account, className = '' }: Props) {
  if (!account) return null;

  const branch = getBranchName(account);

  return (
    <span className={`account-display ${className}`.trim()}>
      <span className="account-display-no">{account.label}</span>
      {branch && <span className="account-display-branch">{branch}</span>}
    </span>
  );
}
