import { useNavigate, useSearchParams } from 'react-router-dom';
import ServiceShell from '../../components/ServiceShell';
import type { ServiceType } from '../../types';
import { clearSessionTimer } from '../../hooks/useSessionTimeout';
import { buildServicePath, hasRequiredLinkParams } from '../../utils/linkParams';
import { useFlow } from '../../context/FlowContext';

const SERVICES: { id: ServiceType; icon: string; title: string; desc: string; subservice?: string }[] = [
  {
    id: 'pps',
    icon: '📋',
    title: 'Positive Payment',
    desc: 'Pre-register cheque details or check registration status.',
  },
  {
    id: 'nominee',
    icon: '👤',
    title: 'Nominee Registration',
    desc: 'Add or update a nominee for your savings account.',
  },
  {
    id: 'pmsocial',
    icon: '🏛️',
    title: 'PMJJBY',
    desc: 'Life insurance cover — ₹436 / year.',
    subservice: 'PMJJBY',
  },
  {
    id: 'pmsocial',
    icon: '🏛️',
    title: 'PMSBY',
    desc: 'Accident insurance cover — ₹20 / year.',
    subservice: 'PMSBY',
  },
  {
    id: 'pmsocial',
    icon: '🏛️',
    title: 'PMAPY',
    desc: 'Guaranteed pension for unorganised sector workers.',
    subservice: 'PMAPY',
  },
  {
    id: 'openfd',
    icon: '🏦',
    title: 'Open Fixed Deposit',
    desc: 'Open a fixed deposit and earn assured returns.',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { customer } = useFlow();
  const sessionExpired = searchParams.get('session') === 'expired';
  const hasCustomerLink = hasRequiredLinkParams(searchParams);

  const openService = (path: string) => {
    if (!hasCustomerLink) return;
    clearSessionTimer();
    navigate(path);
  };

  return (
    <ServiceShell
      title="Digital Banking Services"
      description="Select a service below to continue securely."
      breadcrumb="Home"
    >
      {sessionExpired && (
        <div className="alert alert-warning" style={{ marginBottom: 16 }}>
          <span>⏱️</span>
          <span>Your session has expired after 30 minutes. Please select a service again to continue.</span>
        </div>
      )}
      {hasCustomerLink && (
        <div className="info-box" style={{ marginBottom: 16 }}>
          <span className="info-icon">👤</span>
          <span>
            Customer <strong>{customer.customerName || '—'}</strong>
            {' · '}
            ID <strong>{customer.customerId}</strong>
            {' · '}
            Mobile <strong>{customer.mobileNo}</strong>
          </span>
        </div>
      )}
      <div className="home-grid">
        {SERVICES.map(s => (
          <button
            key={`${s.id}-${s.subservice ?? 'main'}`}
            type="button"
            className="home-card"
            disabled={!hasCustomerLink}
            onClick={() => openService(buildServicePath(s.id, searchParams, s.subservice))}
          >
            <span className="home-card-icon">{s.icon}</span>
            <span className="home-card-body">
              <span className="home-card-title">{s.title}</span>
              <span className="home-card-desc">{s.desc}</span>
            </span>
            <span className="home-card-arrow" aria-hidden="true">→</span>
          </button>
        ))}
      </div>
    </ServiceShell>
  );
}
