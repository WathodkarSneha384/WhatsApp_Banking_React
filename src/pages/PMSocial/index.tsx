import { useState, useEffect } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import NomineeFields, {
  type NomineeFieldValues,
  type NomineeFieldErrors,
  validateNomineeFields,
  calcAge,
} from '../../components/NomineeFields';
import { useFlow } from '../../context/FlowContext';
import { useAccounts } from '../../hooks/useAccounts';
import { useRelations } from '../../hooks/useRelations';
import ServiceResultScreen from '../../components/ServiceResultScreen';
import { useServiceFlowReset } from '../../hooks/useServiceFlowReset';
import { useInsurancePremium } from '../../hooks/useInsurancePremium';
import type { PMSocialSubservice } from '../../types';
import { doProcessAPYPolicy, doProcessPMJJBYSBY, sendOtp, validateOtp } from '../../services/api';
import AccountDisplay from '../../components/AccountDisplay';
import { formatDDMMYYYY } from '../../utils/date';
import {
  PENSION_AMOUNT_OPTIONS,
  getPmapyInstallmentAmount,
  type PmapyInstallmentFrequency,
} from '../../utils/pmPremium';
import { relationLabel } from '../../utils/relationLabel';

type RuralOrUrban = 'Rural' | 'Urban';
type Step = 'form' | 'confirm' | 'otp' | 'result';
const STEP_NUM: Record<Step, number> = { form: 1, confirm: 2, otp: 3, result: 4 };

interface OperationResult {
  status: 'success' | 'error';
  title: string;
  message: string;
  refNo?: string;
}

const SCHEME_INFO: Record<PMSocialSubservice, { name: string; desc: string; premium: string; coverage: string; color: string }> = {
  PMJJBY: {
    name: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
    desc: 'Life insurance cover for death due to any cause',
    premium: '₹436 / year',
    coverage: '₹2,00,000',
    color: 'var(--primary)',
  },
  PMSBY: {
    name: 'Pradhan Mantri Suraksha Bima Yojana',
    desc: 'Accidental death & disability insurance cover',
    premium: '₹20 / year',
    coverage: '₹2,00,000',
    color: 'var(--success)',
  },
  PMAPY: {
    name: 'Pradhan Mantri Atal Pension Yojana',
    desc: 'Guaranteed pension for unorganised sector workers',
    premium: 'Based on pension',
    coverage: '₹1,000 – ₹5,000/month',
    color: '#e65100',
  },
};

const INSTALLMENT_FREQ = ['Monthly', 'Quarterly', 'Half Yearly'];


const EMPTY_NOMINEE: NomineeFieldValues = {
  nomineeName: '', nomineeDob: '', relation: '',
  guardianName: '', guardianDob: '', guardianRelation: '',
};

