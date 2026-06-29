import { useEffect } from 'react';
import type { ServiceType, PMSocialSubservice } from '../types';
import {
  prefetchAccounts,
  prefetchPPSParameters,
  prefetchInsurancePremium,
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

    if (service === 'pmsocial' && subservice === 'PMSBY') {
      prefetchInsurancePremium(subservice);
    }
  }, [active, service, subservice, customerId]);
}
