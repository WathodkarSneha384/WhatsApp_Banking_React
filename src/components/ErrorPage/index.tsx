interface ErrorPageProps {
  message?: string;
}

export default function ErrorPage({ message }: ErrorPageProps) {
  return (
    <div className="error-screen">
      <div className="error-icon-wrap">
        <div className="error-icon">⚠️</div>
      </div>
      <h2 className="error-title">Service Unavailable</h2>
      <p className="error-msg">
        {message ?? 'This link is invalid or has expired. Please contact your bank for assistance.'}
      </p>
      <div className="error-hint">
        <span>💬</span>
        <span>Return to WhatsApp and request a new secure banking link from your bank.</span>
      </div>
    </div>
  );
}
