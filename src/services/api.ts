import type { ServiceType } from '../types';

export interface TokenValidationResponse {
  service: ServiceType;
  customerId: string;
  accountNumber: string;
  customerName: string;
}

export async function validateToken(token: string): Promise<TokenValidationResponse> {
  const response = await fetch(`/api/validate-token?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error('Invalid or expired token');
  return response.json();
}

export async function submitOTP(otp: string, reference: string): Promise<{ success: boolean }> {
  const response = await fetch('/api/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ otp, reference }),
  });
  if (!response.ok) throw new Error('OTP verification failed');
  return response.json();
}

export async function submitPPS(data: {
  accountNo: string;
  chequeNo: string;
  chequeAmount: string;
  issueDate: string;
  payeeName: string;
  otp: string;
}): Promise<{ success: boolean; referenceNo: string }> {
  const response = await fetch('/api/pps/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('PPS submission failed');
  return response.json();
}

export async function submitNominee(data: {
  accountNo: string;
  type: 'new' | 'update';
  nomineeName: string;
  nomineeAge: string;
  relation: string;
  otp: string;
}): Promise<{ success: boolean; referenceNo: string }> {
  const response = await fetch('/api/nominee/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Nominee registration failed');
  return response.json();
}

export async function submitPMSocial(data: {
  scheme: 'PMJJBY' | 'PMSBY' | 'PMAPY';
  savingAccount: string;
  nomineeName: string;
  nomineeAge: string;
  relation: string;
  otp: string;
}): Promise<{ success: boolean; referenceNo: string }> {
  const response = await fetch('/api/pm-social/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('PM Social Scheme enrollment failed');
  return response.json();
}

export async function submitOpenFD(data: {
  savingAccount: string;
  depositAmount: string;
  depositType: string;
  interestPayMode: string;
  periodType: string;
  depositPeriod: string;
  autoRenewal: string;
  nominationRequired: string;
  nomineeName?: string;
  nomineeAge?: string;
  relation?: string;
  otp: string;
}): Promise<{ success: boolean; referenceNo: string; fdAccountNo?: string }> {
  const response = await fetch('/api/fd/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('FD opening failed');
  return response.json();
}
