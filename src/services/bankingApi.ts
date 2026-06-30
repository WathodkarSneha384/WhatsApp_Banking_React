import jsSHA from 'jssha';
import type { ServiceType, PMSocialSubservice } from '../types';
import { apiConfig } from '../config/apiConfig';
import { cachedFetch, cachedFetch1 } from './requestCache';
import { getInsurancePremiumDetails } from '../utils/pmPremium';
import { estimateFdInterestRate } from '../utils/fdMaturity';
import { maskAccountNumber } from '../utils/accountDisplay';
import { formatInstallmentDisplayDate } from '../utils/date';
import { normalizeMobile } from '../utils/linkParams';

const { apiBase: API_BASE, bank: BANK, secretKey: SECRET_KEY, vendor: VENDOR, username: USERNAME, password: PASSWORD, channel: CHANNEL } = apiConfig;

export interface TokenValidationResponse {
  customerId: string;
  mobileNo: string;
  customerName: string | null;
  service: ServiceType | null;
  subService: string | null;
}

/** SHA-256 of empty string — validatetoken uses no checksum parameters. */
const EMPTY_CHECKSUM = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

export interface CustomerProfile {
  customerId: string;
  customerName: string;
  mobileNo: string;
  dateOfBirth?: string;
}

export interface AccountOption {
  label: string;
  subLabel: string;
  value: string;
  fullAccountNumber: string;
  branchName: string;
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

function assertSuccess(data: BankApiResponse, fallback = 'Request failed'): void {
  if (data.errorCode === '00' || data.status === '00') return;
  throw new Error(data.errorMsg || data.message || data.userMsg || fallback);
}

async function parseApiResponse<T>(response: Response, endpoint: string): Promise<T> {
  const text = await response.text();

  if (!text.trim()) {
    throw new Error(
      response.ok
        ? `Empty response from bank service (${endpoint}).`
        : `Bank service unavailable (${response.status}). Please try again later.`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      response.ok
        ? `Invalid response from bank service (${endpoint}).`
        : `Bank service error (${response.status}). Please contact support if this continues.`,
    );
  }
}

async function postEndpoint<T extends BankApiResponse>(
  endpoint: string,
  payload: Record<string, unknown>,
  validate = true,
): Promise<T> {
  const url = `${API_BASE}/${endpoint}`;

  if (import.meta.env.DEV) {
    console.debug('[API]', url);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await parseApiResponse<T>(response, endpoint);

  console.log('API DATA:', data);

  if (!response.ok) {
    throw new Error(data.errorMsg || data.message || `Request failed: ${endpoint}`);
  }

  if (validate) {
    assertSuccess(data);
  }

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
    customerId: data.cif || '',
    customerName: data.customerName || '',
    mobileNo: mobileNumber,
    dateOfBirth: data.dateOfBirth,
  };
}

export async function fetchAccounts(
  customerId: string,
  productType = 'DD',
): Promise<AccountOption[]> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'getAcctsbalanceModuleWise', USERNAME, PASSWORD, customerId, productType,
  );

  const data = await postEndpoint<BankApiResponse & { accountWiseBalances?: Array<Record<string, unknown>> }>(
    'getAcctsbalanceModuleWise',
    {
      ...basePayload('getAcctsbalanceModuleWise', checkSum),
      timeStamp,
      bank: BANK,
      customerID: customerId,
      productType,
    },
  );

  if (!Array.isArray(data.accountWiseBalances)) return [];

  return data.accountWiseBalances.map((item) => {
    const accountno = String(item.accountno ?? '');
    const fullAccountNumber = String(item.fullAccountNumber ?? accountno);
    const branchName = String(item.branchName ?? '');
    const masked = maskAccountNumber(accountno);
    return {
      label: masked,
      subLabel: branchName,
      value: fullAccountNumber,
      fullAccountNumber,
      branchName,
      balance: Number(item.accountBal ?? 0),
    };
  });
}

export function getAccounts(customerId: string, productType = 'DD'): Promise<AccountOption[]> {
  if (!customerId) return Promise.resolve([]);
  return cachedFetch(
    `accounts:${customerId}:${productType}`,
    () => fetchAccounts(customerId, productType),
  );
}

