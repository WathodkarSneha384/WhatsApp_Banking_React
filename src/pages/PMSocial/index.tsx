import { useState, useEffect, lazy, Suspense } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import {
  type NomineeFieldValues,
  type NomineeFieldErrors,
  validateNomineeFields,
  calcAge,
} from '../../components/NomineeFields';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome } from '../../hooks/useRedirectHome';
import { useAccounts } from '../../hooks/useAccounts';
import { useInsurancePremium } from '../../hooks/useInsurancePremium';
import type { PMSocialSubservice } from '../../types';
import { doProcessPMJJBYSBY, sendOtp, validateOtp } from '../../services/api';
import { PENSION_AMOUNT_OPTIONS } from '../../utils/pmPremium';

type NomineeSource = 'existing' | 'new';
type Step = 'form' | 'confirm' | 'otp' | 'success';
const STEP_NUM: Record<Step, number> = { form: 1, confirm: 2, otp: 3, success: 4 };

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
const LazyNomineeFields = lazy(() => import('../../components/NomineeFields'));

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
  const [nomineeSource, setNomineeSource] = useState<NomineeSource | ''>('');
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [refNo, setRefNo] = useState('');

  const insuranceScheme = subservice === 'PMJJBY' || subservice === 'PMSBY' ? subservice : null;
  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const { premium: premiumDetails, loading: premiumLoading } = useInsurancePremium(insuranceScheme);

  useEffect(() => { setCurrentStep(STEP_NUM[step]); }, [step, setCurrentStep]);
  useRedirectHome(step === 'success');

  if (!subservice) return null;
  const scheme = subservice;

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!savingAccount) e.savingAccount = 'Please select a savings account';
    if (scheme === 'PMAPY') {
      if (!pensionAmount) e.pensionAmount = 'Please select pension amount';
      if (!installmentFreq) e.installmentFreq = 'Please select installment frequency';
    }
    if (!nomineeSource) e.nomineeSource = 'Please select nominee option';
    setFormErrors(e);
    if (Object.keys(e).length > 0) return false;

    if (nomineeSource === 'new') {
      const ne = validateNomineeFields(nominee, { requireGuardianDob: false });
      setNomineeErrors(ne);
      return Object.keys(ne).length === 0;
    }
    return true;
  };

  const acc = accounts.find(a => a.value === savingAccount);
  const nomineeIsMinor = nominee.nomineeDob ? (calcAge(nominee.nomineeDob) ?? 18) < 18 : false;

  const sendOtpAndProceed = async () => {
    if (scheme !== 'PMJJBY' && scheme !== 'PMSBY') {
      setStep('otp');
      return;
    }
    setLoading(true);
    setApiError('');
    try {
      await sendOtp(customer.mobileNo, 'TDACCOUNTOPEN');
      setStep('otp');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpComplete = async (otp: string) => {
    setApiError('');
    if (scheme === 'PMAPY') {
      setRefNo('PMS' + Date.now().toString().slice(-8));
      setStep('success');
      return;
    }

    setLoading(true);
    try {
      await validateOtp(customer.mobileNo, otp, 'TDACCOUNTOPEN');
      const result = await doProcessPMJJBYSBY({
        customerId: customer.customerId,
        debitAccountNumber: savingAccount,
        insuranceCompany: scheme,
        totalPremiumAmount: premiumDetails?.totalPremium ?? 0,
        nomineeName: nomineeSource === 'new' ? nominee.nomineeName : '',
        nomineeRelationCode: nomineeSource === 'new' ? nominee.relation : '',
        nomineeDob: nomineeSource === 'new' ? nominee.nomineeDob : '',
        guardianName: nomineeSource === 'new' && nomineeIsMinor ? nominee.guardianName : '',
        guardianRelationCode: nomineeSource === 'new' && nomineeIsMinor ? nominee.guardianRelation : '',
        nomineeIsMinor: nomineeSource === 'new' && nomineeIsMinor,
      });
      setRefNo(result.referenceNumber);
      setStep('success');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Enrollment failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <>      <div className="flow-content">
        <div className="success-screen">
          <div className="success-icon">✅</div>
          <h2 className="success-title">Enrollment Successful!</h2>
          <p className="success-msg">
            You've been enrolled in <strong>{scheme}</strong>. The premium will be auto-debited from {acc?.label} as per schedule.
          </p>
          <div className="ref-box">
            <div className="ref-label">Reference Number</div>
            <div className="ref-value">{refNo}</div>
          </div>
          <div className="info-box" style={{ textAlign: 'left', maxWidth: 400 }}>
            <span className="info-icon">ℹ️</span>
            <span>Coverage: {SCHEME_INFO[scheme].coverage} | Premium: {SCHEME_INFO[scheme].premium}</span>
          </div>
          <p className="redirect-hint">Redirecting to home…</p>
        </div>
      </div>
    </>
  );

  /* ── ENROLLMENT DETAILS FORM ── */
  if (step === 'form') return (
    <>      <div className="flow-content">
        <div className="card" style={{ borderColor: '#c5d6f5', background: '#f0f4fb' }}>
          <div className="card-title" style={{ fontSize: 13 }}>
            <span className="card-icon">📋</span>Scheme Details
            <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>{SCHEME_INFO[scheme].name}</p>
          <div className="summary-row"><span className="summary-key">Annual Premium</span><span className="summary-val">{SCHEME_INFO[scheme].premium}</span></div>
          <div className="summary-row"><span className="summary-key">Coverage / Benefit</span><span className="summary-val">{SCHEME_INFO[scheme].coverage}</span></div>
          {(scheme === 'PMJJBY' || scheme === 'PMSBY') && premiumLoading && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Loading premium details…</p>
          )}
          {premiumDetails && (
            <>
              <div className="divider" />
              <div className="summary-row"><span className="summary-key">Total Premium Amount</span><span className="summary-val">₹{premiumDetails.totalPremium.toLocaleString('en-IN')}</span></div>
              <div className="summary-row"><span className="summary-key">First Premium Amount (Pro Rata)</span><span className="summary-val">₹{premiumDetails.firstPremium.toLocaleString('en-IN')}</span></div>
              <div className="summary-row"><span className="summary-key">Next Premium Debit Window</span><span className="summary-val">{premiumDetails.nextDebitWindow}</span></div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-title">
            <span className="card-icon">✏️</span>Enrollment Details
            <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Debit Savings Account <span className="required">*</span></label>
            <div className="radio-group">
              {accountsLoading && <p className="form-hint">Loading accounts…</p>}
              {accounts.map(a => (
                <label key={a.value} className={`radio-option ${savingAccount === a.value ? 'selected' : ''}`}>
                  <input type="radio" name="account" checked={savingAccount === a.value}
                    onChange={() => { setSavingAccount(a.value); setFormErrors(e => ({ ...e, savingAccount: '' })); }} />
                  <span className="radio-label">{a.label}</span>
                </label>
              ))}
            </div>
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
            </>
          )}

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Add Nominee <span className="required">*</span></label>
            <Select
              className={formErrors.nomineeSource ? 'is-error' : ''}
              value={nomineeSource}
              placeholder="Select nominee option"
              options={[
               
                { value: 'new', label: 'Add New Nominee' },
              ]}
              onChange={v => { setNomineeSource(v as NomineeSource); setFormErrors(f => ({ ...f, nomineeSource: '' })); }}
            />
            {formErrors.nomineeSource && <p className="form-error">⚠ {formErrors.nomineeSource}</p>}
          </div>

          {nomineeSource === 'new' && (
            <>
              <div className="section-heading">New Nominee Details</div>
              <Suspense fallback={<p className="form-hint">Loading nominee form…</p>}>
                <LazyNomineeFields
                  values={nominee}
                  errors={nomineeErrors}
                  onChange={setNomineeField}
                  showGuardianDob={false}
                />
              </Suspense>
            </>
          )}

          {nomineeSource === 'existing' && (
            <div className="info-box" style={{ marginTop: 4 }}>
              <span className="info-icon">ℹ️</span>
              <span>The nominee already registered with account {acc?.label} will be used for this scheme.</span>
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
    <>      <div className="flow-content">
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
          <div className="summary-row"><span className="summary-key">Savings Account</span><span className="summary-val">{acc?.label}</span></div>
          <div className="summary-row"><span className="summary-key">Annual Premium</span><span className="summary-val">{SCHEME_INFO[scheme].premium}</span></div>
          {premiumDetails && (
            <>
              <div className="summary-row"><span className="summary-key">Total Premium Amount</span><span className="summary-val">₹{premiumDetails.totalPremium.toLocaleString('en-IN')}</span></div>
              <div className="summary-row"><span className="summary-key">First Premium Amount (Pro Rata)</span><span className="summary-val">₹{premiumDetails.firstPremium.toLocaleString('en-IN')}</span></div>
              <div className="summary-row"><span className="summary-key">Next Premium Debit Window</span><span className="summary-val">{premiumDetails.nextDebitWindow}</span></div>
            </>
          )}
          {scheme === 'PMAPY' && <>
            <div className="summary-row"><span className="summary-key">Pension Amount</span><span className="summary-val">₹{Number(pensionAmount).toLocaleString('en-IN')} / month</span></div>
            <div className="summary-row"><span className="summary-key">Installment Frequency</span><span className="summary-val">{installmentFreq}</span></div>
          </>}
          <div className="divider" />
          <div className="summary-row"><span className="summary-key">Nominee Source</span><span className="summary-val">{nomineeSource === 'existing' ? 'Account Nominee' : 'New Nominee'}</span></div>
          {nomineeSource === 'new' && <>
            <div className="summary-row"><span className="summary-key">Nominee Name</span><span className="summary-val">{nominee.nomineeName}</span></div>
            <div className="summary-row"><span className="summary-key">Nominee DOB</span><span className="summary-val">{new Date(nominee.nomineeDob).toLocaleDateString('en-IN')}</span></div>
            <div className="summary-row"><span className="summary-key">Relationship</span><span className="summary-val">{nominee.relation}</span></div>
          </>}
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
      </Actions>
    </>
  );

  /* ── OTP ── */
  if (step === 'otp') return (
    <>      <div className="flow-content">
        <div className="card otp-screen">
          <div className="card-title" style={{ justifyContent: 'center' }}><span className="card-icon">📱</span>OTP Verification</div>
          <p className="otp-subtitle">Enter the 6-digit OTP sent to your registered mobile number to complete enrollment</p>
          {apiError && <p className="form-error">⚠ {apiError}</p>}
          <OTPInput onComplete={handleOtpComplete} />
          {loading && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Verifying…</p>}
          <p className="resend-text">Didn't receive OTP? <span className="resend-link">Resend OTP</span></p>
        </div>
      </div>
      <Actions>
        <button className="btn btn-secondary" onClick={() => setStep('confirm')}>← Back</button>
      </Actions>
    </>
  );

  return null;
}
