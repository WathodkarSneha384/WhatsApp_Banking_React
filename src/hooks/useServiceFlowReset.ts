import { useSearchParams } from 'react-router-dom';
import { useFlow } from '../context/FlowContext';
import { buildServicePath } from '../utils/linkParams';
import type { ServiceType } from '../types';

/** Navigate back to the service entry URL (remounts the flow). */
export function useServiceFlowReset(service: ServiceType) {
  const [searchParams] = useSearchParams();
  const { subservice } = useFlow();

  return () => {
    window.location.replace(buildServicePath(service, searchParams, subservice ?? undefined));
  };
}
