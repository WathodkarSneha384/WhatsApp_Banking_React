interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabel: string;
}

export default function ProgressBar({ currentStep, totalSteps, stepLabel }: ProgressBarProps) {
  const pct = Math.round((currentStep / totalSteps) * 100);

  return (
    <div className="progress-wrap progress-mobile">
      <div className="progress-label">
        <span><strong>{stepLabel}</strong></span>
        <span className="progress-meta">
          <span className="progress-pct">{pct}%</span>
          <span className="progress-step-count">Step {currentStep} of {totalSteps}</span>
        </span>
      </div>
      <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
