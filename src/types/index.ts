export type ServiceType = 'pps' | 'nominee' | 'pmsocial' | 'openfd';

export interface ServiceConfig {
  label: string;
  component: React.ComponentType;
  steps: string[];
}

export interface FlowState {
  currentStep: number;
  totalSteps: number;
  serviceName: string;
}

export interface NomineeData {
  name: string;
  age: string;
  relation: string;
}

export const RELATIONS = [
  'Spouse',
  'Son',
  'Daughter',
  'Father',
  'Mother',
  'Brother',
  'Sister',
  'Grandson',
  'Granddaughter',
  'Other',
];

export const SAVING_ACCOUNTS = [
  { label: 'SB ****1234', value: 'SB1234' },
  { label: 'SB ****5678', value: 'SB5678' },
  { label: 'SB ****9012', value: 'SB9012' },
];
