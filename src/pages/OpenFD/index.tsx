import { useState, useEffect } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import NomineeFields, { type NomineeFieldValues, type NomineeFieldErrors, validateNomineeFields } from '../../components/NomineeFields';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome } from '../../hooks/useRedirectHome';
import { useAccounts } from '../../hooks/useAccounts';

type NomineeSource = 'existing' | 'new';
type Step = 'form' | 'confirm' | 'otp' | 'success';
const STEP_NUM: Record<Step, number> = { form: 1, confirm: 2, otp: 3, success: 4 };

const INTEREST_MODES_SIMPLE = ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly', 'On Maturity'];
const INTEREST_MODES_COMPOUND = ['On Maturity'];
const RENEWAL_OPTIONS = ['Not to Renew', 'Renew With Interest', 'Renew Without Interest'];

interface FDForm {
  savingAccount: string;
  depositAmount: string;
  depositType: string;
  interestPayMode: string;
  periodType: string;
  depositPeriod: string;
  renewalType: string;
  nomineeSource: NomineeSource | '';
}

type FDErrors = Partial<Record<keyof FDForm, string>>;

const EMPTY_NOMINEE: NomineeFieldValues = {
  nomineeName: '', nomineeDob: '', relation: '',
  guardianName: '', guardianDob: '', guardianRelation: '',
};

