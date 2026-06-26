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
import AccountDisplay from '../../components/AccountDisplay';
import { formatDDMMYYYY } from '../../utils/date';
import { relationLabel } from '../../utils/relationLabel';
import { useFlow } from '../../context/FlowContext';
import ServiceResultScreen from '../../components/ServiceResultScreen';
import { useServiceFlowReset } from '../../hooks/useServiceFlowReset';
import { useAccounts } from '../../hooks/useAccounts';
import { useRelations } from '../../hooks/useRelations';
import { nomineeRegistration, sendOtp, validateOtp, verifyExistingNominees } from '../../services/bankingApi';

type Step = 'select' | 'confirm' | 'otp' | 'submit' | 'result';
const STEP_NUM: Record<Step, number> = { select: 1, confirm: 2, otp: 3, submit: 4, result: 5 };

interface OperationResult {
  status: 'success' | 'error';
  title: string;
  message: string;
  refNo?: string;
}

const EMPTY_NOMINEE: NomineeFieldValues = {
  nomineeName: '', nomineeDob: '', relation: '',
  guardianName: '', guardianDob: '', guardianRelation: '',
};

export default function Nominee() {
  const { setCurrentStep, customer } = useFlow();
  const [accountNo, setAccountNo] = useState('');
  const [step, setStep] = useState<Step>('select');
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [selectErrors, setSelectErrors] = useState({ accountNo: '' });
  const [loading, setLoading] = useState(false);
  const [refNo] = useState(() => 'NOM' + Date.now().toString().slice(-8));
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const resetToServiceHome = useServiceFlowReset('nominee');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const { relations } = useRelations('relation');
  const [nomineeExists, setNomineeExists] = useState<boolean | null>(null);
  const [nomineeData, setNomineeData] = useState<any[]>([]);
  const [checkingNominee, setCheckingNominee] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [apiError, setApiError] = useState('');
  const [resendMsg, setResendMsg] = useState('');

  useEffect(() => { setCurrentStep(STEP_NUM[step]); }, [step, setCurrentStep]);

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
  };

  const checkNominee = async (accountNumber: string) => {
    try {
      setCheckingNominee(true);

      const response = await verifyExistingNominees({
        accountNumber,
      });

      if (
        response?.status === '00' &&
        response?.nomineeList?.length > 0
      ) {
        setNomineeExists(true);
        setNomineeData(response.nomineeList);
      } else {
        setNomineeExists(false);
        setNomineeData([]);
      }
    } catch (error) {
      console.error('Error checking nominee:', error);
      setNomineeExists(false);
      setNomineeData([]);
    } finally {
      setCheckingNominee(false);
    }
  };

  const validateSelect = () => {
    const e = { accountNo: '' };
    if (!accountNo) e.accountNo = 'Please select an account';
    setSelectErrors(e);
    if (e.accountNo) return false;

    const ne = validateNomineeFields(nominee);
    setNomineeErrors(ne);
    return Object.keys(ne).length === 0;
  };

  const acc = accounts.find(a => a.value === accountNo);

  const isMinorNominee = nominee.nomineeDob
    ? (calcAge(nominee.nomineeDob) ?? 18) < 18
    : false;

  const reviewSummary = (
    <>
      <div className="summary-row summary-row-account"><span className="summary-key">Account</span><span className="summary-val"><AccountDisplay account={acc} /></span></div>
      <div className="divider" />
      <div className="section-heading">Nominee Details</div>
      <div className="summary-row"><span className="summary-key">Nominee Name</span><span className="summary-val">{nominee.nomineeName}</span></div>
      <div className="summary-row"><span className="summary-key">Date of Birth</span><span className="summary-val">{new Date(nominee.nomineeDob).toLocaleDateString('en-IN')}</span></div>
      <div className="summary-row"><span className="summary-key">Relationship</span><span className="summary-val">{relationLabel(relations, nominee.relation)}</span></div>
      <div className="summary-row"><span className="summary-key">Minor</span><span className="summary-val">{isMinorNominee ? 'Yes' : 'No'}</span></div>
      {isMinorNominee && (
        <>
          <div className="divider" />
          <div className="section-heading">Guardian Details</div>
          <div className="summary-row"><span className="summary-key">Guardian Name</span><span className="summary-val">{nominee.guardianName}</span></div>
          <div className="summary-row"><span className="summary-key">Guardian Date of Birth</span><span className="summary-val">{formatDDMMYYYY(nominee.guardianDob)}</span></div>
          <div className="summary-row"><span className="summary-key">Guardian Relation</span><span className="summary-val">{relationLabel(relations, nominee.guardianRelation)}</span></div>
        </>
      )}
    </>
  );

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setApiError('');

      const response = await nomineeRegistration({
        accountNumber: accountNo,
        nomineeName: nominee.nomineeName,
        nomineeDateOfBirth: nominee.nomineeDob,
        nomineeRelation: nominee.relation,
        nomineeisMinor: isMinorNominee ? 'Y' : 'N',
        guardianName: isMinorNominee ? nominee.guardianName : '',
        guardianDateOfBirth: isMinorNominee ? nominee.guardianDob : '',
        relationWithMinor: isMinorNominee ? nominee.guardianRelation : '',
      });

      if (response?.status === '00' || response?.errorCode === '00') {
        setOperationResult({
          status: 'success',
          title: 'Nominee Registered!',
          message: `Nominee details for account ${acc?.label ?? ''}${acc?.branchName ? ` (${acc.branchName})` : ''} have been registered successfully.`,
          refNo,
        });
        setStep('result');
      } else {
        const message = response?.errorMsg || 'Nominee registration failed';
        setApiError(message);
        setOperationResult({
          status: 'error',
          title: 'Nominee Registration Failed',
          message,
        });
        setStep('result');
      }
    } catch (error) {
      console.error('Nominee registration failed:', error);
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      setApiError(message);
      setOperationResult({
        status: 'error',
        title: 'Nominee Registration Failed',
        message,
      });
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const sendOtpAndProceed = async () => {
    setLoading(true);
    setApiError('');
    setOtpVerified(false);
    try {
      await sendOtp(customer.mobileNo, 'NOMINEEREGOTP');
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
      await validateOtp(customer.mobileNo, otp, 'NOMINEEREGOTP');
      setOtpVerified(true);
      setStep('submit');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'OTP verification failed');
      throw err;
    }
  };

  const resendOtp = async () => {
    setApiError('');
    setResendMsg('');
    try {
      await sendOtp(customer.mobileNo, 'NOMINEEREGOTP');
      setResendMsg('A new OTP has been sent ✓');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to resend OTP');
    }
  };

  if (step === 'result' && operationResult) {
    return (
      <ServiceResultScreen
        variant={operationResult.status}
        title={operationResult.title}
        message={operationResult.message}

        onCancel={resetToServiceHome}
      />
    );
  }

  /* ── ACCOUNT & NOMINEE DETAILS ── */
  if (step === 'select') return (
    <>
      <div className="flow-content">
        <div className="card">
          <div className="card-title"><span className="card-icon">👤</span>Nominee Registration</div>
          <div className="info-box">
            <span className="info-icon">ℹ️</span>
            <span>A nominee receives your account benefits in the event of your demise. Keep nominee details up-to-date.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Account Number <span className="required">*</span></label>
            <Select
              className={selectErrors.accountNo ? 'is-error' : ''}
              value={accountNo}
              placeholder="Select account"
              options={accounts}
              onChange={async v => {
                setAccountNo(v);
                setSelectErrors(s => ({ ...s, accountNo: '' }));

                if (v) {
                  await checkNominee(v);
                }
              }}
            />
            {accountsLoading && <p className="form-hint">Loading accounts…</p>}
            {selectErrors.accountNo && <p className="form-error">⚠ {selectErrors.accountNo}</p>}
          </div>

          {checkingNominee && (
            <p className="form-hint">Checking nominee details...</p>
          )}

          {nomineeExists === true && (
            <div className="info-box warning">
              <span>⚠️ Nominee already registered for this account.</span>

              {nomineeData.map((item, index) => (
                <div key={index}>
                  <strong>{item.nomineeName}</strong>
                </div>
              ))}
            </div>
          )}

          {nomineeExists === false && (
            <>
              <div className="section-heading">Nominee Details</div>
              <NomineeFields
                values={nominee}
                errors={nomineeErrors}
                onChange={setNomineeField}
                relationType="relation"
              />
            </>
          )}
        </div>
      </div>
      <Actions>
        <button
          className="btn btn-primary"
          disabled={nomineeExists === true || nomineeExists === null}
          onClick={() => {
            if (validateSelect() && nomineeExists !== true) {
              setStep('confirm');
            }
          }}
        >
          Review →
        </button>
      </Actions>
    </>
  );

  /* ── CONFIRM ── */
  if (step === 'confirm') {
    return (
      <>
        <div className="flow-content">
          <div className="alert alert-warning">
            <span>⚠️</span>
            <span>Verify all details, then proceed to OTP verification before final submission.</span>
          </div>
          {apiError && <div className="alert alert-warning"><span>⚠️</span><span>{apiError}</span></div>}
          <div className="card">
            <div className="card-title"><span className="card-icon">✅</span>Review Details</div>
            {reviewSummary}
          </div>
        </div>
        <Actions>
          <div className="btn-row">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('select')}>← Edit</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading}
              onClick={() => { if (validateSelect()) sendOtpAndProceed(); }}>
              {loading ? 'Sending OTP…' : 'Continue to OTP Verification →'}
            </button>
          </div>
          {/* {apiError && <p className="form-error" style={{ marginTop: 12 }}>⚠ {apiError}</p>} */}
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={resetToServiceHome}>
            Cancel
          </button>
        </Actions>
      </>
    );
  }

  /* ── OTP VERIFICATION ── */
  if (step === 'otp') return (
    <>
      <div className="flow-content">
        <div className="card otp-screen">
          <div className="card-title" style={{ justifyContent: 'center' }}><span className="card-icon">📱</span>OTP Verification</div>
          <p className="otp-subtitle">Enter the 5-digit OTP sent to your registered mobile number to verify before final submission</p>
          {apiError && <p className="form-error">⚠ {apiError}</p>}
          <OTPInput
            onComplete={async (otp) => {
              setLoading(true);
              try {
                await handleOtpComplete(otp);
              } finally {
                setLoading(false);
              }
            }}
          />
          {loading && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Verifying…</p>}
          {resendMsg && <p className="form-hint" style={{ color: 'var(--success)' }}>{resendMsg}</p>}
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

  /* ── FINAL SUBMIT ── */
  if (step === 'submit') {
    return (
      <>
        <div className="flow-content">
          <div className="alert alert-warning">
            <span>⚠️</span>
            <span>OTP verified. Review once more and submit to register the nominee.</span>
          </div>
          {apiError && <div className="alert alert-warning"><span>⚠️</span><span>{apiError}</span></div>}
          <div className="card">
            <div className="card-title"><span className="card-icon">📤</span>Final Submission</div>
            <p className="card-sub" style={{ marginBottom: 12 }}>Once submitted, changes cannot be made from this flow.</p>
            {reviewSummary}
          </div>
        </div>
        <Actions>
          <div className="btn-row">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('otp')} disabled={loading}>← Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading || !otpVerified}
              onClick={handleSubmit}>
              {loading ? 'Submitting…' : 'Submit Nominee Registration →'}
            </button>
          </div>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={resetToServiceHome}>
            Cancel
          </button>
        </Actions>
      </>
    );
  }

  return null;
}
