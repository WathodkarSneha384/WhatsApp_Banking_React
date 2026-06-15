import { createContext, useContext, useState, type ReactNode } from 'react';

interface FlowContextValue {
  currentStep: number;
  setCurrentStep: (step: number) => void;
}

const FlowContext = createContext<FlowContextValue>({ currentStep: 1, setCurrentStep: () => {} });

export function FlowProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  return (
    <FlowContext.Provider value={{ currentStep, setCurrentStep }}>
      {children}
    </FlowContext.Provider>
  );
}

export function useFlow() {
  return useContext(FlowContext);
}
