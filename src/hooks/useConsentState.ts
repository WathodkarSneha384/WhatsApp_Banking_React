import { useState } from 'react';

export function useConsentState() {
  const [dataConsent, setDataConsent] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  return {
    dataConsent,
    marketingConsent,
    setDataConsent,
    setMarketingConsent,
    allAccepted: dataConsent && marketingConsent,
  };
}
