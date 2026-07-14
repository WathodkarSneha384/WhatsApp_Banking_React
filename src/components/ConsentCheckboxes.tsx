interface ConsentCheckboxesProps {
  idPrefix: string;
  dataConsent: boolean;
  marketingConsent: boolean;
  onDataConsentChange: (checked: boolean) => void;
  onMarketingConsentChange: (checked: boolean) => void;
}

export default function ConsentCheckboxes({
  idPrefix,
  dataConsent,
  marketingConsent,
  onDataConsentChange,
  onMarketingConsentChange,
}: ConsentCheckboxesProps) {
  return (
    <div className="consent-panel">
      <label className="consent-option" htmlFor={`${idPrefix}-data-consent`}>
        <input
          id={`${idPrefix}-data-consent`}
          type="checkbox"
          checked={dataConsent}
          onChange={(e) => onDataConsentChange(e.target.checked)}
        />
        <span>
          I hereby consent to collection and processing of my data for availing 
          relevant services in the manner described in the notice
        </span>
      </label>

      <label className="consent-option" htmlFor={`${idPrefix}-marketing-consent`}>
        <input
          id={`${idPrefix}-marketing-consent`}
          type="checkbox"
          checked={marketingConsent}
          onChange={(e) => onMarketingConsentChange(e.target.checked)}
        />
        <span>
          I hereby consent to processing of my Data for sending me personalized offers on other
          products and services , its affiliates, and partners through Call, SMS,
          WhatsApp, Email or other channels in the manner described in the notice 
        </span>
      </label>
    </div>
  );
}