export function prefetchAccounts(customerId: string, productType = 'DD') {
  return getAccounts(customerId, productType);
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

export async function fetchRelations(
  loadingFor: 'relation' | 'pmyrelation'
): Promise<RelationOption[]> {

  const timeStamp = generateTimestamp();

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'loadingpopupaction',
    USERNAME,
    PASSWORD,
    loadingFor
  );

  const data = await postEndpoint<
    BankApiResponse & {
      utilityBeanList?: Array<{ key: string; value: string }>;
    }
  >(
    'loadingpopupaction',
    {
      ...basePayload('loadingpopupaction', checkSum),
      timeStamp,
      bank: BANK,
      loadingFor, // <-- use parameter here
    }
  );

  if (!Array.isArray(data.utilityBeanList)) return [];

  return data.utilityBeanList.map((item) => ({
    label: item.value,
    value: item.key,
  }));
}

export function getRelations(
  loadingFor: 'relation' | 'pmyrelation' = 'relation'
): Promise<RelationOption[]> {
  return cachedFetch(
    `relations_${loadingFor}`,
    () => fetchRelations(loadingFor),
    30 * 60 * 1000
  );
}

export async function fetchInsurancePremium(
  scheme: Extract<PMSocialSubservice, 'PMJJBY' | 'PMSBY'>,
): Promise<InsurancePremiumInfo> {
  const calculated = getInsurancePremiumDetails(scheme);

  try {
    const timeStamp = generateTimestamp();
    const checkSum = generateChecksum(
      SECRET_KEY, VENDOR, 'getpreinsamount', USERNAME, PASSWORD, scheme,
    );

    const data = await postEndpoint<BankApiResponse & {
      totalAmount?: string | number;
      insurancePremiumAmount?: string | number;
      siDate?: string;
      siDatedate?: string;
    }>(
      'getpreinsamount',
      {
        ...basePayload('getpreinsamount', checkSum),
        timeStamp,
        bank: BANK,
        insuranceType: scheme,
        insuranceCoId: scheme,
      },
    );

    const totalPremium = Number(data.totalAmount ?? calculated.totalPremium);
    const firstPremium = Number(data.insurancePremiumAmount ?? calculated.firstPremium);
    const nextDebitWindowRaw =
      data.siDate?.trim() || data.siDatedate?.trim() || calculated.nextDebitWindow;
    const nextDebitWindow = formatInstallmentDisplayDate(nextDebitWindowRaw);
    return {
      totalPremium: Number.isFinite(totalPremium) ? totalPremium : calculated.totalPremium,
      firstPremium: Number.isFinite(firstPremium) ? firstPremium : calculated.firstPremium,
      nextDebitWindow,
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

export async function fetchFdInterestRate(input: {
  depositType: string;
  periodType: 'Days' | 'Months';
  depositPeriod: number;
}): Promise<number> {
  const fallbackRate = estimateFdInterestRate(input);

  try {
    const timeStamp = generateTimestamp();
    const checkSum = generateChecksum(
      SECRET_KEY,
      VENDOR,
      'getFdInterestRate',
      USERNAME,
      PASSWORD,
      BANK,
      input.depositType,
      input.periodType,
      String(input.depositPeriod),
    );

    const data = await postEndpoint<BankApiResponse & {
      interestRate?: string;
      fdInterestRate?: string;
      utilityBeanList?: Array<{ key: string; value: string }>;
    }>(
      'getFdInterestRate',
      {
        ...basePayload('getFdInterestRate', checkSum),
        timeStamp,
        bank: BANK,
        depositType: input.depositType,
        periodType: input.periodType,
        depositPeriod: String(input.depositPeriod),
      },
    );

    const directRate = Number(data.interestRate ?? data.fdInterestRate);
    if (Number.isFinite(directRate) && directRate > 0) return directRate;

    if (Array.isArray(data.utilityBeanList)) {
      const params: Record<string, string> = {};
      data.utilityBeanList.forEach((item) => { params[item.key] = item.value; });
      const listedRate = Number(params.INTRATE ?? params.RATE ?? params.interestRate);
      if (Number.isFinite(listedRate) && listedRate > 0) return listedRate;
    }
  } catch {
    // Fall back to tenure-based rate until API is confirmed in target environment.
  }

  return fallbackRate;
}

export function getFdInterestRate(input: {
  depositType: string;
  periodType: 'Days' | 'Months';
  depositPeriod: number;
}): Promise<number> {
  return cachedFetch(
    `fd-rate:${input.depositType}:${input.periodType}:${input.depositPeriod}`,
    () => fetchFdInterestRate(input),
    10 * 60 * 1000,
  );
}

export async function sendOtp(mobileNo: string, otpRequiredFor: string): Promise<void> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'sendotp', USERNAME, PASSWORD, mobileNo, BANK,
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
  otpValidateFor: string,
): Promise<void> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY, VENDOR, 'validateotp', USERNAME, PASSWORD, mobileNo, BANK,
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

export interface PPSCreateResponse {
  success: boolean;
  resStatus: string;
  errorCode: string;
  errorMsg: string;
}

export type PpsProcessMode = 'V' | 'P';

export async function createPPSChequeEntry(input: {
  accountNo: string;
  chequeNo: string;
  chequeAmount: string;
  payeeName: string;
  issueDate: string;
  mobileNo: string;
  ppsProcess: PpsProcessMode;
  chequeSeries?: string;
}): Promise<PPSCreateResponse> {
  const {
    accountNo,
    chequeNo,
    chequeAmount,
    payeeName,
    issueDate,
    mobileNo,
    ppsProcess,
    chequeSeries = '0',
  } = input;
  const timeStamp = generateTimestamp();
  console.log('Creating PPS Cheque Entry with:', {
    accountNo,
    chequeNo,
    ppsProcess,
  });
  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'createPPSChequeEntry',
    USERNAME,
    PASSWORD,
    accountNo,
    chequeNo,
  );

  const data = await postEndpoint<BankApiResponse & { resStatus?: string }>(
    'createPPSChequeEntry',
    {
      action: 'createPPSChequeEntry',
      checkSum,
      passwd: PASSWORD,
      timeStamp,
      uname: USERNAME,
      vendor: VENDOR,
      accountNo,
      chequeNo,
      chequeAmount,
      issueDate,
      channel: CHANNEL,
      payeeName,
      chequeSeries,
      mobileNo,
      ppsProcess,
    },
  );

  const resStatus = String(data.resStatus ?? '');
  if (resStatus && resStatus !== 'SUCCESS') {
    throw new Error(data.errorMsg || 'PPS entry failed');
  }

  return {
    success: true,
    resStatus: resStatus || 'SUCCESS',
    errorCode: String(data.errorCode ?? '00'),
    errorMsg: String(data.errorMsg ?? '00'),
  };
}



export async function verifyExistingNominees(input: {
  accountNumber: string;
}): Promise<any> {
  const { accountNumber } = input;

  const timeStamp = generateTimestamp();

  console.log('Verifying Existing Nominees for:', {
    accountNumber,
  });

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'verifyexistingnominees',
    USERNAME,
    PASSWORD,
    accountNumber
  );

  const response = await postEndpoint(
    'verifyexistingnominees',
    {
      ...basePayload('verifyexistingnominees', checkSum),
      timeStamp,
      accountNumber,
    },
  );

  return response;
}

