import { useNavigate } from 'react-router-dom';
import ServiceShell from '../../components/ServiceShell';
import type { ServiceType } from '../../types';

const SERVICES: { id: ServiceType; icon: string; title: string; desc: string }[] = [
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
    title: 'PM Social Schemes',
    desc: 'Enroll in government insurance and pension schemes.',
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

  return (
    <ServiceShell
      title="Digital Banking Services"
      description="Select a service below to continue securely."
      breadcrumb="Home"
    >
      <div className="home-grid">
        {SERVICES.map(s => (
          <button
            key={s.id}
            type="button"
            className="home-card"
            onClick={() => navigate(`/?service=${s.id}`)}
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
