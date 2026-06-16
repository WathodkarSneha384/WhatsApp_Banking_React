import { useEffect } from 'react';
import type { ServiceType, PMSocialSubservice } from '../types';
import {
  prefetchAccounts,
  prefetchPPSParameters,
  prefetchInsurancePremium,
  DEV_CUSTOMER_ID,
} from '../services/api';

export function usePrefetchServiceData(
  active: boolean,
  service: ServiceType | null,
  subservice: PMSocialSubservice | null,
  customerId: string | null,
) {
  useEffect(() => {
    if (!active || !service || !customerId) return;

    prefetchAccounts(customerId);

    if (service === 'pps') {
      prefetchPPSParameters();
    }

    if (service === 'pmsocial' && (subservice === 'PMJJBY' || subservice === 'PMSBY')) {
      prefetchInsurancePremium(subservice);
    }
  }, [active, service, subservice, customerId]);
}

export function resolveCustomerId(
  tokenCustomerId: string | null | undefined,
  searchCustomerId: string | null,
): string {
  return tokenCustomerId || searchCustomerId || DEV_CUSTOMER_ID;
}
