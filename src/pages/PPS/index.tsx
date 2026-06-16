import { useState, useEffect, useRef } from 'react';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome, useGoHome } from '../../hooks/useRedirectHome';
import Select from '../../components/Select';
import { Stepper, Actions } from '../../components/ServiceShell';
import { useAccounts } from '../../hooks/useAccounts';
import { usePPSParameters } from '../../hooks/usePPSParameters';
import { createPPSChequeEntry, sendOtp, validateOtp } from '../../services/api';
import { minIssueDate, toInputDate } from '../../utils/date';

type Mode = 'entry' | 'view';
type Step = 'select' | 'form' | 'confirm' | 'otp' | 'success';

interface EntryForm {
  accountNo: string;
  chequeNo: string;
  chequeAmount: string;
  issueDate: string;
  payeeName: string;
}

const ENTRY_STEPS = ['Select Service', 'Enter Details', 'Review', 'Verify OTP', 'Done'];
const VIEW_STEPS = ['Select Service', 'Search', 'Result'];

const STEP_NUM: Record<Step, number> = { select: 1, form: 2, confirm: 3, otp: 4, success: 5 };

type FormErrors = Partial<Record<keyof EntryForm, string>>;

function OtpBoxes({
  onComplete,
  disabled,
}: {
  onComplete: (otp: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const OTP_LENGTH = 6;
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const refs = Array.from({ length: OTP_LENGTH }, () => useRef<HTMLInputElement>(null));

  const handleInput = (i: number, val: string) => {
    if (disabled || verifying) return;
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < OTP_LENGTH - 1) refs[i + 1].current?.focus();
    if (next.every(d => d)) {
      setVerifying(true);
      Promise.resolve(onComplete(next.join(''))).finally(() => setVerifying(false));
    }
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = pasted.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);
    setDigits(next);
    if (pasted.length === OTP_LENGTH) {
      setVerifying(true);
      Promise.resolve(onComplete(pasted)).finally(() => setVerifying(false));
    }
  };

  return (
    <div className="otp-wrap">
      <div className="card-title" style={{ justifyContent: 'center' }}>
        <span className="ic">📱</span>OTP Verification
      </div>
      <p className="card-sub" style={{ marginBottom: 0 }}>
        Enter the 6-digit OTP sent to your registered mobile number ••210
      </p>
      <div className="otp-boxes">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={refs[i]}
            maxLength={1}
            inputMode="numeric"
            aria-label={`OTP digit ${i + 1}`}
            value={d}
            disabled={verifying || disabled}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKey(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
          />
        ))}
      </div>
      <p className="otp-state">{verifying ? 'Verifying…' : resendMsg}</p>
      <p className="resend">
        Didn't receive OTP?{' '}
        <button type="button" onClick={() => setResendMsg('A new OTP has been sent ✓')}>Resend OTP</button>
      </p>
    </div>
  );
}

