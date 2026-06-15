import { useState, useEffect } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import NomineeFields, { type NomineeFieldValues, type NomineeFieldErrors, validateNomineeFields } from '../../components/NomineeFields';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome } from '../../hooks/useRedirectHome';
import { SAVING_ACCOUNTS } from '../../types';

type Scheme = 'PMJJBY' | 'PMSBY' | 'PMAPY';
type NomineeSource = 'existing' | 'new';
type Step = 'select' | 'form' | 'confirm' | 'otp' | 'success';
const STEP_NUM: Record<Step, number> = { select: 1, form: 2, confirm: 3, otp: 4, success: 5 };

const SCHEME_INFO: Record<Scheme, { name: string; desc: string; premium: string; coverage: string; color: string }> = {
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
  const { setCurrentStep } = useFlow();
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [step, setStep] = useState<Step>('select');
  useEffect(() => { setCurrentStep(STEP_NUM[step]); }, [step]);
  const [savingAccount, setSavingAccount] = useState('');
  const [installmentFreq, setInstallmentFreq] = useState('');
  const [nomineeSource, setNomineeSource] = useState<NomineeSource | ''>('');
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [refNo] = useState(() => 'PMS' + Date.now().toString().slice(-8));
  useRedirectHome(step === 'success');

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
  };

  const validateForm = () => {
    const e: Record<string, string> = {};
    if (!savingAccount) e.savingAccount = 'Please select a savings account';
    if (scheme === 'PMAPY' && !installmentFreq) e.installmentFreq = 'Please select installment frequency';
    if (!nomineeSource) e.nomineeSource = 'Please select nominee option';
    setFormErrors(e);
    if (Object.keys(e).length > 0) return false;

    if (nomineeSource === 'new') {
      const ne = validateNomineeFields(nominee);
      setNomineeErrors(ne);
      return Object.keys(ne).length === 0;
    }
    return true;
  };

  const acc = SAVING_ACCOUNTS.find(a => a.value === savingAccount);

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
          {scheme && (
            <div className="info-box" style={{ textAlign: 'left', maxWidth: 400 }}>
              <span className="info-icon">ℹ️</span>
              <span>Coverage: {SCHEME_INFO[scheme].coverage} | Premium: {SCHEME_INFO[scheme].premium}</span>
            </div>
          )}
          <p className="redirect-hint">Redirecting to home…</p>
        </div>
      </div>
    </>
  );

  /* ── SELECT SCHEME ── */
  if (step === 'select') return (
    <>      <div className="flow-content">
        <div className="card">
          <div className="card-title"><span className="card-icon">🏛️</span>PM Social Scheme</div>
          <div className="info-box">
            <span className="info-icon">ℹ️</span>
            <span>Government social security schemes providing life, accident insurance and pension at very low premiums.</span>
          </div>

          {/* Select Scheme — Radio Button */}
          <div className="form-group">
            <label className="form-label">Select Scheme <span className="required">*</span></label>
            <div className="radio-group">
              {(['PMJJBY', 'PMSBY', 'PMAPY'] as Scheme[]).map(s => (
                <label key={s} className={`radio-option ${scheme === s ? 'selected' : ''}`}>
                  <input type="radio" name="scheme" checked={scheme === s} onChange={() => setScheme(s)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="radio-label">{s}</span>
                      <span className={`scheme-badge scheme-${s}`}>{SCHEME_INFO[s].premium}</span>
                    </div>
                    <div className="radio-desc">{SCHEME_INFO[s].desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Scheme detail card */}
        {scheme && (
          <div className="card" style={{ borderColor: '#c5d6f5', background: '#f0f4fb' }}>
            <div className="card-title" style={{ fontSize: 13 }}><span className="card-icon">📋</span>Scheme Details</div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>{SCHEME_INFO[scheme].name}</p>
            <div className="summary-row"><span className="summary-key">Annual Premium</span><span className="summary-val">{SCHEME_INFO[scheme].premium}</span></div>
            <div className="summary-row"><span className="summary-key">Coverage / Benefit</span><span className="summary-val">{SCHEME_INFO[scheme].coverage}</span></div>
          </div>
        )}
      </div>
      <Actions>
        <button className="btn btn-primary" disabled={!scheme} onClick={() => setStep('form')}>
          Continue →
        </button>
      </Actions>
    </>
  );

  /* ── ENROLLMENT DETAILS FORM ── */
  if (step === 'form') return (
    <>      <div className="flow-content">
        <div className="card">
          <div className="card-title">
            <span className="card-icon">✏️</span>Enrollment Details
            {scheme && <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>}
          </div>

          {/* Debit Account — Radio Button or Selection */}
          <div className="form-group">
            <label className="form-label">Debit Savings Account <span className="required">*</span></label>
            <div className="radio-group">
              {SAVING_ACCOUNTS.map(a => (
                <label key={a.value} className={`radio-option ${savingAccount === a.value ? 'selected' : ''}`}>
                  <input type="radio" name="account" checked={savingAccount === a.value}
                    onChange={() => { setSavingAccount(a.value); setFormErrors(e => ({ ...e, savingAccount: '' })); }} />
                  <span className="radio-label">{a.label}</span>
                </label>
              ))}
            </div>
            {formErrors.savingAccount && <p className="form-error">⚠ {formErrors.savingAccount}</p>}
          </div>

          {/* PMAPY only — Installment Frequency — Drop Down */}
          {scheme === 'PMAPY' && (
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
          )}

          <div className="divider" />

          {/* Add Nominee — Drop Down (Debit Account Nominee / New Nominee) */}
          <div className="form-group">
            <label className="form-label">Add Nominee <span className="required">*</span></label>
            <Select
              className={formErrors.nomineeSource ? 'is-error' : ''}
              value={nomineeSource}
              placeholder="Select nominee option"
              options={[
                { value: 'existing', label: 'Use Debit Account Nominee' },
                { value: 'new', label: 'Add New Nominee' },
              ]}
              onChange={v => { setNomineeSource(v as NomineeSource); setFormErrors(f => ({ ...f, nomineeSource: '' })); }}
            />
            {formErrors.nomineeSource && <p className="form-error">⚠ {formErrors.nomineeSource}</p>}
          </div>

          {/* New Nominee fields — shown only if "new" selected */}
          {nomineeSource === 'new' && (
            <>
              <div className="section-heading">New Nominee Details</div>
              {/* Nominee Name — Input text */}
              {/* Nominee DOB — Calendar selection */}
              {/* Relationship — Drop down */}
              {/* Nominee Minor — auto from DOB */}
              {/* Guardian fields if minor */}
              <NomineeFields values={nominee} errors={nomineeErrors} onChange={setNomineeField} />
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
        <div className="btn-row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('select')}>← Back</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { if (validateForm()) setStep('confirm'); }}>
            Review →
          </button>
        </div>
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
        <div className="card">
          <div className="card-title">
            <span className="card-icon">✅</span>Review Enrollment
            {scheme && <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>{scheme}</span>}
          </div>
          <div className="summary-row"><span className="summary-key">Scheme</span><span className="summary-val">{scheme && SCHEME_INFO[scheme].name}</span></div>
          <div className="summary-row"><span className="summary-key">Savings Account</span><span className="summary-val">{acc?.label}</span></div>
          <div className="summary-row"><span className="summary-key">Annual Premium</span><span className="summary-val">{scheme && SCHEME_INFO[scheme].premium}</span></div>
          {scheme === 'PMAPY' && <div className="summary-row"><span className="summary-key">Installment Frequency</span><span className="summary-val">{installmentFreq}</span></div>}
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
          <p className="otp-subtitle">Enter the 4-digit OTP sent to your registered mobile number to complete enrollment</p>
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


