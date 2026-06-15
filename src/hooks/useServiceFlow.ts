import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ServiceType } from '../types';
import { validateToken } from '../services/api';

type FlowStatus = 'loading' | 'ready' | 'error' | 'home';

interface UseServiceFlowResult {
  service: ServiceType | null;
  status: FlowStatus;
  error: string | null;
  customerName: string | null;
  accountNumber: string | null;
}

const VALID_SERVICES: ServiceType[] = ['pps', 'nominee', 'pmsocial', 'openfd'];

function isValidService(value: string): value is ServiceType {
  return VALID_SERVICES.includes(value as ServiceType);
}

export function useServiceFlow(): UseServiceFlowResult {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<FlowStatus>('loading');
  const [service, setService] = useState<ServiceType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState<string | null>(null);

  useEffect(() => {
    const serviceParam = searchParams.get('service');
    const tokenParam = searchParams.get('token');

    if (tokenParam) {
      validateToken(tokenParam)
        .then((data) => {
          setService(data.service);
          setCustomerName(data.customerName);
          setAccountNumber(data.accountNumber);
          setStatus('ready');
        })
        .catch(() => {
          setError('Invalid or expired link. Please request a new link from your bank.');
          setStatus('error');
        });
      return;
    }

    if (!serviceParam) {
      setService(null);
      setStatus('home');
      return;
    }

    const normalized = serviceParam.toLowerCase();
    if (isValidService(normalized)) {
      setService(normalized);
      setStatus('ready');
    } else {
      setError(`Unknown service "${serviceParam}". Please use a valid banking service link.`);
      setStatus('error');
    }
  }, [searchParams]);

  return { service, status, error, customerName, accountNumber };
}