export async function doProcessPMJJBYSBY(input: {
  customerId: string;
  debitAccountNumber: string;
  insuranceCompany: 'PMJJBY' | 'PMSBY';
  totalPremiumAmount: number;
  nomineeName: string;
  nomineeRelationCode: number;
  nomineeDob: string;
  guardianName?: string;
  guardianRelationCode?: number;
  nomineeIsMinor?: boolean;
  ruralOrUrban: 'R' | 'U';
}): Promise<{ referenceNumber: string }> {
  const timeStamp = generateTimestamp();
  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'doProcessPMJJBYSBY',
    USERNAME,
    PASSWORD,
    input.debitAccountNumber,
    input.customerId,
    input.nomineeName,
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
      guardianRelationCode: input.guardianRelationCode ? Number(input.guardianRelationCode) : 0,
      ruralOrUrban: input.ruralOrUrban,
    },
  );

  return { referenceNumber: String(data.referenceNumber ?? Date.now().toString().slice(-8)) };
}

export async function validateToken(jwtToken: string): Promise<TokenValidationResponse> {
  const timeStamp = generateTimestamp();

  const data = await postEndpoint<BankApiResponse & {
    generateJwtToken?: {
      customerId?: string;
      mobile?: string;
      service?: string;
      subService?: string;
      subservice?: string;
    };
    validate?: boolean;
  }>(
    'validatetoken',
    {
      action: 'validatetoken',
      checkSum: EMPTY_CHECKSUM,
      passwd: PASSWORD,
      timeStamp,
      uname: USERNAME,
      vendor: VENDOR,
      jwtToken,
    },
    false,
  );

  const isValid =
    data.validate === true
    || data.errorCode === '00'
    || data.status === '00'
    || data.result === 'success';

  if (!isValid) {
    throw new Error(
      data.errorMsg
      || data.errorCode
      || 'Invalid or expired link. Please request a new link from your bank.',
    );
  }

  const tokenPayload = data.generateJwtToken;
  const customerId = tokenPayload?.customerId?.trim();
  const mobile = tokenPayload?.mobile?.trim();
  const serviceRaw = tokenPayload?.service?.trim().toLowerCase() ?? '';
  const subServiceRaw =
    tokenPayload?.subService?.trim()
    || tokenPayload?.subservice?.trim()
    || null;

  if (!customerId || !mobile) {
    throw new Error('Unable to verify your link. Customer details were not returned.');
  }

  const validServices: ServiceType[] = ['pps', 'nominee', 'pmsocial', 'openfd'];
  const service = validServices.includes(serviceRaw as ServiceType)
    ? (serviceRaw as ServiceType)
    : null;

  return {
    customerId,
    mobileNo: normalizeMobile(mobile),
    customerName: null,
    service,
    subService: subServiceRaw,
  };
}



