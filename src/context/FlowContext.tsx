import { createContext, useContext, useState, type ReactNode } from 'react';
import type { PMSocialSubservice } from '../types';

export interface CustomerSession {
  customerId: string;
  mobileNo: string;
  customerName: string;
}

interface FlowContextValue {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  subservice: PMSocialSubservice | null;
  customer: CustomerSession;
}

const DEFAULT_CUSTOMER: CustomerSession = {
  customerId: '',
  mobileNo: '',
  customerName: '',
};

const FlowContext = createContext<FlowContextValue>({
  currentStep: 1,
  setCurrentStep: () => {},
  subservice: null,
  customer: DEFAULT_CUSTOMER,
});

export function FlowProvider({
  children,
  subservice = null,
  customer = DEFAULT_CUSTOMER,
}: {
  children: ReactNode;
  subservice?: PMSocialSubservice | null;
  customer?: CustomerSession;
}) {
  const [currentStep, setCurrentStep] = useState(1);
  return (
    <FlowContext.Provider value={{ currentStep, setCurrentStep, subservice, customer }}>
      {children}
    </FlowContext.Provider>
  );
}

export function useFlow() {
  return useContext(FlowContext);
}
