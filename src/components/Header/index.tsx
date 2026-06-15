interface HeaderProps {
  subtitle?: string;
}

export default function Header({ subtitle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-logo" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.37 5.07L2 22l4.93-1.29A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.66 0-3.22-.43-4.58-1.18l-.33-.2-2.92.76.78-2.85-.21-.33A7.96 7.96 0 0 1 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z" />
        </svg>
      </div>
      <div className="header-text">
        <div className="header-title">Digital Banking Services</div>
        {subtitle && <div className="header-subtitle">{subtitle}</div>}
      </div>
      <div className="header-secure">
        <span className="header-secure-icon" aria-hidden="true">🔒</span>
        <span className="header-secure-text">Secure</span>
      </div>
    </header>
  );
}
