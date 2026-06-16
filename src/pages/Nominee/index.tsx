import { useState, useEffect } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import NomineeFields, { type NomineeFieldValues, type NomineeFieldErrors, validateNomineeFields } from '../../components/NomineeFields';
import { formatDDMMYYYY } from '../../utils/date';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome } from '../../hooks/useRedirectHome';
import { useAccounts } from '../../hooks/useAccounts';
import { nomineeRegistration, sendOtp, validateOtp, verifyExistingNominees } from '../../services/bankingApi';

type NomineeType = 'new' | 'update';
type Step = 'select' | 'otp' | 'form' | 'confirm' | 'success';
const STEP_NUM: Record<Step, number> = { select: 1, otp: 2, form: 3, confirm: 4, success: 5 };

const EMPTY_NOMINEE: NomineeFieldValues = {
  nomineeName: '', nomineeDob: '', relation: '',
  guardianName: '', guardianDob: '', guardianRelation: '',
};

export default function Nominee() {
  const { setCurrentStep, customer } = useFlow();
  const [accountNo, setAccountNo] = useState('');
  const [type, setType] = useState<NomineeType | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [selectErrors, setSelectErrors] = useState({ accountNo: '', type: '' });
  const [loading, setLoading] = useState(false);
  const [refNo] = useState(() => 'NOM' + Date.now().toString().slice(-8));
  useRedirectHome(step === 'success');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const [nomineeExists, setNomineeExists] = useState<boolean | null>(null);
  const [nomineeData, setNomineeData] = useState<any[]>([]);
  const [checkingNominee, setCheckingNominee] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [apiError, setApiError] = useState('');

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
    const e = { accountNo: '', type: '' };
    if (!accountNo) e.accountNo = 'Please select an account';
    if (!type) e.type = 'Please select nominee action';
    setSelectErrors(e);
    return !e.accountNo && !e.type;
  };

  const validateForm = () => {
    const e = validateNomineeFields(nominee);
    setNomineeErrors(e);
    return Object.keys(e).length === 0;
  };

  const acc = accounts.find(a => a.value === accountNo);


  const handleSubmit = async () => {
    try {
      setLoading(true);

      const isMinorNominee =
        nominee.nomineeDob
          ? (new Date().getFullYear() - new Date(nominee.nomineeDob).getFullYear()) < 18
          : false;

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
        setStep('success');
      } else {
        alert(response?.errorMsg || 'Nominee registration failed');
      }
    } catch (error) {
      console.error('Nominee registration failed:', error);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendOtpAndProceed = async () => {
    setLoading(true);
    setApiError('');
    setOtpVerified(false);
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
      setOtpVerified(true);
      //setStep('submit');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'OTP verification failed');
      throw err;
    }
  };

  /* ── SUCCESS ── */
  if (step === 'success') return (
    <>      <div className="flow-content">
      <div className="success-screen">
        <div className="success-icon">✅</div>
        <h2 className="success-title">Nominee {type === 'new' ? 'Registered' : 'Updated'}!</h2>
        <p className="success-msg">Nominee details for account {acc?.label} have been {type === 'new' ? 'registered' : 'updated'} successfully.</p>
        <div className="ref-box">
          <div className="ref-label">Reference Number</div>
          <div className="ref-value">{refNo}</div>
        </div>
        <p className="redirect-hint">Redirecting to home…</p>
      </div>
    </div>
    </>
  );

  /* ── SELECT ACCOUNT & TYPE ── */
  if (step === 'select') return (
    <>      <div className="flow-content">
      <div className="card">
        <div className="card-title"><span className="card-icon">👤</span>Nominee Registration</div>
        <div className="info-box">
          <span className="info-icon">ℹ️</span>
          <span>A nominee receives your account benefits in the event of your demise. Keep nominee details up-to-date.</span>
        </div>

        {/* Account No — Selection Drop Down */}
        <div className="form-group">
          <label className="form-label">Account Number <span className="required">*</span></label>
          {/* className={selectErrors.accountNo ? 'is-error' : ''}
          value={accountNo} */}
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

        {/* Nominee Action — Radio Button */}
        {!nomineeExists && (<div className="form-group">
          <label className="form-label">Nominee Action <span className="required">*</span></label>
          <div className="radio-group">
            <label className={`radio-option ${type === 'new' ? 'selected' : ''}`}>
              <input type="radio" name="nomineeType" checked={type === 'new'} onChange={() => { setType('new'); setSelectErrors(s => ({ ...s, type: '' })); }} />
              <div>
                <div className="radio-label">New Nominee</div>
                <div className="radio-desc">Register a nominee for the first time</div>
              </div>
            </label>
            {/* <label className={`radio-option ${type === 'update' ? 'selected' : ''}`}>
              <input type="radio" name="nomineeType" checked={type === 'update'} onChange={() => { setType('update'); setSelectErrors(s => ({ ...s, type: '' })); }} />
              <div>
                <div className="radio-label">Update Nominee</div>
                <div className="radio-desc">Modify existing nominee details</div>
              </div>
            </label> */}
          </div>
          {selectErrors.type && <p className="form-error">⚠ {selectErrors.type}</p>}
        </div>)}
        {checkingNominee && (
          <p className="form-hint">Checking nominee details...</p>
        )}

        {nomineeExists === true && (
          <div className="info-box warning">
            <span>⚠️ Nominee already registered for this account.</span>

            {nomineeData.map((nominee, index) => (
              <div key={index}>
                <strong>{nominee.nomineeName}</strong>
              </div>
            ))}
          </div>
        )}

        {nomineeExists === false && (
          <div className="info-box success">
            <span>✅ No nominee found. You can proceed with registration.</span>
          </div>
        )}
      </div>
    </div>
      <Actions>
        <button
          className="btn btn-primary"
          disabled={loading || nomineeExists === true}
          onClick={async () => {
            if (validateSelect() && nomineeExists !== true) {
              await sendOtpAndProceed();
            }
          }}
        >
          {loading ? 'Sending OTP...' : 'Continue →'}
        </button>
      </Actions>
    </>
  );

  /* ── OTP VERIFICATION ── */
  if (step === 'otp') return (
    <>      <div className="flow-content">
      <div className="card otp-screen">
        <div className="card-title" style={{ justifyContent: 'center' }}><span className="card-icon">📱</span>OTP Verification</div>
        <p className="otp-subtitle">Enter the 5-digit OTP sent to your registered mobile number to proceed with nominee {type === 'new' ? 'registration' : 'update'}</p>
        <OTPInput
          onComplete={async (otp) => {
            setLoading(true);

            try {
              await handleOtpComplete(otp);
              setStep('form');
            } finally {
              setLoading(false);
            }
          }}
        />
        {loading && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Verifying…</p>}
        <p className="resend-text">Didn't receive OTP? <span className="resend-link">Resend OTP</span></p>
      </div>
    </div>
      <Actions>
        <button className="btn btn-secondary" onClick={() => setStep('select')}>← Back</button>
      </Actions>
    </>
  );

  /* ── NOMINEE DETAILS FORM ── */
  if (step === 'form') return (
    <>      <div className="flow-content">
      <div className="card">
        <div className="card-title"><span className="card-icon">✏️</span>Nominee Details</div>
        {/* Nominee Name — Input text */}
        {/* Nominee DOB — Calendar selection */}
        {/* Relationship — Drop down */}
        {/* Nominee Minor — auto-calculated from DOB */}
        {/* Guardian fields if minor */}
        <NomineeFields values={nominee} errors={nomineeErrors} onChange={setNomineeField} />
      </div>
    </div>
      <Actions>
        <div className="btn-row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('otp')}>← Back</button>
          <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => { if (validateForm()) setStep('confirm'); }}>
            Review →
          </button>
        </div>
      </Actions>
    </>
  );

  /* ── CONFIRM ── */
  if (step === 'confirm') {
    const isMinorNominee = nominee.nomineeDob
      ? (new Date().getFullYear() - new Date(nominee.nomineeDob).getFullYear()) < 18
      : false;
    return (
      <>        <div className="flow-content">
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>Verify all details before confirming the nominee {type === 'new' ? 'registration' : 'update'}.</span>
        </div>
        <div className="card">
          <div className="card-title"><span className="card-icon">✅</span>Review Details</div>
          <div className="summary-row"><span className="summary-key">Account</span><span className="summary-val">{acc?.label}</span></div>
          <div className="summary-row"><span className="summary-key">Action</span><span className="summary-val">{type === 'new' ? 'New Nominee' : 'Update Nominee'}</span></div>
          <div className="divider" />
          <div className="summary-row"><span className="summary-key">Nominee Name</span><span className="summary-val">{nominee.nomineeName}</span></div>
          <div className="summary-row"><span className="summary-key">Date of Birth</span><span className="summary-val">{new Date(nominee.nomineeDob).toLocaleDateString('en-IN')}</span></div>
          <div className="summary-row"><span className="summary-key">Relationship</span><span className="summary-val">{nominee.relation}</span></div>
          <div className="summary-row"><span className="summary-key">Minor</span><span className="summary-val">{isMinorNominee ? 'Yes' : 'No'}</span></div>
          {isMinorNominee && <>
            <div className="divider" />
            <div className="summary-row"><span className="summary-key">Guardian Name</span><span className="summary-val">{nominee.guardianName}</span></div>
            <div className="summary-row"><span className="summary-key">Guardian Date of Birth</span><span className="summary-val">{formatDDMMYYYY(nominee.guardianDob)}</span></div>
            <div className="summary-row"><span className="summary-key">Guardian Relation</span><span className="summary-val">{nominee.guardianRelation}</span></div>
          </>}
        </div>
      </div>
        <Actions>
          <div className="btn-row">
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('form')}>← Edit</button>
            <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading}
              onClick={handleSubmit}>
              {loading ? 'Submitting…' : 'Submit →'}
            </button>
          </div>
        </Actions>
      </>
    );
  }

  return null;
}