export default function PMSocial() {
  const { subservice, setCurrentStep, customer } = useFlow();
  const [step, setStep] = useState<Step>('form');
  const [savingAccount, setSavingAccount] = useState('');
  const [pensionAmount, setPensionAmount] = useState('');
  const [installmentFreq, setInstallmentFreq] = useState('');
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [ruralOrUrban, setRuralOrUrban] = useState<RuralOrUrban>('Urban');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const resetToServiceHome = useServiceFlowReset('pmsocial');

  const insuranceScheme = subservice === 'PMJJBY' || subservice === 'PMSBY' ? subservice : null;
  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const { premium: premiumDetails, loading: premiumLoading } = useInsurancePremium(insuranceScheme);
  const { relations } = useRelations('pmyrelation');
  const [installmentAmount, setInstallmentAmount] = useState<number | null>(null);

  useEffect(() => {
    const fetchInstallmentAmount = async () => {
      if (!savingAccount || !pensionAmount || !installmentFreq) {
        setInstallmentAmount(null);
        return;
      }

      const amount = await getPmapyInstallmentAmount(
        savingAccount,
        Number(pensionAmount),
        installmentFreq as PmapyInstallmentFrequency,
      );

      setInstallmentAmount(amount);
    };

    fetchInstallmentAmount();
  }, [savingAccount, pensionAmount, installmentFreq]);

  useEffect(() => { setCurrentStep(STEP_NUM[step]); }, [step, setCurrentStep]);

  if (!subservice) return null;
  const scheme = subservice;

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!savingAccount) e.savingAccount = 'Please select a debit account';
    if (scheme === 'PMAPY') {
      if (!pensionAmount) e.pensionAmount = 'Please select pension amount';
      if (!installmentFreq) e.installmentFreq = 'Please select installment frequency';
    }
    if ((scheme === 'PMJJBY' || scheme === 'PMSBY') && !ruralOrUrban) {
      e.ruralOrUrban = 'Please select Rural or Urban';
    }
    setFormErrors(e);
    if (Object.keys(e).length > 0) return false;

    const ne = validateNomineeFields(nominee);
    setNomineeErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const acc = accounts.find(a => a.value === savingAccount);
  const nomineeIsMinor = nominee.nomineeDob ? (calcAge(nominee.nomineeDob) ?? 18) < 18 : false;

  const nomineeReviewRows = (
    <>
      <div className="summary-row"><span className="summary-key">Nominee Name</span><span className="summary-val">{nominee.nomineeName}</span></div>
      <div className="summary-row"><span className="summary-key">Nominee DOB</span><span className="summary-val">{new Date(nominee.nomineeDob).toLocaleDateString('en-IN')}</span></div>
      <div className="summary-row"><span className="summary-key">Relationship</span><span className="summary-val">{relationLabel(relations, nominee.relation)}</span></div>
      {nomineeIsMinor && (
        <>
          <div className="divider" />
          <div className="section-heading">Guardian Details</div>
          <div className="summary-row"><span className="summary-key">Guardian Name</span><span className="summary-val">{nominee.guardianName}</span></div>
          <div className="summary-row"><span className="summary-key">Guardian DOB</span><span className="summary-val">{formatDDMMYYYY(nominee.guardianDob)}</span></div>
          <div className="summary-row"><span className="summary-key">Guardian Relation</span><span className="summary-val">{relationLabel(relations, nominee.guardianRelation)}</span></div>
        </>
      )}
    </>
  );

  const sendOtpAndProceed = async () => {
    setLoading(true);
    setApiError('');
    try {
      await sendOtp(customer.mobileNo, 'PMYSCHEMEOTP');
      setStep('otp');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setApiError('');
    setResendMsg('');
    try {
      await sendOtp(customer.mobileNo, 'PMYSCHEMEOTP');
      setResendMsg('A new OTP has been sent ✓');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to resend OTP');
    }
  };

  const enroll = async () => {
    if (scheme === 'PMAPY') {
      const result = await doProcessAPYPolicy({
        bank: '068',
        customerId: customer.customerId,
        debitAccountNumber: savingAccount,
        insuranceCompany: 'APY',
        pensionAmount: pensionAmount,
        installmentFreq:
          installmentFreq === 'Monthly'
            ? 'M'
            : installmentFreq === 'Quarterly'
            ? 'Q'
            : 'H',
        installmentAmt: String(installmentAmount ?? ''),
        nomineeName: nominee.nomineeName,
        nomineedob: nominee.nomineeDob,
        nomineeRelCode: nominee.relation,
        nomineeAdharno: '',
        spouseName: '',
        spouseAdharno: '',
        guardinName: nomineeIsMinor ? nominee.guardianName : '',
        reltwithMinor: nomineeIsMinor ? nominee.guardianRelation : '',
        providentFund: '',
      });
      return result.prannumber as string;
    }

    const result = await doProcessPMJJBYSBY({
      customerId: customer.customerId,
      debitAccountNumber: savingAccount,
      insuranceCompany: scheme,
      totalPremiumAmount: premiumDetails?.totalPremium ?? 0,
      nomineeName: nominee.nomineeName,
      nomineeRelationCode: Number(nominee.relation),
      nomineeDob: nominee.nomineeDob,
      guardianName: nomineeIsMinor ? nominee.guardianName : '',
      guardianRelationCode: nomineeIsMinor ? Number(nominee.guardianRelation) : 0,
      nomineeIsMinor,
      ruralOrUrban: ruralOrUrban === 'Urban' ? 'U' : 'R',
    });
    return result.referenceNumber;
  };

  const handleOtpComplete = async (otp: string) => {
    setApiError('');

    // Step 1 — validate OTP. On failure stay on the OTP screen so the user can re-enter.
    try {
      await validateOtp(customer.mobileNo, otp, 'PMYSCHEMEOTP');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'OTP verification failed');
      throw err;
    }

    // Step 2 — process enrollment. Failures here move to the result screen.
    setLoading(true);
    try {
      const refNo = await enroll();
      setOperationResult({
        status: 'success',
        title: 'Enrollment Successful!',
        message: `You've been enrolled in ${scheme}. The premium will be auto-debited from ${acc?.label ?? 'your account'}${acc?.branchName ? ` (${acc.branchName})` : ''} as per schedule.`,
        refNo,
      });
      setStep('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Enrollment failed';
      setApiError(message);
      setOperationResult({
        status: 'error',
        title: 'Enrollment Failed',
        message,
      });
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const annualPremiumLabel = (scheme === 'PMJJBY' || scheme === 'PMSBY') && premiumDetails
    ? `₹${premiumDetails.totalPremium.toLocaleString('en-IN')} / year`
    : SCHEME_INFO[scheme].premium;

  if (step === 'result' && operationResult) {
    return (
      <ServiceResultScreen
        variant={operationResult.status}
        title={operationResult.title}
        message={operationResult.message}
        refNo={operationResult.refNo}
        onCancel={resetToServiceHome}
      />
    );
  }

  /* ── ENROLLMENT DETAILS FORM ── */
  if (step === 'form') return (
    <>
      <div className="flow-content">
        <div className="card">
          <div className="card-title">
            <span className="card-icon">✏️</span>Enrollment Details
            <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Debit Account <span className="required">*</span></label>
            <Select
              id="fd-savingAccount"
              className={formErrors.savingAccount ? 'is-error' : ''}
              value={savingAccount}
              placeholder="Select account"
              options={accounts}
              onChange={v => setSavingAccount(v)}
            />
            {accountsLoading && <p className="form-hint">Loading accounts…</p>}
            {formErrors.savingAccount && <p className="form-error">⚠ {formErrors.savingAccount}</p>}
          </div>

          {scheme === 'PMAPY' && (
            <>
              <div className="form-group">
                <label className="form-label">Pension Amount <span className="required">*</span></label>
                <Select
                  className={formErrors.pensionAmount ? 'is-error' : ''}
                  value={pensionAmount}
                  placeholder="Select pension amount"
                  options={PENSION_AMOUNT_OPTIONS}
                  onChange={v => { setPensionAmount(v); setFormErrors(f => ({ ...f, pensionAmount: '' })); }}
                />
                {formErrors.pensionAmount && <p className="form-error">⚠ {formErrors.pensionAmount}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Installment Frequency <span className="required">*</span></label>
                <Select
                  className={formErrors.installmentFreq ? 'is-error' : ''}
                  value={installmentFreq}
                  placeholder="Select frequency"
                  options={INSTALLMENT_FREQ.map(f => ({ value: f, label: f }))}
                  onChange={v => { setInstallmentFreq(v); setFormErrors(f => ({ ...f, installmentFreq: '' })); }}
                />
                {formErrors.installmentFreq && <p className="form-error">⚠ {formErrors.installmentFreq}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Installment Amount</label>
                <input
                  type="text"
                  className="form-input"
                  readOnly
                  value={installmentAmount != null ? `₹${installmentAmount}` : ''}
                  placeholder="Select pension amount and frequency"
                />
              </div>
            </>
          )}

          <div className="divider" />

          <div className="section-heading">Nominee Details</div>
          <NomineeFields
            values={nominee}
            errors={nomineeErrors}
            onChange={setNomineeField}
            relationType="pmyrelation"
          />

          {(scheme === 'PMJJBY' || scheme === 'PMSBY') && (
            <div className="form-group">
              <label className="form-label">Area Type <span className="required">*</span></label>
              <div className="radio-group horizontal area-type-options">
                {(['Rural', 'Urban'] as const).map(option => (
                  <label key={option} className={`radio-option ${ruralOrUrban === option ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="ruralOrUrban"
                      checked={ruralOrUrban === option}
                      onChange={() => {
                        setRuralOrUrban(option);
                        setFormErrors(f => ({ ...f, ruralOrUrban: '' }));
                      }}
                    />
                    <span className="radio-label">{option}</span>
                  </label>
                ))}
              </div>
              {formErrors.ruralOrUrban && <p className="form-error">⚠ {formErrors.ruralOrUrban}</p>}
            </div>
          )}
        </div>
      </div>
      <Actions>
        <button className="btn btn-primary" onClick={() => { if (validateForm()) setStep('confirm'); }}>
          Review →
        </button>
      </Actions>
    </>
  );

  /* ── CONFIRM ── */
  if (step === 'confirm') return (
    <>
      <div className="flow-content">
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Premium will be auto-debited annually from your savings account on enrollment date.</span>
        </div>
        {apiError && <div className="alert alert-warning"><span>⚠️</span><span>{apiError}</span></div>}
        <div className="card">
          <div className="card-title">
            <span className="card-icon">✅</span>Review Enrollment
            <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>
          </div>
          <div className="summary-row"><span className="summary-key">Scheme</span><span className="summary-val">{SCHEME_INFO[scheme].name}</span></div>
          <div className="summary-row"><span className="summary-key">Debit Account</span><span className="summary-val"><AccountDisplay account={acc} /></span></div>
          <div className="summary-row"><span className="summary-key">Annual Premium</span><span className="summary-val">{annualPremiumLabel}</span></div>
          {premiumLoading && (scheme === 'PMJJBY' || scheme === 'PMSBY') && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading premium details…</p>
          )}
          {premiumDetails && (scheme === 'PMJJBY' || scheme === 'PMSBY') && (
            <>
              <div className="summary-row">
                <span className="summary-key">First Premium Amount (Pro Rata)</span>
                <span className="summary-val">₹{premiumDetails.firstPremium.toLocaleString('en-IN')}</span>
              </div>
              {premiumDetails.nextDebitWindow && (
                <div className="summary-row">
                  <span className="summary-key">Next Premium Debit Window</span>
                  <span className="summary-val">{premiumDetails.nextDebitWindow}</span>
                </div>
              )}
            </>
          )}
          {scheme === 'PMAPY' && (
            <>
              <div className="summary-row"><span className="summary-key">Pension Amount</span><span className="summary-val">₹{Number(pensionAmount).toLocaleString('en-IN')} / month</span></div>
              <div className="summary-row"><span className="summary-key">Installment Frequency</span><span className="summary-val">{installmentFreq}</span></div>
              {installmentAmount != null && (
                <div className="summary-row"><span className="summary-key">Installment Amount</span><span className="summary-val">₹{installmentAmount}</span></div>
              )}
            </>
          )}
          <div className="divider" />
          <div className="section-heading">Nominee Details</div>
          {nomineeReviewRows}
          {(scheme === 'PMJJBY' || scheme === 'PMSBY') && ruralOrUrban && (
            <>
              <div className="divider" />
              <div className="summary-row"><span className="summary-key">Area Type</span><span className="summary-val">{ruralOrUrban}</span></div>
            </>
          )}
        </div>
      </div>
      <Actions>
        <div className="btn-row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('form')}>← Edit</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading}
            onClick={() => { if (validateForm()) sendOtpAndProceed(); }}>
            {loading ? 'Sending OTP…' : 'Confirm & Get OTP →'}
          </button>
        </div>
        {apiError && <p className="form-error" style={{ marginTop: 12 }}>⚠ {apiError}</p>}
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={resetToServiceHome}>
          Cancel
        </button>
      </Actions>
    </>
  );

  /* ── OTP ── */
  if (step === 'otp') return (
    <>
      <div className="flow-content">
        <div className="card otp-screen">
          <div className="card-title" style={{ justifyContent: 'center' }}><span className="card-icon">📱</span>OTP Verification</div>
          <p className="otp-subtitle">Enter the 5-digit OTP sent to your registered mobile number to complete enrollment</p>
          <OTPInput onComplete={handleOtpComplete} />
          {loading && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Verifying…</p>}
          {resendMsg && <p className="form-hint" style={{ color: 'var(--success)' }}>{resendMsg}</p>}
          {apiError && <p className="form-error" style={{ marginTop: 10 }}>⚠ {apiError}</p>}
          <p className="resend-text">
            Didn't receive OTP?{' '}
            <button type="button" className="resend-link" onClick={resendOtp}>Resend OTP</button>
          </p>
        </div>
      </div>
      <Actions>
        <button className="btn btn-secondary" onClick={() => { setApiError(''); setResendMsg(''); setStep('confirm'); }}>← Back</button>
        <button type="button" className="btn btn-secondary" onClick={resetToServiceHome}>Cancel</button>
      </Actions>
    </>
  );

  return null;
}