export async function nomineeRegistration(input: {
  accountNumber: string;
  nomineeName: string;
  nomineeDateOfBirth: string;
  nomineeRelation: string;
  nomineeisMinor: 'Y' | 'N';
  guardianName?: string;
  guardianDateOfBirth?: string;
  relationWithMinor?: string;
}): Promise<any> {
  const {
    accountNumber,
    nomineeName,
    nomineeDateOfBirth,
    nomineeRelation,
    nomineeisMinor,
    guardianName = '',
    guardianDateOfBirth = '',
    relationWithMinor = '',
  } = input;

  const timeStamp = generateTimestamp();

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'nomineeregistration',
    USERNAME,
    PASSWORD,
    accountNumber,
    nomineeName,
  );

  const response = await postEndpoint(
    'nomineeregistration',
    {
      ...basePayload('nomineeregistration', checkSum),
      timeStamp,
      accountNumber,
      nomineeName,
      nomineeDateOfBirth,
      nomineeRelation,
      nomineeisMinor,
      guardianName,
      guardianDateOfBirth,
      relationWithMinor,
    }
  );

  return response;
}



export async function fetchCalculateMaturity(
  depositAmount: number,
  schemeCode: string,
  months: number,
  days: number,
  interestPayMode: string,
) {
  const timeStamp = generateTimestamp();
  const amountStr = `${depositAmount}.0`;

  const checksumParams = [amountStr, schemeCode, String(months)];
  if (days > 0) {
    checksumParams.push(String(days));
  }

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'calculateMaturity_MB',
    USERNAME,
    PASSWORD,
    ...checksumParams,
  );

  const data = await postEndpoint<BankApiResponse & {
    interestRate?: number | string;
    maturityAmount?: number | string;
    interestAmount?: number | string;
  }>(
    'calculateMaturity_MB',
    {
      ...basePayload('calculateMaturity_MB', checkSum),
      timeStamp,
      depositAmount: amountStr,
      schemeCode,
      months,
      days,
      interestPayMode,
    },
    false,
  );

  return data;
}


export function calculateMaturity(
  depositAmount: number,
  schemeCode: string,
  months: number,
  days: number,
  interestPayMode: string,
) {
  console.log('calculateMaturity called');
  return cachedFetch1(

    `maturity:${depositAmount}:${schemeCode}:${months}:${days}`,
    () => fetchCalculateMaturity(
      depositAmount,
      schemeCode,
      months,
      days,
      interestPayMode,
    ),
    5 * 60 * 1000,
  );
}


export async function openFDAccount(input: {
  customerCode: string;
  depositAmount: string;
  months: number;
  days: number;
  debitAccountNumber: string;
  repayAccountNumber: string;
  closeonMaturity: 'Y' | 'N';
  autoRenewal: 'Y' | 'N';
  renewalType: 'I' | 'W' | 'N';
  depositType: string;
  interestPayMode: string;
  nomineeRequired: 'Y' | 'N';
  nomineeAsdebitAccount: 'Y' | 'N';
  nomineeisMinor: 'Y' | 'N';
  nomineeName?: string;
  nomineeDateOfBirth?: string;
  nomineeRelation?: string;

  guardianName?: string;
  guardianDateOfBirth?: string;
  guardianRelation?: string;
}) {
  const timeStamp = generateTimestamp();

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'tdAccountOpening_WB',
    USERNAME,
    PASSWORD,
    input.debitAccountNumber,
    input.repayAccountNumber
  );

  return postEndpoint('tdAccountOpening_WB', {
    ...basePayload('tdAccountOpening_WB', checkSum),
    timeStamp,

    customerCode: input.customerCode,
    depositAmount: input.depositAmount,
    schemeCode: input.depositType === 'S' ? '001' : '002',

    months: input.months,
    days: input.days,

    debitAccountNumber: input.debitAccountNumber,
    repayAccountNumber: input.repayAccountNumber,

    closeonMaturity: input.closeonMaturity,
    autoRenewal: input.renewalType,
    

    depositType: input.depositType,
    interestPayMode: input.interestPayMode,

    nomineeRequired: input.nomineeRequired,
    nomineeAsdebitAccount: input.nomineeAsdebitAccount,
    nomineeisMinor: input.nomineeisMinor,

    nomineeName: input.nomineeName,
    nomineeDateOfBirth: input.nomineeDateOfBirth,
    nomineeRelation: input.nomineeRelation,

    guardianName: input.guardianName,
    guardianDateOfBirth: input.guardianDateOfBirth,
    guardianRelation: input.guardianRelation,
  });
}

