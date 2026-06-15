import type { ReactNode } from 'react';
import { useFlow } from '../../context/FlowContext';

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="stepper">
      {steps.map((label, i) => {
        const n = i + 1;
        const cls = n < current ? 'done' : n === current ? 'active' : '';
        return (
          <div key={label} className={`stp ${cls}`}>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return (
    <div className="actions">
      <div className="in">{children}</div>
    </div>
  );
}

interface ServiceShellProps {
  title: string;
  description: string;
  breadcrumb: string;
  steps?: string[];
  logo?: string;
  bankName?: string;
  children: ReactNode;
}

export default function ServiceShell({
  title,
  description,
  breadcrumb,
  steps,
  logo = 'B',
  bankName = 'Digital Banking',
  children,
}: ServiceShellProps) {
  const { currentStep } = useFlow();

  return (
    <div className="bank-app">
      <div className="appbar">
        <div className="in">
          <div className="logo">{logo}</div>
          <div className="name">{bankName}</div>
          <div className="crumb">{breadcrumb}</div>
        </div>
      </div>

      <div className="shell">
        <div className="page-head">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {steps && <Stepper steps={steps} current={currentStep} />}
        {children}
      </div>
    </div>
  );
}
