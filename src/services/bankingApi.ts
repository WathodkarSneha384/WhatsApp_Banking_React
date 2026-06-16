import jsSHA from 'jssha';
import type { ServiceType, PMSocialSubservice } from '../types';
import { cachedFetch } from './requestCache';
import { getInsurancePremiumDetails } from '../utils/pmPremium';

const BANK = '068';
const API_BASE = '/dmCmsService/rest/endpoints';
const SECRET_KEY = '35fc015d9308f316bd524c824cce9cd56ea7e455c6fe5b37bf';
const VENDOR = 'MOBILE';
const USERNAME = 'MOBILE';
const PASSWORD = '95700e3a92830ae20ce0bddb23a2c1178f96017d70362572be90e293598c6126';
const CHANNEL = 'WB';

export const DEV_CUSTOMER_ID = 'R00047';
export const DEV_MOBILE_NO = '9908360790';

export interface TokenValidationResponse {
  service: ServiceType;
  customerId: string;
  accountNumber: string;
  customerName: string;
  mobileNo?: string;
}

export interface CustomerProfile {
  customerId: string;
  customerName: string;
  mobileNo: string;
  dateOfBirth?: string;
}

export interface AccountOption {
  label: string;
  value: string;
  fullAccountNumber: string;
  balance: number;
}

export interface RelationOption {
  label: string;
  value: string;
}

export interface PPSParameters {
  minChequeAmount: number;
  maxChequeAmount: number;
}

export interface InsurancePremiumInfo {
  totalPremium: number;
  firstPremium: number;
  nextDebitWindow: string;
  source: 'api' | 'calculated';
}

interface BankApiResponse {
  errorCode?: string;
  errorMsg?: string;
  status?: string;
  message?: string;
  userMsg?: string;
  [key: string]: unknown;
}

const DEFAULT_PPS_PARAMS: PPSParameters = {
  minChequeAmount: 6900,
  maxChequeAmount: 5000000,
};

export const generateChecksum = (...params: string[]): string => {
  const shaObj = new jsSHA('SHA-256', 'TEXT');
  shaObj.update(params.join('#'));
  return shaObj.getHash('HEX');
};

export const generateTimestamp = () => {
  const now = new Date();
  const pad = (num: number, len = 2) => String(num).padStart(len, '0');
  return (
    pad(now.getDate()) +
    pad(now.getMonth() + 1) +
    now.getFullYear() +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds()) +
    pad(now.getMilliseconds(), 3)
  );
};

function maskAccount(accountNo: string): string {
  return accountNo.length > 4
    ? '*'.repeat(accountNo.length - 4) + accountNo.slice(-4)
    : accountNo;
}

function assertSuccess(data: BankApiResponse, fallback = 'Request failed'): void {
  if (data.errorCode === '00' || data.status === '00') return;
  throw new Error(data.errorMsg || data.message || data.userMsg || fallback);
}

async function postEndpoint<T extends BankApiResponse>(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${API_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(data.errorMsg || data.message || `Request failed: ${endpoint}`);
  }
  assertSuccess(data);
  return data;
}

function basePayload(action: string, checkSum: string) {
  return {
    action,
    checkSum,
    passwd: PASSWORD,
    timeStamp: generateTimestamp(),
    uname: USERNAME,
    vendor: VENDOR,
  };
}

export async function validateMobileNo(mobileNumber: string): Promise<CustomerProfile> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'validateMobileNo_MS', USERNAME, PASSWORD, mobileNumber,
  );

  const data = await postEndpoint<BankApiResponse & { cif?: string; customerName?: string; dateOfBirth?: string }>(
    'validateMobileNo_MS',
    { ...basePayload('validateMobileNo_MS', checkSum), timeStamp, mobileNumber },
  );

  return {
    customerId: data.cif || DEV_CUSTOMER_ID,
    customerName: data.customerName || '',
    mobileNo: mobileNumber,
    dateOfBirth: data.dateOfBirth,
  };
}