export default function PPS() {
  const { setCurrentStep, customer } = useFlow();
  const [mode, setMode] = useState<Mode | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [form, setForm] = useState<EntryForm>({ accountNo: '', chequeNo: '', chequeAmount: '', issueDate: '', payeeName: '' });
  const [viewChequeNo, setViewChequeNo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [refNo, setRefNo] = useState('');
  const goHome = useGoHome();
  useRedirectHome(step === 'success');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const { params: ppsParams } = usePPSParameters();

  const stepLabels = mode === 'view' ? VIEW_STEPS : ENTRY_STEPS;
  const curStep = STEP_NUM[step];

  useEffect(() => { setCurrentStep(curStep); }, [curStep, setCurrentStep]);

  const setField = (k: keyof EntryForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  const selectedAccount = accounts.find(a => a.value === form.accountNo);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.accountNo) e.accountNo = 'Please select an account';
    if (!form.chequeNo.trim()) e.chequeNo = 'Cheque number is required';
    else if (!/^\d{6}$/.test(form.chequeNo.trim())) e.chequeNo = 'Cheque number must be 6 digits';

    const n = Number(form.chequeAmount);
    if (!form.chequeAmount.trim() || isNaN(n) || n <= 0) {
      e.chequeAmount = 'Enter a valid amount';
    } else if (ppsParams) {
      if (n < ppsParams.minChequeAmount) {
        e.chequeAmount = `Minimum cheque amount is ₹${ppsParams.minChequeAmount.toLocaleString('en-IN')}`;
      } else if (n > ppsParams.maxChequeAmount) {
        e.chequeAmount = `Maximum cheque amount is ₹${ppsParams.maxChequeAmount.toLocaleString('en-IN')}`;
      }
    }

    if (!form.issueDate) {
      e.issueDate = 'Issue date is required';
    } else {
      const issue = new Date(form.issueDate);
      issue.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const oldest = new Date(today);
      oldest.setMonth(oldest.getMonth() - 3);

      if (issue > today) e.issueDate = 'Issue date cannot be in the future';
      else if (issue < oldest) e.issueDate = 'Issue date cannot be more than 3 months old';
    }

    if (!form.payeeName.trim()) e.payeeName = 'Payee name is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const restart = (m?: Mode) => {
    setMode(m ?? null);
    setStep(m ? 'form' : 'select');
    setForm({ accountNo: '', chequeNo: '', chequeAmount: '', issueDate: '', payeeName: '' });
    setViewChequeNo('');
    setErrors({});
    setLoading(false);
  };

  const sendOtpAndProceed = async () => {
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
    try {
      await validateOtp(customer.mobileNo, otp, 'TDACCOUNTOPEN');
      await createPPSChequeEntry({
        accountNo: form.accountNo,
        chequeNo: Number(form.chequeNo),
        chequeAmount: Number(form.chequeAmount),
        payeeName: form.payeeName.trim(),
        issueDate: form.issueDate,
        mobileNo: customer.mobileNo,
      });
      setRefNo('PPS' + Date.now().toString().slice(-8));
      setStep('success');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Verification failed');
      throw err;
    }
  };

  const renderView = () => {
    if (step === 'success') {
      return (
        <div className="card">
          <div className="done-wrap">
            <div className="done-ic">✅</div>
            <h2>PPS Entry Submitted!</h2>
            <p>Your Positive Payment details have been registered. The cheque will be validated before payment processing.</p>
            <div className="refbox">
              <div className="rl">Reference Number</div>
              <div className="rv">{refNo}</div>
            </div>
            <div className="note info" style={{ textAlign: 'left', maxWidth: 430, margin: '0 auto' }}>
              <span>ℹ️</span>
              <span>A confirmation SMS will be sent to your registered mobile number. Save this reference for future queries.</span>
            </div>
            <p className="redirect-hint">Redirecting to home…</p>
          </div>
        </div>
      );
    }

    if (step === 'select') {
      return (
        <div className="card">
          <div className="card-title"><span className="ic">📋</span>Choose a service</div>
          <p className="card-sub">You can register a new cheque or check the status of an existing one.</p>
          <div className="note info">
            <span>ℹ️</span>
            <span>PPS helps protect against cheque fraud by pre-registering cheque details before they are presented for payment.</span>
          </div>
          <div className="svc-pick">
            <label className={`svc-opt ${mode === 'entry' ? 'sel' : ''}`} onClick={() => setMode('entry')}>
              <input type="radio" name="m" checked={mode === 'entry'} readOnly />
              <span className="ic">📝</span>
              <span>
                <span className="t">Positive Payment Entry</span>
                <span className="d">Register a new cheque for positive pay</span>
              </span>
              <span className="dot" />
            </label>
            <label className={`svc-opt ${mode === 'view' ? 'sel' : ''}`} onClick={() => setMode('view')}>
              <input type="radio" name="m" checked={mode === 'view'} readOnly />
              <span className="ic">🔍</span>
              <span>
                <span className="t">Positive Payment View</span>
                <span className="d">Check status of a registered cheque</span>
              </span>
              <span className="dot" />
            </label>
          </div>
        </div>
      );
    }

    if (step === 'form' && mode === 'view') {
      return (
        <div className="card">
          <div className="card-title"><span className="ic">🔍</span>Search cheque status</div>
          <p className="card-sub">Look up any cheque you have registered under Positive Pay.</p>
          <div className="fg">
            <label className="fl" htmlFor="f_vcq">Cheque Number <span className="req">*</span></label>
            <input
              id="f_vcq"
              className="fi"
              placeholder="Enter cheque number e.g. 852963"
              inputMode="numeric"
              maxLength={6}
              value={viewChequeNo}
              onChange={e => setViewChequeNo(e.target.value)}
            />
            <p className="fhint">6-digit cheque number printed on your cheque leaf</p>
          </div>
        </div>
      );
    }

    if (step === 'confirm' && mode === 'view') {
      return (
        <div className="card">
          <div className="card-title"><span className="ic">📄</span>Cheque status</div>
          <div className="sum" style={{ marginTop: 6 }}>
            <div className="sumrow"><span className="k">Cheque Number</span><span className="v mono">{viewChequeNo}</span></div>
            <div className="sumrow"><span className="k">Status</span><span className="v ok">✓ Registered</span></div>
            <div className="sumrow"><span className="k">Issue Date</span><span className="v">01/06/2026</span></div>
            <div className="sumrow"><span className="k">Amount</span><span className="v">₹ 25,000</span></div>
            <div className="sumrow"><span className="k">Payee Name</span><span className="v">Ram Manohar Patil</span></div>
          </div>
        </div>
      );
    }

    if (step === 'form') {
      return (
        <div className="card">
          <div className="card-title"><span className="ic">✏️</span>Enter cheque details</div>
          <p className="card-sub">All fields are required. Details must match the physical cheque exactly.</p>
          <div className="section-label">Account</div>
          <div className="fg">
            <label className="fl" htmlFor="f_accountNo">Account Number <span className="req">*</span></label>
            <Select
              id="f_accountNo"
              className={errors.accountNo ? 'is-error' : ''}
              value={form.accountNo}
              placeholder="Select account"
              options={accounts}
              onChange={v => setField('accountNo', v)}
            />
            {accountsLoading && <p className="fhint">Loading accounts…</p>}
            {errors.accountNo && <p className="ferr">⚠ {errors.accountNo}</p>}
          </div>
          <div className="section-label">Cheque information</div>
          <div className="grid2">
            <div className="fg">
              <label className="fl" htmlFor="f_chequeNo">Cheque Number <span className="req">*</span></label>
              <input
                id="f_chequeNo"
                className={`fi ${errors.chequeNo ? 'is-error' : ''}`}
                placeholder="e.g. 852963"
                inputMode="numeric"
                maxLength={6}
                value={form.chequeNo}
                onChange={e => setField('chequeNo', e.target.value)}
              />
              <p className="fhint">6-digit number printed on your cheque leaf</p>
              {errors.chequeNo && <p className="ferr">⚠ {errors.chequeNo}</p>}
            </div>
            <div className="fg">
              <label className="fl" htmlFor="f_chequeAmount">Cheque Amount (₹) <span className="req">*</span></label>
              <input
                id="f_chequeAmount"
                className={`fi ${errors.chequeAmount ? 'is-error' : ''}`}
                placeholder="e.g. 50000"
                inputMode="decimal"
                value={form.chequeAmount}
                onChange={e => setField('chequeAmount', e.target.value)}
              />
              {ppsParams && (
                <p className="fhint">
                  Allowed range: ₹{ppsParams.minChequeAmount.toLocaleString('en-IN')} – ₹{ppsParams.maxChequeAmount.toLocaleString('en-IN')}
                </p>
              )}
              {errors.chequeAmount && <p className="ferr">⚠ {errors.chequeAmount}</p>}
            </div>
          </div>
          <div className="grid2">
            <div className="fg">
              <label className="fl" htmlFor="f_issueDate">Cheque Issue Date <span className="req">*</span></label>
              <input
                id="f_issueDate"
                className={`fi ${errors.issueDate ? 'is-error' : ''}`}
                type="date"
                min={minIssueDate()}
                max={toInputDate(new Date())}
                value={form.issueDate}
                onChange={e => setField('issueDate', e.target.value)}
              />
              <p className="fhint">Must be within the last 3 months and not a future date</p>
              {errors.issueDate && <p className="ferr">⚠ {errors.issueDate}</p>}
            </div>
            <div className="fg">
              <label className="fl" htmlFor="f_payeeName">Payee Name <span className="req">*</span></label>
              <input
                id="f_payeeName"
                className={`fi ${errors.payeeName ? 'is-error' : ''}`}
                placeholder="e.g. Ram Manohar Patil"
                value={form.payeeName}
                onChange={e => setField('payeeName', e.target.value)}
              />
              {errors.payeeName && <p className="ferr">⚠ {errors.payeeName}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (step === 'confirm') {
      return (
        <>
          <div className="note warn">
            <span>⚠️</span>
            <span>Please review all details carefully. <b>Once submitted, changes cannot be made.</b></span>
          </div>
          {apiError && <div className="note warn"><span>⚠️</span><span>{apiError}</span></div>}
          <div className="card">
            <div className="card-title"><span className="ic">✅</span>Review details</div>
            <p className="card-sub">Confirm these match the physical cheque before you proceed.</p>
            <div className="sum">
              <div className="sumrow"><span className="k">Account</span><span className="v">{selectedAccount?.label}</span></div>
              <div className="sumrow"><span className="k">Cheque Number</span><span className="v mono">{form.chequeNo}</span></div>
              <div className="sumrow"><span className="k">Amount</span><span className="v">₹ {Number(form.chequeAmount).toLocaleString('en-IN')}</span></div>
              <div className="sumrow"><span className="k">Issue Date</span><span className="v">{new Date(form.issueDate).toLocaleDateString('en-IN')}</span></div>
              <div className="sumrow"><span className="k">Payee Name</span><span className="v">{form.payeeName}</span></div>
            </div>
          </div>
        </>
      );
    }

    if (step === 'otp') {
      return (
        <div className="card">
          {apiError && <p className="ferr" style={{ marginBottom: 12 }}>⚠ {apiError}</p>}
          <OtpBoxes onComplete={handleOtpComplete} disabled={loading} />
        </div>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (step === 'success') {
      return null;
    }
    if (step === 'select') {
      return (
        <Actions>
          <button type="button" className="btn btn-primary" disabled={!mode} onClick={() => setStep('form')}>Continue →</button>
        </Actions>
      );
    }
    if (step === 'form' && mode === 'view') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => restart()}>← Back</button>
          <button type="button" className="btn btn-primary" disabled={!viewChequeNo.trim()} onClick={() => setStep('confirm')}>Search</button>
        </Actions>
      );
    }
    if (step === 'confirm' && mode === 'view') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={goHome}>Done</button>
        </Actions>
      );
    }
    if (step === 'form') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => { setMode(null); setStep('select'); }}>← Back</button>
          <button type="button" className="btn btn-primary" onClick={() => { if (validate()) setStep('confirm'); }}>Review →</button>
        </Actions>
      );
    }
    if (step === 'confirm') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>← Edit</button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={sendOtpAndProceed}>
            {loading ? 'Sending OTP…' : 'Confirm & Get OTP →'}
          </button>
        </Actions>
      );
    }
    if (step === 'otp') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('confirm')}>← Back</button>
        </Actions>
      );
    }
    return null;
  };

  return (
    <>
      <Stepper steps={stepLabels} current={curStep} />
      {renderView()}
      {renderActions()}
    </>
  );
}
