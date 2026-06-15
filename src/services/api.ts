import type { ServiceType } from '../types';
import jsSHA from 'jssha';

export interface TokenValidationResponse {
  service: ServiceType;
  customerId: string;
  accountNumber: string;
  customerName: string;
}

const BASE_URL = 'http://10.2.0.121:8182/dmCmsService/rest/endpoints';
const SECRET_KEY = '35fc015d9308f316bd524c824cce9cd56ea7e455c6fe5b37bf';
const VENDOR = 'MOBILE';
const USERNAME = 'MOBILE';
const USERID = 'MOBILE';
const PASSWORD = '95700e3a92830ae20ce0bddb23a2c1178f96017d70362572be90e293598c6126';






// export const generateChecksum = (
//   secretKey: string,
//   vendor: string,
//   actionName: string,
//   userName: string,
//   password: string,
//   userId: string,
//   loadingFor: string
// ): string => {
//   const input =
//     `${secretKey}#${vendor}#${actionName}#${userName}#${password}#${userId}#${loadingFor}`;

//   const shaObj = new jsSHA('SHA-256', 'TEXT');
//   shaObj.update(input);

//   return shaObj.getHash('HEX');
// };

export const generateChecksum = (...params: string[]): string => {
  const input = params.join('#');

  const shaObj = new jsSHA('SHA-256', 'TEXT');
  shaObj.update(input);

  return shaObj.getHash('HEX');
};

// export const generateChecksum1 = (
//   secretKey: string,
//   vendor: string,
//   actionName: string,
//   userName: string,
//   password: string,
  
//   loadingFor: string
// ): string => {
//   const input =
//     `${secretKey}#${vendor}#${actionName}#${userName}#${password}#${loadingFor}`;

//   const shaObj = new jsSHA('SHA-256', 'TEXT');
//   shaObj.update(input);

//   return shaObj.getHash('HEX');
// };



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


// src/services/api.ts

export interface AccountOption {
  label: string;
  value: string;
}

export interface RelationOption {
  label: string;
  value: string;
}

export async function getAccounts(): Promise<AccountOption[]> {

  try {
    const timeStamp = generateTimestamp();
    console.log('Generated Timestamp:', timeStamp);

    const checksum = generateChecksum(
      SECRET_KEY,
      VENDOR,
      'getAcctsbalanceModuleWise',
      USERNAME,
      PASSWORD,
      'R00047','DD'
    );
    console.log('Generated Checksum:', checksum);
    const payload = {
      action: "getAcctsbalanceModuleWise",
      checkSum: checksum,
      passwd: PASSWORD,
      timeStamp: timeStamp,
      uname: USERNAME,
      vendor: VENDOR,
      bank: "068",
      customerID: "R00047",
      productType: "DD"
    };
    const response = await fetch(
      `/dmCmsService/rest/endpoints/getAcctsbalanceModuleWise`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch accounts');
    }

    const data = await response.json();

    if (!Array.isArray(data.accountWiseBalances)) {
      console.error("accountWiseBalances is not an array:", data);
      return [];
    }

    return data.accountWiseBalances.map((item: any) => ({
      label: item.accountno,
      value: item.accountno,
    }));
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }
}

export async function getRelations(): Promise<RelationOption[]> {
  try {
    const timeStamp = generateTimestamp();
    console.log('Generated Timestamp:', timeStamp);

    const checksum = generateChecksum(
      SECRET_KEY,
      VENDOR,
      'loadingpopupaction',
      USERNAME,
      PASSWORD,
      
      'relation'
    );

    console.log('Generated Checksum:', checksum);

    const payload = {
      action: 'loadingpopupaction',
      checkSum: checksum,
      passwd: PASSWORD,
      timeStamp: timeStamp,
      uname: USERNAME,
      vendor: VENDOR,
      bank: '068',
      loadingFor: 'relation',
    };

    const response = await fetch(
      '/dmCmsService/rest/endpoints/loadingpopupaction',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch relations');
    }

    const data = await response.json();

    if (!Array.isArray(data.utilityBeanList)) {
      console.error('utilityBeanList is not an array:', data);
      return [];
    }

    return data.utilityBeanList.map((item: any) => ({
      label: item.value,
      value: item.key,
    }));
  } catch (error) {
    console.error('Error fetching relations:', error);
    return [];
  }
}