export async function fetchAccounts(customerId: string): Promise<AccountOption[]> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'getAcctsbalanceModuleWise', USERNAME, PASSWORD, customerId, 'DD',
  );

  const data = await postEndpoint<BankApiResponse & { accountWiseBalances?: Array<Record<string, unknown>> }>(
    'getAcctsbalanceModuleWise',
    {
      ...basePayload('getAcctsbalanceModuleWise', checkSum),
      timeStamp,
      bank: BANK,
      customerID: customerId,
      productType: 'DD',
    },
  );

  if (!Array.isArray(data.accountWiseBalances)) return [];

  return data.accountWiseBalances.map((item) => {
    const accountno = String(item.accountno ?? '');
    const fullAccountNumber = String(item.fullAccountNumber ?? accountno);
    return {
      label: maskAccount(accountno),
      value: fullAccountNumber,
      fullAccountNumber,
      balance: Number(item.accountBal ?? 0),
    };
  });
}

export function getAccounts(customerId = DEV_CUSTOMER_ID): Promise<AccountOption[]> {
  return cachedFetch(`accounts:${customerId}`, () => fetchAccounts(customerId));
}

export function prefetchAccounts(customerId: string) {
  return getAccounts(customerId);
}

export async function fetchPPSParameters(): Promise<PPSParameters> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'loadingpopupaction', USERNAME, PASSWORD, 'PPSPARAMETER',
  );

  const data = await postEndpoint<BankApiResponse & { utilityBeanList?: Array<{ key: string; value: string }> }>(
    'loadingpopupaction',
    {
      ...basePayload('loadingpopupaction', checkSum),
      timeStamp,
      bank: BANK,
      loadingFor: 'PPSPARAMETER',
    },
  );

  if (!Array.isArray(data.utilityBeanList)) return DEFAULT_PPS_PARAMS;

  const params: Record<string, string> = {};
  data.utilityBeanList.forEach((item) => { params[item.key] = item.value; });

  const min = Number(params.MINCHQAMT);
  const max = Number(params.MAXAMTIND);

  return {
    minChequeAmount: Number.isFinite(min) && min > 0 ? min : DEFAULT_PPS_PARAMS.minChequeAmount,
    maxChequeAmount: Number.isFinite(max) && max > 0 ? max : DEFAULT_PPS_PARAMS.maxChequeAmount,
  };
}

export function getPPSParameters(): Promise<PPSParameters> {
  return cachedFetch('pps:parameters', fetchPPSParameters, 10 * 60 * 1000);
}

export function prefetchPPSParameters() {
  return getPPSParameters();
}

export async function fetchRelations(): Promise<RelationOption[]> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'loadingpopupaction', USERNAME, PASSWORD, 'relation',
  );

  const data = await postEndpoint<BankApiResponse & { utilityBeanList?: Array<{ key: string; value: string }> }>(
    'loadingpopupaction',
    {
      ...basePayload('loadingpopupaction', checkSum),
      timeStamp,
      bank: BANK,
      loadingFor: 'relation',
    },
  );

  if (!Array.isArray(data.utilityBeanList)) return [];

  return data.utilityBeanList.map((item) => ({
    label: item.value,
    value: item.key,
  }));
}

export function getRelations(): Promise<RelationOption[]> {
  return cachedFetch('relations', fetchRelations, 30 * 60 * 1000);
}

export async function fetchInsurancePremium(
  scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'>,
): Promise<InsurancePremiumInfo> {
  const calculated = getInsurancePremiumDetails(scheme);

  try {
    const timeStamp = generateTimestamp();
    const checkSum = generateChecksum(
      SECRET_KEY, VENDOR, 'getpreinsamount', USERNAME, PASSWORD, BANK, scheme, scheme,
    );

    const data = await postEndpoint<BankApiResponse & { insurancePremiumAmount?: string }>(
      'getpreinsamount',
      {
        ...basePayload('getpreinsamount', checkSum),
        timeStamp,
        bank: BANK,
        insuranceType: scheme,
        insuranceCoId: scheme,
      },
    );

    const totalPremium = Number(data.insurancePremiumAmount ?? calculated.totalPremium);
    return {
      totalPremium: Number.isFinite(totalPremium) ? totalPremium : calculated.totalPremium,
      firstPremium: calculated.firstPremium,
      nextDebitWindow: calculated.nextDebitWindow,
      source: 'api',
    };
  } catch {
    return { ...calculated, source: 'calculated' };
  }
}

export function getInsurancePremium(
  scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'>,
): Promise<InsurancePremiumInfo> {
  return cachedFetch(`premium:${scheme}`, () => fetchInsurancePremium(scheme), 10 * 60 * 1000);
}

