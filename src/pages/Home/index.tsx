import { useNavigate, useSearchParams } from 'react-router-dom';
import ServiceShell from '../../components/ServiceShell';
import type { ServiceType } from '../../types';
import { clearSessionTimer } from '../../hooks/useSessionTimeout';

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
  const sessionExpired = searchParams.get('session') === 'expired';

  const openService = (path: string) => {
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
      <div className="home-grid">
        {SERVICES.map(s => (
          <button
            key={`${s.id}-${s.subservice ?? 'main'}`}
            type="button"
            className="home-card"
            onClick={() => openService(
              s.subservice
                ? `/?service=${s.id}&subservice=${s.subservice}`
                : `/?service=${s.id}`,
            )}
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
