import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PMSocialSubservice, ServiceType } from '../types';
import { validateToken, DEV_CUSTOMER_ID, DEV_MOBILE_NO } from '../services/api';

type FlowStatus = 'loading' | 'ready' | 'error' | 'home';

interface UseServiceFlowResult {
  service: ServiceType | null;
  subservice: PMSocialSubservice | null;
  status: FlowStatus;
  error: string | null;
  customerId: string | null;
  mobileNo: string | null;
  customerName: string | null;
}

const VALID_SERVICES: ServiceType[] = ['pps', 'nominee', 'pmsocial', 'openfd'];
const PM_SOCIAL_SUBSERVICES: PMSocialSubservice[] = ['PMJJBY', 'PMSBY', 'PMAPY'];

function isValidService(value: string): value is ServiceType {
  return VALID_SERVICES.includes(value as ServiceType);
}

function isValidSubservice(value: string): value is PMSocialSubservice {
  return PM_SOCIAL_SUBSERVICES.includes(value.toUpperCase() as PMSocialSubservice);
}

function resolveSubservice(
  service: ServiceType,
  subserviceParam: string | null,
): PMSocialSubservice | null {
  if (service !== 'pmsocial') return null;
  if (!subserviceParam || !isValidSubservice(subserviceParam)) return null;
  return subserviceParam.toUpperCase() as PMSocialSubservice;
}

export function useServiceFlow(): UseServiceFlowResult {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<FlowStatus>('loading');
  const [service, setService] = useState<ServiceType | null>(null);
  const [subservice, setSubservice] = useState<PMSocialSubservice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [mobileNo, setMobileNo] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    const subserviceParam = searchParams.get('subservice');
    const tokenParam = searchParams.get('token');
    const urlCustomerId = searchParams.get('customerId');
    const urlMobile = searchParams.get('mobile');

    const applyCustomer = (id?: string, mobile?: string, name?: string) => {
      setCustomerId(id || urlCustomerId || DEV_CUSTOMER_ID);
      setMobileNo(mobile || urlMobile || DEV_MOBILE_NO);
      setCustomerName(name || searchParams.get('customerName') || 'Customer');
    };

    const finishReady = (resolvedService: ServiceType, resolvedSubservice: PMSocialSubservice | null) => {
      if (resolvedService === 'pmsocial' && !resolvedSubservice) {
        setError('Please specify a valid scheme (PMJJBY, PMSBY, or PMAPY) using the subservice parameter.');
        setStatus('error');
        return;
      }
      setService(resolvedService);
      setSubservice(resolvedSubservice);
      setStatus('ready');
    };

    if (tokenParam) {
      validateToken(tokenParam)
        .then((data) => {
          applyCustomer(data.customerId, data.mobileNo, data.customerName);
          finishReady(data.service, resolveSubservice(data.service, subserviceParam));
        })
        .catch(() => {
          setError('Invalid or expired link. Please request a new link from your bank.');
          setStatus('error');
        });
      return;
    }

    if (!serviceParam) {
      setService(null);
      setSubservice(null);
      setCustomerId(null);
      setMobileNo(null);
      setCustomerName(null);
      setStatus('home');
      return;
    }

    applyCustomer();
    const normalized = serviceParam.toLowerCase();

    if (isValidSubservice(normalized)) {
      finishReady('pmsocial', normalized.toUpperCase() as PMSocialSubservice);
      return;
    }

    if (isValidService(normalized)) {
      finishReady(normalized, resolveSubservice(normalized, subserviceParam));
    } else {
      setError(`Unknown service "${serviceParam}". Please use a valid banking service link.`);
      setStatus('error');
    }
  }, [searchParams]);

  return { service, subservice, status, error, customerId, mobileNo, customerName };
}
