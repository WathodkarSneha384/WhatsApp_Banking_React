import type { ReactNode } from 'react';
import { Actions } from '../ServiceShell';

interface ServiceResultScreenProps {
  variant: 'success' | 'error';
  icon?: string;
  title: string;
  message: string;
  refNo?: string;
  refLabel?: string;
  onCancel: () => void;
  cancelLabel?: string;
  children?: ReactNode;
}

export default function ServiceResultScreen({
  variant,
  icon,
  title,
  message,
  refNo,
  refLabel = 'Reference Number',
  onCancel,
  cancelLabel = 'Cancel',
  children,
}: ServiceResultScreenProps) {
  const defaultIcon = variant === 'success' ? '✅' : '⚠️';

  return (
    <>
      <div className="flow-content">
        <div className={`success-screen ${variant === 'error' ? 'result-error' : ''}`}>
          <div className="success-icon">{icon ?? defaultIcon}</div>
          <h2 className="success-title">{title}</h2>
          <p className="success-msg">{message}</p>
          {refNo && (
            <div className="ref-box">
              <div className="ref-label">{refLabel}</div>
              <div className="ref-value">{refNo}</div>
            </div>
          )}
          {children}
        </div>
      </div>
      <Actions>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
      </Actions>
    </>
  );
}
