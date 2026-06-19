import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PMSocialSubservice, ServiceType } from '../types';
import { validateToken, validateMobileNo } from '../services/api';
import { getDevCustomerFallback } from '../config/apiConfig';
import {
  extractCustomerFromUrl,
  type CustomerLinkSession,
} from '../utils/linkParams';

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

const MISSING_LINK_ERROR =
  'This link is missing customer details. Please use the WhatsApp link sent by your bank.';

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

function resolveCustomerSession(
  urlSession: CustomerLinkSession | null,
  overrides?: Partial<CustomerLinkSession>,
): CustomerLinkSession | null {
  const devFallback = import.meta.env.DEV ? getDevCustomerFallback() : null;

  const customerId = overrides?.customerId || urlSession?.customerId || devFallback?.customerId;
  const mobileNo = overrides?.mobileNo || urlSession?.mobileNo || devFallback?.mobileNo;

  if (!customerId || !mobileNo) return null;

  return {
    customerId,
    mobileNo,
    customerName:
      overrides?.customerName ??
      urlSession?.customerName ??
      null,
  };
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
    let cancelled = false;

    const serviceParam = searchParams.get('service');
    const subserviceParam = searchParams.get('subservice');
    const tokenParam = searchParams.get('token');
    const urlSession = extractCustomerFromUrl(searchParams);

    const applySession = (session: CustomerLinkSession | null): boolean => {
      if (!session) {
        setError(MISSING_LINK_ERROR);
        setStatus('error');
        return false;
      }

      setCustomerId(session.customerId);
      setMobileNo(session.mobileNo);
      setCustomerName(session.customerName ?? 'Customer');
      return true;
    };

    const enrichCustomerName = async (session: CustomerLinkSession) => {
      if (session.customerName) return;

      try {
        const profile = await validateMobileNo(session.mobileNo);
        if (cancelled) return;

        if (profile.customerName) {
          setCustomerName(profile.customerName);
        }
      } catch {
        // Keep URL-provided customerId/mobile even if profile lookup fails.
      }
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

    const run = async () => {
      if (tokenParam) {
        try {
          const data = await validateToken(tokenParam);
          if (cancelled) return;

          const session = resolveCustomerSession(urlSession, {
            customerId: data.customerId,
            mobileNo: data.mobileNo,
            customerName: data.customerName,
          });

          if (!applySession(session)) return;

          await enrichCustomerName(session!);
          if (cancelled) return;

          finishReady(data.service, resolveSubservice(data.service, subserviceParam));
        } catch {
          if (!cancelled) {
            setError('Invalid or expired link. Please request a new link from your bank.');
            setStatus('error');
          }
        }
        return;
      }

      if (!serviceParam) {
        const session = resolveCustomerSession(urlSession);
        if (!session) {
          applySession(null);
          return;
        }

        setService(null);
        setSubservice(null);
        setCustomerId(session.customerId);
        setMobileNo(session.mobileNo);
        setCustomerName(session.customerName ?? 'Customer');
        setStatus('home');

        void enrichCustomerName(session);
        return;
      }

      const session = resolveCustomerSession(urlSession);
      if (!applySession(session)) return;

      void enrichCustomerName(session!);

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
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return { service, subservice, status, error, customerId, mobileNo, customerName };
}