export default function OpenFD() {
  const { setCurrentStep, customer } = useFlow();
  const [step, setStep] = useState<Step>('form');
  useEffect(() => { setCurrentStep(STEP_NUM[step]); }, [step]);
  const [form, setForm] = useState<FDForm>({
    savingAccount: '', depositAmount: '', depositType: '',
    interestPayMode: '', periodType: '', depositPeriod: '',
    renewalType: '', nomineeSource: '',
  });
  const [errors, setErrors] = useState<FDErrors>({});
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [refNo] = useState(() => 'FD' + Date.now().toString().slice(-8));
  const [fdAccNo] = useState(() => 'FD' + Math.floor(Math.random() * 9000000 + 1000000));
  useRedirectHome(step === 'success');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);

  const set = <K extends keyof FDForm>(k: K, v: string) => {
    setForm(f => {
      const u = { ...f, [k]: v };
      if (k === 'depositType' && v === 'Compound') u.interestPayMode = 'On Maturity';
      if (k === 'depositType' && v === 'Simple') u.interestPayMode = '';
      return u;
    });
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = (): boolean => {
    const e: FDErrors = {};
    if (!form.savingAccount) e.savingAccount = 'Please select an account';
    if (!form.depositAmount.trim() || isNaN(Number(form.depositAmount)) || Number(form.depositAmount) < 1000)
      e.depositAmount = 'Minimum deposit is ₹1,000';
    if (!form.depositType) e.depositType = 'Please select deposit type';
    if (!form.interestPayMode) e.interestPayMode = 'Please select interest pay mode';
    if (!form.periodType) e.periodType = 'Please select period type';
    if (!form.depositPeriod.trim() || isNaN(Number(form.depositPeriod)) || Number(form.depositPeriod) < 1)
      e.depositPeriod = 'Enter a valid deposit period';
    if (!form.renewalType) e.renewalType = 'Please select renewal type';
    if (!form.nomineeSource) e.nomineeSource = 'Please select nominee option';
    setErrors(e);
    if (Object.keys(e).length > 0) return false;

    if (form.nomineeSource === 'new') {
      const ne = validateNomineeFields(nominee);
      setNomineeErrors(ne);
      return Object.keys(ne).length === 0;
    }
    return true;
  };

  const acc = accounts.find(a => a.value === form.savingAccount);
  const interestModes = form.depositType === 'Compound' ? INTEREST_MODES_COMPOUND : INTEREST_MODES_SIMPLE;

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <>      <div className="flow-content">
      <div className="success-screen">
        <div className="success-icon">🏦</div>
        <h2 className="success-title">FD Opened Successfully!</h2>
        <p className="success-msg">Your Fixed Deposit has been opened. A confirmation will be sent to your registered mobile number.</p>
        <div className="ref-box">
          <div className="ref-label">FD Account Number</div>
          <div className="ref-value">{fdAccNo}</div>
        </div>
        <div className="ref-box" style={{ background: '#eef3fb', borderColor: '#c5d6f5' }}>
          <div className="ref-label">Reference Number</div>
          <div className="ref-value" style={{ color: 'var(--primary)', fontSize: 17 }}>{refNo}</div>
        </div>
        <p className="redirect-hint">Redirecting to home…</p>
      </div>
    </div>
    </>
  );

  /* ── FD DETAILS FORM ── */
  if (step === 'form') return (
    <>      <div className="flow-content">
      <div className="card">
        <div className="card-title"><span className="card-icon">🏦</span>Fixed Deposit Details</div>

        {/* Debit Account — Drop Down (per flow sheet) */}
        <div className="form-group">
          <label className="form-label">Debit Savings Account <span className="required">*</span></label>
          <Select
            className={errors.savingAccount ? 'is-error' : ''}
            value={form.savingAccount}
            placeholder="Select savings account"
            options={accounts}
            onChange={v => set('savingAccount', v)}
          />
          {accountsLoading && <p className="form-hint">Loading accounts…</p>}
          {errors.savingAccount && <p className="form-error">⚠ {errors.savingAccount}</p>}
        </div>

        {/* Deposit Amount — Input Text */}
        <div className="form-group">
          <label className="form-label">Deposit Amount (₹) <span className="required">*</span></label>
          <input
            className={`form-input ${errors.depositAmount ? 'is-error' : ''}`}
            placeholder="Minimum ₹1,000"
            value={form.depositAmount}
            inputMode="decimal"
            onChange={e => set('depositAmount', e.target.value)}
          />
          {errors.depositAmount && <p className="form-error">⚠ {errors.depositAmount}</p>}
        </div>

        {/* Deposit Type — Drop Down */}
        <div className="form-group">
          <label className="form-label">Deposit Type <span className="required">*</span></label>
          <Select
            className={errors.depositType ? 'is-error' : ''}
            value={form.depositType}
            placeholder="Select deposit type"
            options={[
              { value: 'Simple', label: 'Simple' },
              { value: 'Compound', label: 'Compound' },
            ]}
            onChange={v => set('depositType', v)}
          />
          {errors.depositType && <p className="form-error">⚠ {errors.depositType}</p>}
        </div>

        {/* Interest Pay Mode — Drop Down (conditional) */}
        <div className="form-group">
          <label className="form-label">Interest Pay Mode <span className="required">*</span></label>
          <Select
            className={errors.interestPayMode ? 'is-error' : ''}
            value={form.interestPayMode}
            placeholder="Select mode"
            options={interestModes.map(m => ({ value: m, label: m }))}
            disabled={form.depositType === 'Compound'}
            onChange={v => set('interestPayMode', v)}
          />
          {form.depositType === 'Compound' && (
            <p className="form-hint">Compound interest is always paid On Maturity</p>
          )}
          {errors.interestPayMode && <p className="form-error">⚠ {errors.interestPayMode}</p>}
        </div>

        <div className="form-grid-2">
          {/* Period Type — Radio Button or Drop Down */}
          <div className="form-group form-group-full">
            <label className="form-label">Period Type <span className="required">*</span></label>
            <div className="radio-group horizontal">
              {(['Days', 'Months'] as const).map(t => (
                <label key={t} className={`radio-option ${form.periodType === t ? 'selected' : ''}`}>
                  <input type="radio" name="periodType" checked={form.periodType === t}
                    onChange={() => set('periodType', t)} />
                  <span className="radio-label">{t}</span>
                </label>
              ))}
            </div>
            {errors.periodType && <p className="form-error">⚠ {errors.periodType}</p>}
          </div>

          {/* Deposit Period — Input text */}
          <div className="form-group form-group-full">
            <label className="form-label">Deposit Period <span className="required">*</span></label>
            <input
              className={`form-input ${errors.depositPeriod ? 'is-error' : ''}`}
              placeholder={form.periodType === 'Days' ? 'e.g. 180' : 'e.g. 12'}
              value={form.depositPeriod}
              inputMode="numeric"
              onChange={e => set('depositPeriod', e.target.value)}
            />
            {form.periodType && (
              <p className="form-hint">Enter number of {form.periodType.toLowerCase()}</p>
            )}
            {errors.depositPeriod && <p className="form-error">⚠ {errors.depositPeriod}</p>}
          </div>
        </div>

        {/* Renewal Type — Radio Button or Drop Down (Not to Renew / With Interest / Without Interest) */}
        <div className="form-group">
          <label className="form-label">Renewal Type <span className="required">*</span></label>
          <Select
            className={errors.renewalType ? 'is-error' : ''}
            value={form.renewalType}
            placeholder="Select renewal option"
            options={RENEWAL_OPTIONS.map(r => ({ value: r, label: r }))}
            onChange={v => set('renewalType', v)}
          />
          {errors.renewalType && <p className="form-error">⚠ {errors.renewalType}</p>}
        </div>

        <div className="divider" />

        {/* Add Nominee — Drop Down (Debit Account Nominee / New Nominee) */}
        <div className="form-group">
          <label className="form-label">Add Nominee <span className="required">*</span></label>
          <Select
            className={errors.nomineeSource ? 'is-error' : ''}
            value={form.nomineeSource}
            placeholder="Select nominee option"
            options={[
              { value: 'existing', label: 'Use Debit Account Nominee' },
              { value: 'new', label: 'Add New Nominee' },
            ]}
            onChange={v => set('nomineeSource', v)}
          />
          {errors.nomineeSource && <p className="form-error">⚠ {errors.nomineeSource}</p>}
        </div>

        {/* New Nominee — shown only if "new" */}
        {form.nomineeSource === 'new' && (
          <>
            <div className="section-heading">Nominee Details</div>
            {/* Nominee Name — Input text */}
            {/* Nominee DOB — Calendar Selection */}
            {/* Relation — Drop down */}
            {/* Nominee Minor — auto from DOB */}
            {/* Guardian fields if minor */}
            <NomineeFields values={nominee} errors={nomineeErrors} onChange={setNomineeField} />
          </>
        )}

        {form.nomineeSource === 'existing' && (
          <div className="info-box" style={{ marginTop: 4 }}>
            <span className="info-icon">ℹ️</span>
            <span>The nominee linked to {acc?.label ?? 'your account'} will be applied to this FD.</span>
          </div>
        )}
      </div>
    </div>
      <Actions>
        <button className="btn btn-primary" onClick={() => { if (validate()) setStep('confirm'); }}>
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
        <span>Please review all FD details. The deposit amount will be debited upon confirmation.</span>
      </div>
      <div className="card">
        <div className="card-title"><span className="card-icon">🏦</span>FD Details</div>
        <div className="summary-row"><span className="summary-key">Debit Account</span><span className="summary-val">{acc?.label}</span></div>
        <div className="summary-row"><span className="summary-key">Deposit Amount</span><span className="summary-val">₹ {Number(form.depositAmount).toLocaleString('en-IN')}</span></div>
        <div className="summary-row"><span className="summary-key">Deposit Type</span><span className="summary-val">{form.depositType}</span></div>
        <div className="summary-row"><span className="summary-key">Interest Pay Mode</span><span className="summary-val">{form.interestPayMode}</span></div>
        <div className="summary-row"><span className="summary-key">Period</span><span className="summary-val">{form.depositPeriod} {form.periodType}</span></div>
        <div className="summary-row"><span className="summary-key">Renewal Type</span><span className="summary-val">{form.renewalType}</span></div>
        <div className="divider" />
        <div className="summary-row"><span className="summary-key">Nominee</span><span className="summary-val">{form.nomineeSource === 'existing' ? 'Account Nominee' : 'New Nominee'}</span></div>
        {form.nomineeSource === 'new' && <>
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
            onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); setStep('otp'); }, 900); }}>
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
        <p className="otp-subtitle">Enter the 6-digit OTP sent to your registered mobile number to authorise the FD</p>
        <OTPInput onComplete={() => {
          setLoading(true);
          setTimeout(() => { setLoading(false); setStep('success'); }, 1100);
        }} />
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