export function prefetchInsurancePremium(scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'>) {
  return getInsurancePremium(scheme);
}

export async function sendOtp(mobileNo: string, otpRequiredFor: 'PPSCREATE' | 'PMYSCHEMEOTP'): Promise<void> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'sendotp', USERNAME, PASSWORD, BANK, mobileNo, otpRequiredFor,
  );

  await postEndpoint(
    'sendotp',
    {
      ...basePayload('sendotp', checkSum),
      timeStamp,
      bank: BANK,
      mobileNo,
      otpRequiredFor,
    },
  );
}

export async function validateOtp(
  mobileNo: string,
  otp: string,
  otpValidateFor: 'PPSCREATE' | 'PMYSCHEMEOTP',
): Promise<void> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'validateotp', USERNAME, PASSWORD, BANK, mobileNo, otp, otpValidateFor,
  );

  await postEndpoint(
    'validateotp',
    {
      ...basePayload('validateotp', checkSum),
      timeStamp,
      bank: BANK,
      mobileNo,
      otp,
      otpValidateFor,
    },
  );
}

export async function createPPSChequeEntry(input: {
  accountNo: string;
  chequeNo: number;
  chequeAmount: number;
  payeeName: string;
  issueDate: string;
  mobileNo: string;
}): Promise<{ success: boolean }> {
  const { accountNo, chequeNo, chequeAmount, payeeName, issueDate, mobileNo } = input;
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'createPPSChequeEntry',
    USERNAME,
    PASSWORD,
    accountNo,
    String(chequeNo),
    String(chequeAmount),
    CHANNEL,
    payeeName,
    issueDate,
    '0',
    mobileNo,
  );

  await postEndpoint(
    'createPPSChequeEntry',
    {
      ...basePayload('createPPSChequeEntry', checkSum),
      timeStamp,
      accountNo,
      chequeNo,
      chequeAmount,
      channel: CHANNEL,
      payeeName,
      issueDate,
      chequeSeries: '0',
      mobileNo,
    },
  );

  return { success: true };
}

export async function doProcessPMJJBYSBY(input: {
  customerId: string;
  debitAccountNumber: string;
  insuranceCompany: 'PMJJBY' | 'PMSBY';
  totalPremiumAmount: number;
  nomineeName: string;
  nomineeRelationCode: string;
  nomineeDob: string;
  guardianName?: string;
  guardianRelationCode?: string;
  nomineeIsMinor?: boolean;
}): Promise<{ referenceNumber: string }> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'doProcessPMJJBYSBY',
    USERNAME,
    PASSWORD,
    BANK,
    input.customerId,
    input.debitAccountNumber,
    input.insuranceCompany,
    String(input.totalPremiumAmount),
    input.nomineeName,
    input.nomineeRelationCode,
    input.nomineeDob,
    input.guardianName ?? '',
    input.guardianRelationCode ?? '',
  );

  const data = await postEndpoint<BankApiResponse & { referenceNumber?: string }>(
    'doProcessPMJJBYSBY',
    {
      ...basePayload('doProcessPMJJBYSBY', checkSum),
      timeStamp,
      bank: BANK,
      customerId: input.customerId,
      debitAccountNumber: input.debitAccountNumber,
      insuranceCompany: input.insuranceCompany,
      totalPremiumAmount: input.totalPremiumAmount,
      nomineeName: input.nomineeName,
      nomineeRelationCode: Number(input.nomineeRelationCode),
      nomineeAddress: '',
      nomineeMobileNo: '',
      nomineeDob: input.nomineeDob,
      nomineeEmail: '',
      nomineeIsMinor: input.nomineeIsMinor ? 'Y' : '',
      guardianName: input.guardianName ?? '',
      guardianMobileNo: '',
      guardianEmail: '',
      guardianDateOfBirth: '',
      guardianRelationCode: input.guardianRelationCode ? Number(input.guardianRelationCode) : '',
      ruralOrUrban: 'R',
    },
  );

  return { referenceNumber: String(data.referenceNumber ?? Date.now().toString().slice(-8)) };
}

export async function validateToken(token: string): Promise<TokenValidationResponse> {
  const response = await fetch(`/api/validate-token?token=${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error('Invalid or expired token');
  return response.json();
}
