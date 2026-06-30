import { useState, useEffect, useRef } from 'react';
import { useFlow } from '../../context/FlowContext';
import ServiceResultScreen from '../../components/ServiceResultScreen';
import { useServiceFlowReset } from '../../hooks/useServiceFlowReset';
import Select from '../../components/Select';
import { Stepper, Actions } from '../../components/ServiceShell';
import { useAccounts } from '../../hooks/useAccounts';
import { createPPSChequeEntry, sendOtp, validateOtp } from '../../services/api';
import AccountDisplay from '../../components/AccountDisplay';
import { toInputDate } from '../../utils/date';

type Mode = 'entry' | 'view';
type Step = 'select' | 'form' | 'confirm' | 'otp' | 'submit' | 'result';

interface OperationResult {
  status: 'success' | 'error';
  title: string;
  message: string;
  refNo?: string;
}

interface EntryForm {
  accountNo: string;
  chequeNo: string;
  chequeAmount: string;
  issueDate: string;
  payeeName: string;
}

const ENTRY_STEPS = ['Enter Details', 'Review', 'Verify OTP', 'Submit', 'Done'];
const VIEW_STEPS = ['Select Service', 'Search', 'Result'];

const STEP_NUM: Record<Step, number> = { select: 0, form: 1, confirm: 2, otp: 3, submit: 4, result: 5 };

type FormErrors = Partial<Record<keyof EntryForm, string>>;