export async function doProcessAPYPolicy(input: {
  bank:string;
  insuranceCompany: string;
 customerId: string;
  debitAccountNumber: string;
  pensionAmount: string;
  installmentFreq: string;
  insurancePremiumAmount: number;

  nomineeName: string;
  nomineedob: string;
  nomineeRelCode: string;

  nomineeAdharno?: string;
  spouseName?: string;
  spouseAdharno?: string;

  guardinName?: string;
  reltwithMinor?: Number;
  providentFund?: string;
}): Promise<any> {
  const {
    bank,
    customerId,
    debitAccountNumber,
    insuranceCompany,
    pensionAmount,
    installmentFreq,
    insurancePremiumAmount,
    nomineeName,
    nomineedob,
    nomineeRelCode,
    nomineeAdharno = '',
    spouseName = '',
    spouseAdharno = '',
    guardinName = '',
    reltwithMinor = 0,
    providentFund = '',
  } = input;

  const timeStamp = generateTimestamp();

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'doProcessAPYPolicy',
    USERNAME,
    PASSWORD,
    debitAccountNumber,
    customerId,
    nomineeName,
  );

  const response = await postEndpoint(
    'doProcessAPYPolicy',
    {
      ...basePayload('doProcessAPYPolicy', checkSum),
      timeStamp,
      bank,
      customerId,
      debitAccountNumber,
      insuranceCompany,
      pensionAmount:pensionAmount,
      installmentFreq,
      insurancePremiumAmount: Number(insurancePremiumAmount ?? ''),
      nomineeName,
      nomineedob,
      nomineeRelCode,
      nomineeAdharno,
      spouseName,
      spouseAdharno,
      guardinName,
      reltwithMinor,
      providentFund,
    }
  );

  return response;
}

export async function getAPYPreInsAmount(input: {
  debitAccountNo: string;
  insuranceType: string;
  pensionamount: string;
  insatllmentFreq: 'M' | 'Q' | 'H';
}): Promise<any> {
  const {
    debitAccountNo,
    insuranceType,
    pensionamount,
    insatllmentFreq,
  } = input;

  const timeStamp = generateTimestamp();

  const checkSum = generateChecksum(
    SECRET_KEY,
    VENDOR,
    'getAPYpreinsamount',
    USERNAME,
    PASSWORD,
    insuranceType,
    debitAccountNo,
  );

  return postEndpoint(
    'getAPYpreinsamount',
    {
      ...basePayload('getAPYpreinsamount', checkSum),
      timeStamp,
      debitAccountNo,
      insuranceType,
      pensionAmount: pensionamount,
      insatllmentFreq,
    },
  );
}

export async function getPMJJBYPreInsAmount(input: {
  customerId: string;
  debitAccountNo?: string;
}): Promise<any> {
  const { customerId, debitAccountNo } = input;
  const scheme = 'PMJJBY';
  const timeStamp = generateTimestamp();

  const checkSum = debitAccountNo
    ? generateChecksum(
      SECRET_KEY, VENDOR, 'getpreinsamount', USERNAME, PASSWORD, scheme, debitAccountNo,
    )
    : generateChecksum(
      SECRET_KEY, VENDOR, 'getpreinsamount', USERNAME, PASSWORD, scheme,
    );

  const payload: Record<string, unknown> = {
    ...basePayload('getpreinsamount', checkSum),
    timeStamp,
    bank: BANK,
    customerId,
    insuranceType: scheme,
    insuranceCoId: scheme,
  };

  if (debitAccountNo) payload.debitAccountNo = debitAccountNo;

  return postEndpoint('getpreinsamount', payload, false);
}