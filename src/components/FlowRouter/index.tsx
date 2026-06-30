import type { ComponentType } from 'react';
import { lazy, Suspense } from 'react';
import type { ServiceType } from '../../types';
import { useServiceFlow } from '../../hooks/useServiceFlow';
import { useSessionTimeout } from '../../hooks/useSessionTimeout';
import { usePrefetchServiceData } from '../../hooks/usePrefetchServiceData';
import { FlowProvider } from '../../context/FlowContext';
import ServiceShell from '../ServiceShell';
import ErrorPage from '../ErrorPage';
import Home from '../../pages/Home';

const PPS      = lazy(() => import('../../pages/PPS'));
const Nominee  = lazy(() => import('../../pages/Nominee'));
const PMSocial = lazy(() => import('../../pages/PMSocial'));
const OpenFD   = lazy(() => import('../../pages/OpenFD'));

interface ServiceConfig {
  component: ComponentType;
  label: string;
  title: string;
  subtitle: string;
  steps: string[];
  icon: string;
  desc: string;
  dynamicSteps?: boolean;
}

const serviceRoutes: Record<ServiceType, ServiceConfig> = {
  pps: {
    component: PPS,
    label: 'Positive Payment',
    title: 'Positive Payment System',
    subtitle: 'Positive Payment System',
    steps: ['Select Service', 'Enter Details', 'Review', 'Verify OTP', 'Done'],
    icon: '📋',
    desc: 'Pre-register cheque details to protect against cheque fraud, or check the status of a registered cheque.',
    dynamicSteps: true,
  },
  nominee: {
    component: Nominee,
    label: 'Nominee Registration',
    title: 'Nominee Registration',
    subtitle: 'Nominee Registration',
    steps: ['Nominee Details', 'Review', 'Verify OTP', 'Submit', 'Done'],
    icon: '👤',
    desc: 'Add or update a nominee for your savings account so benefits reach the right person.',
  },
  pmsocial: {
    component: PMSocial,
    label: 'PM Social Schemes',
    title: 'PM Social Scheme Enrollment',
    subtitle: 'PM Social Scheme Enrollment',
    steps: ['Fill Details', 'Review', 'Verify OTP', 'Submit', 'Done'],
    icon: '🏛️',
    desc: 'Enroll in government insurance and pension schemes at very low premiums.',
  },
  openfd: {
    component: OpenFD,
    label: 'Open Fixed Deposit',
    title: 'Open Fixed Deposit',
    subtitle: 'Open Fixed Deposit',
    steps: ['FD Details', 'Review', 'Verify OTP', 'Submit', 'Done'],
    icon: '🏦',
    desc: 'Open a fixed deposit and earn assured returns on your savings.',
  },
};

function LoadingView() {
  return (
    <div className="bank-app">
      <div className="appbar">
        <div className="in">
          <div className="logo">B</div>
          <div className="name">Digital Banking</div>
        </div>
      </div>
      <div className="shell">
        <div className="loading-screen">
          <div className="spinner" />
          <p className="loading-text">Loading your service…</p>
        </div>
      </div>
    </div>
  );
}

export default function FlowRouter() {
  const { service, subservice, serviceSubMode, status, error, customerId, mobileNo, customerName } = useServiceFlow();
  useSessionTimeout(status === 'ready');
  usePrefetchServiceData(status === 'ready', service, subservice, customerId);

  if (status === 'loading') return <LoadingView />;

  if (status === 'home') {
    return (
      <FlowProvider
        customer={{
          customerId: customerId ?? '',
          mobileNo: mobileNo ?? '',
          customerName: customerName ?? '',
        }}
        serviceSubMode={serviceSubMode}
      >
        <Home />
      </FlowProvider>
    );
  }

  if (status === 'error' || !service) {
    return (
      <div className="bank-app">
        <div className="appbar">
          <div className="in">
            <div className="logo">B</div>
            <div className="name">Digital Banking</div>
          </div>
        </div>
        <div className="shell">
          <ErrorPage message={error ?? undefined} />
        </div>
      </div>
    );
  }

  const config = serviceRoutes[service];
  const FlowComponent = config.component;

  return (
    <FlowProvider
      subservice={subservice}
      serviceSubMode={serviceSubMode}
      customer={{
        customerId: customerId ?? '',
        mobileNo: mobileNo ?? '',
        customerName: customerName ?? '',
      }}
    >
      <ServiceShell
        title={config.title}
        description={config.desc}
        breadcrumb={`Services / ${config.label}`}
        steps={config.dynamicSteps ? undefined : config.steps}
      >
        <Suspense fallback={
          <div className="loading-screen">
            <div className="spinner" />
            <p className="loading-text">Loading…</p>
          </div>
        }>
          <FlowComponent />
        </Suspense>
      </ServiceShell>
    </FlowProvider>
  );
}