function OtpBoxes({
  onComplete,
  onResend,
  mobileLast3,
  disabled,
}: {
  onComplete: (otp: string) => void | Promise<void>;
  onResend: () => Promise<void>;
  mobileLast3: string;
  disabled?: boolean;
}) {
  const OTP_LENGTH = 5;
  const [digits, setDigits] = useState(Array(OTP_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const refs = Array.from({ length: OTP_LENGTH }, () => useRef<HTMLInputElement>(null));

  const reset = () => {
    setDigits(Array(OTP_LENGTH).fill(''));
    refs[0].current?.focus();
  };

  const submit = (otp: string) => {
    setVerifying(true);
    // Clear boxes on failure so the user can re-enter the OTP.
    Promise.resolve(onComplete(otp))
      .catch(() => reset())
      .finally(() => setVerifying(false));
  };

  const handleInput = (i: number, val: string) => {
    if (disabled || verifying) return;
    const clean = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < OTP_LENGTH - 1) refs[i + 1].current?.focus();
    if (next.every(d => d)) submit(next.join(''));
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
    if (pasted.length === OTP_LENGTH) submit(pasted);
  };

  const handleResend = async () => {
    setResendMsg('');
    reset();
    try {
      await onResend();
      setResendMsg('A new OTP has been sent ✓');
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Failed to resend OTP');
    }
  };

  return (
    <div className="otp-wrap">
      <div className="card-title" style={{ justifyContent: 'center' }}>
        <span className="ic">📱</span>OTP Verification
      </div>
      <p className="card-sub" style={{ marginBottom: 0 }}>
        Enter the 5-digit OTP sent to your registered mobile number ••{mobileLast3}
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
        <button type="button" onClick={handleResend}>Resend OTP</button>
      </p>
    </div>
  );
}

export default function PPS() {
  const { setCurrentStep, customer, serviceSubMode } = useFlow();
  const [mode, setMode] = useState<Mode>('entry');
  const [step, setStep] = useState<Step>('form');
  const [form, setForm] = useState<EntryForm>({ accountNo: '', chequeNo: '', chequeAmount: '', issueDate: '', payeeName: '' });
  const [viewChequeNo, setViewChequeNo] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [ppsStatus, setPpsStatus] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const resetToServiceHome = useServiceFlowReset('pps');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);

  const stepLabels = mode === 'view' ? VIEW_STEPS : ENTRY_STEPS;
  const curStep = STEP_NUM[step];

  useEffect(() => { setCurrentStep(curStep); }, [curStep, setCurrentStep]);

  useEffect(() => {
    const subMode = serviceSubMode?.trim().toLowerCase();
    if (!subMode) return;

    if (subMode === 'ss') {
      setMode('view');
      setStep('form');
      return;
    }

    if (subMode === 'pe' || subMode === 'entry') {
      setMode('entry');
      setStep('form');
    }
  }, [serviceSubMode]);

  const setField = (k: keyof EntryForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };
  const [reviewLoading, setReviewLoading] = useState(false);

  const selectedAccount = accounts.find(a => a.value === form.accountNo);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.accountNo) e.accountNo = 'Please select an account';
    if (!form.chequeNo.trim()) e.chequeNo = 'Cheque number is required';
    else if (!/^\d{6}$/.test(form.chequeNo.trim())) e.chequeNo = 'Cheque number must be 6 digits';

    const n = Number(form.chequeAmount);
    if (!form.chequeAmount.trim() || isNaN(n) || n <= 0) {
      e.chequeAmount = 'Enter a valid amount';
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
      const latest = new Date(today);
      latest.setMonth(latest.getMonth() + 3);

      if (issue < oldest) e.issueDate = 'Issue date cannot be more than 3 months old';
      else if (issue > latest) e.issueDate = 'Issue date cannot be more than 3 months in the future';
    }

    if (!form.payeeName.trim()) {
      e.payeeName = 'Payee name is required';
    } else if (!/^[A-Za-z\s]+$/.test(form.payeeName.trim())) {
      e.payeeName = 'Payee name must contain only letters and spaces';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const getMinIssueDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return toInputDate(date);
  };

  const getMaxIssueDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return toInputDate(date);
  };

  const restartEntryForm = () => {
    setMode('entry');
    setStep('form');
    setForm({ accountNo: '', chequeNo: '', chequeAmount: '', issueDate: '', payeeName: '' });
    setViewChequeNo('');
    setErrors({});
    setLoading(false);
    setApiError('');
    setOtpVerified(false);
  };

  const restart = (m?: Mode) => {
    if (m === 'entry' || !m) {
      restartEntryForm();
      return;
    }
    setMode(m);
    setStep('form');
    setForm({ accountNo: '', chequeNo: '', chequeAmount: '', issueDate: '', payeeName: '' });
    setViewChequeNo('');
    setErrors({});
    setLoading(false);
    setApiError('');
    setOtpVerified(false);
  };

  const reviewSummary = (
    <div className="sum">
      <div className="sumrow"><span className="k">Account</span><span className="v"><AccountDisplay account={selectedAccount} /></span></div>
      <div className="sumrow"><span className="k">Cheque Number</span><span className="v mono">{form.chequeNo}</span></div>
      <div className="sumrow"><span className="k">Amount</span><span className="v">₹ {Number(form.chequeAmount).toLocaleString('en-IN')}</span></div>
      <div className="sumrow"><span className="k">Issue Date</span><span className="v">{new Date(form.issueDate).toLocaleDateString('en-IN')}</span></div>
      <div className="sumrow"><span className="k">Payee Name</span><span className="v">{form.payeeName}</span></div>
    </div>
  );

  const sendOtpAndProceed = async () => {
    setLoading(true);
    setApiError('');
    setOtpVerified(false);
    try {
      await sendOtp(customer.mobileNo, 'PPSCREATE');
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
      await validateOtp(customer.mobileNo, otp, 'PPSCREATE');
      setOtpVerified(true);
      setStep('submit');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'OTP verification failed');
      throw err;
    }
  };

  const submitPpsEntry = async () => {
    setLoading(true);
    setApiError('');
    try {
      const entryPayload = {
        accountNo: form.accountNo,
        chequeNo: form.chequeNo.trim(),
        chequeAmount: form.chequeAmount.trim(),
        payeeName: form.payeeName.trim(),
        issueDate: form.issueDate,
        mobileNo: customer.mobileNo,
      };


      const result = await createPPSChequeEntry({ ...entryPayload, ppsProcess: 'P' });
      setPpsStatus(result.resStatus);
      setOperationResult({
        status: 'success',
        title: 'PPS Entry Submitted!',
        message: 'Your Positive Payment details have been registered. The cheque will be validated before payment processing.',
      });
      setStep('result');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Submission failed';
      setApiError(message);
      setOperationResult({
        status: 'error',
        title: 'PPS Submission Failed',
        message,
      });
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const renderView = () => {
    if (step === 'result' && operationResult) {
      return (
        <ServiceResultScreen
          variant={operationResult.status}
          title={operationResult.title}
          message={operationResult.message}
          refNo={operationResult.refNo}
          onCancel={resetToServiceHome}
        >
          {operationResult.status === 'success' && ppsStatus && (
            <div className="info-box" style={{ textAlign: 'left', maxWidth: 430, margin: '12px auto 0' }}>
              <span className="info-icon">✅</span>
              <span>Status: <strong>{ppsStatus}</strong></span>
            </div>
          )}
        </ServiceResultScreen>
      );
    }

    /* Choose a service — skipped; flow opens directly on Positive Payment Entry.
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
    */

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
                min={getMinIssueDate()}
                max={getMaxIssueDate()}
                value={form.issueDate}
                onChange={e => setField('issueDate', e.target.value)}
              />
              <p className="fhint">Must be within 3 months before or after today</p>
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
          {apiError && (
                <div className="note warn">
                  <span>⚠️</span>
                  <span>{apiError}</span>
                </div>
              )}
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
            <p className="card-sub">Confirm these match the physical cheque, then proceed to OTP verification.</p>
            {reviewSummary}
          </div>
        </>
      );
    }

    if (step === 'otp') {
      return (
        <div className="card">
          <OtpBoxes
            onComplete={handleOtpComplete}
            onResend={() => sendOtp(customer.mobileNo, 'PPSCREATE')}
            mobileLast3={customer.mobileNo.slice(-3)}
            disabled={loading}
          />
          {apiError && <p className="ferr" style={{ marginTop: 12, textAlign: 'center' }}>⚠ {apiError}</p>}
        </div>
      );
    }

    if (step === 'submit') {
      return (
        <>
          <div className="note warn">
            <span>⚠️</span>
            <span>OTP verified. Review once more and submit to register this cheque for Positive Payment.</span>
          </div>
          {/* {apiError && <div className="note warn"><span>⚠️</span><span>{apiError}</span></div>} */}
          <div className="card">
            <div className="card-title"><span className="ic">📤</span>Final submission</div>
            <p className="card-sub">Once submitted, changes cannot be made.</p>
            {reviewSummary}
          </div>
        </>
      );
    }

    return null;
  };

  const renderActions = () => {
    if (step === 'result') {
      return null;
    }
    /* Choose a service — skipped; flow opens directly on Positive Payment Entry.
    if (step === 'select') {
      return (
        <Actions>
          <button type="button" className="btn btn-primary" disabled={!mode} onClick={() => setStep('form')}>Continue →</button>
        </Actions>
      );
    }
    */

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
          <button type="button" className="btn btn-secondary" onClick={resetToServiceHome}>Cancel</button>
        </Actions>
      );
    }
    if (step === 'form') {
      const handleReview = async () => {
        if (!validate()) return;

        setReviewLoading(true);
        setApiError('');

        try {
          const payload = {
            accountNo: form.accountNo,
            chequeNo: form.chequeNo.trim(),
            chequeAmount: form.chequeAmount.trim(),
            payeeName: form.payeeName.trim(),
            issueDate: form.issueDate,
            mobileNo: customer.mobileNo,
          };

          await createPPSChequeEntry({ ...payload, ppsProcess: 'V' });

          // Validation successful
          setStep('confirm');
        } catch (err) {
          // Display API validation message
          setApiError(
            err instanceof Error ? err.message : 'Validation failed'
          );
        } finally {
          setReviewLoading(false);
        }
      };


      return (
        <Actions>
          <button
            type="button"
            className="btn btn-primary"
            disabled={reviewLoading}
            onClick={handleReview}
          >
            {reviewLoading ? 'Validating...' : 'Review →'}
          </button>
        </Actions>

      );
    }
    if (step === 'confirm') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => setStep('form')}>← Edit</button>
          <button type="button" className="btn btn-primary" disabled={loading} onClick={sendOtpAndProceed}>
            {loading ? 'Sending OTP…' : 'Continue to OTP Verification →'}
          </button>
          {/* {apiError && <p className="ferr" style={{ marginTop: 12 }}>⚠ {apiError}</p>} */}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={restartEntryForm}>
            Cancel
          </button>
        </Actions>
      );
    }
    if (step === 'otp') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => { setApiError(''); setStep('confirm'); }}>← Back</button>
          <button type="button" className="btn btn-secondary" onClick={restartEntryForm}>Cancel</button>
        </Actions>
      );
    }
    if (step === 'submit') {
      return (
        <Actions>
          <button type="button" className="btn btn-secondary" onClick={() => { setApiError(''); setStep('otp'); }} disabled={loading}>← Back</button>
          <button type="button" className="btn btn-primary" disabled={loading || !otpVerified} onClick={submitPpsEntry}>
            {loading ? 'Submitting…' : 'Submit PPS Entry →'}
          </button>
          {apiError && <p className="ferr" style={{ marginTop: 12 }}>⚠ {apiError}</p>}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={restartEntryForm}>
            Cancel
          </button>
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
