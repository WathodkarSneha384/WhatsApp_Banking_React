import { useState, useEffect, useMemo } from 'react';
import OTPInput from '../../components/OTPInput';
import Select from '../../components/Select';
import { Actions } from '../../components/ServiceShell';
import NomineeFields, { type NomineeFieldValues, type NomineeFieldErrors, validateNomineeFields } from '../../components/NomineeFields';
import { useFlow } from '../../context/FlowContext';
import { useRedirectHome } from '../../hooks/useRedirectHome';
import { useAccounts } from '../../hooks/useAccounts';
import {
  getInterestPayModeOptions,
  isInterestPayModeReadonly,
  isPeriodicInterestPayMode,
  RENEWAL_REQUIRED_OPTIONS,
  resolveInterestPayMode,
  toAutoRenewalFlag,
  toInterestPayModeApiCode,
  toRenewalApiCode,
  type RenewalRequired,
} from '../../utils/fdRenewalRules';
import { useCalculateMaturity } from '../../hooks/useCalculateMaturity';
import { useOtpCountdown } from '../../hooks/useOtpCountdown';
import { formatDDMMYYYY } from '../../utils/date';
import { openFDAccount, sendOtp, validateOtp, verifyExistingNominees } from '../../services/bankingApi';

type NomineeSource = 'existing' | 'new' | 'no';
type Step = 'form' | 'confirm' | 'otp' | 'success';
const STEP_NUM: Record<Step, number> = { form: 1, confirm: 2, otp: 3, success: 4 };

interface FDForm {
  savingAccount: string;
  depositAmount: string;
  depositType: string;
  renewalRequired: RenewalRequired | '';
  interestPayMode: string;
  periodType: string;
  depositPeriod: string;
  nomineeSource: NomineeSource | '';
}

type FDErrors = Partial<Record<keyof FDForm, string>>;

const FD_FIELD_ORDER: (keyof FDForm)[] = [
  'savingAccount',
  'depositAmount',
  'depositType',
  'renewalRequired',
  'interestPayMode',
  'periodType',
  'depositPeriod',
  'nomineeSource',
];

const NOMINEE_FIELD_ORDER: (keyof NomineeFieldErrors)[] = [
  'nomineeName',
  'nomineeDob',
  'relation',
  'guardianName',
  'guardianDob',
  'guardianRelation',
];

function fdFieldId(field: keyof FDForm | keyof NomineeFieldErrors): string {
  if (field === 'periodType') return 'fd-periodType-days';
  if (NOMINEE_FIELD_ORDER.includes(field as keyof NomineeFieldErrors)) {
    return `fd-${field}`;
  }
  return `fd-${field}`;
}

function focusFormField(fieldId: string) {
  requestAnimationFrame(() => {
    const el = document.getElementById(fieldId);
    if (!el) return;
    if (el instanceof HTMLInputElement || el instanceof HTMLButtonElement || el instanceof HTMLSelectElement) {
      el.focus({ preventScroll: false });
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

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
    renewalRequired: '', interestPayMode: '', periodType: '', depositPeriod: '',
    nomineeSource: '',
  });
  const [errors, setErrors] = useState<FDErrors>({});
  const [nominee, setNominee] = useState<NomineeFieldValues>(EMPTY_NOMINEE);
  const [nomineeErrors, setNomineeErrors] = useState<NomineeFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [refNo] = useState(() => 'FD' + Date.now().toString().slice(-8));
  const [fdAccNo] = useState(() => 'FD' + Math.floor(Math.random() * 9000000 + 1000000));
  useRedirectHome(step === 'success');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const [existingNominee, setExistingNominee] = useState<any>(null);
  const [nomineeLoading, setNomineeLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const otpCountdown = useOtpCountdown(step === 'otp');

  const {
    maturityData,
    loading: maturityLoading,
  } = useCalculateMaturity(
    form.depositAmount,
    '02',
    form.periodType === 'Months' ? form.depositPeriod : '0',
    form.periodType === 'Days' ? form.depositPeriod : '0',
    form.periodType as 'Days' | 'Months' | '',
    form.depositType as 'Simple' | 'Compound' | '',
    form.interestPayMode,
  );
  const fetchExistingNominee = async (accountNumber: string) => {
    if (!accountNumber) {
      setExistingNominee(null);
      return;
    }

    try {
      setNomineeLoading(true);

      const response = await verifyExistingNominees({
        accountNumber,
      });

      if (
        response?.status === '00' ||
        response?.errorCode === '00'
      ) {
        setExistingNominee(response.nomineeList?.[0] || null);
      } else {
        setExistingNominee(null);
      }
    } catch (error) {
      console.error('Error fetching nominee:', error);
      setExistingNominee(null);
    } finally {
      setNomineeLoading(false);
    }
  };

  const nomineeOptions = useMemo(() => {
    const options: { value: NomineeSource; label: string }[] = [];
    if (existingNominee) {
      options.push({
        value: 'existing',
        label: existingNominee.nomineeName
          ? 'Debit Account Nominee'
          : 'Debit Account Nominee',
      });
    }
    options.push({
      value: 'new',
      label: 'Add New Nominee',
    });
    options.push({
      value: 'no',
      label: 'Nominee Not Required',
    });
    return options;
  }, [existingNominee]);

  useEffect(() => {
    if (!existingNominee && form.nomineeSource === 'existing') {
      setForm(prev => ({
        ...prev,
        nomineeSource: '',
      }));
    }
  }, [existingNominee, form.nomineeSource]);

  useEffect(() => {
    if (form.savingAccount) {
      fetchExistingNominee(form.savingAccount);
    } else {
      setExistingNominee(null);
    }
  }, [form.savingAccount]);

  const applyFdRules = (
    next: FDForm,
    changed: 'depositType' | 'renewalRequired',
  ): FDForm => {
    const depositType = next.depositType as 'Simple' | 'Compound' | '';
    const renewalRequired = next.renewalRequired;

    if (changed === 'depositType') {
      next.renewalRequired = '';
      next.interestPayMode = '';
      return next;
    }

    next.interestPayMode = resolveInterestPayMode(
      depositType,
      renewalRequired,
      '',
    );

    return next;
  };

  const set = <K extends keyof FDForm>(k: K, v: FDForm[K]) => {
    setForm((f) => {
      const updated = { ...f, [k]: v };
      if (k === 'depositType') return applyFdRules(updated, 'depositType');
      if (k === 'renewalRequired') return applyFdRules(updated, 'renewalRequired');
      return updated;
    });
    setErrors((e) => ({ ...e, [k]: '' }));
  };

  const setNomineeField = (k: keyof NomineeFieldValues, v: string) => {
    setNominee(n => ({ ...n, [k]: v }));
    setNomineeErrors(e => ({ ...e, [k]: '' }));
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
      // 1. Verify OTP
      await validateOtp(
        customer.mobileNo,
        otp,
        'TDACCOUNTOPEN'
      );

      // 2. Open FD after OTP success
      const response = await openFDAccount({
        customerCode: customer.customerId,
        depositAmount: form.depositAmount,

        months:
          form.periodType === 'Months'
            ? Number(form.depositPeriod)
            : 0,

        days:
          form.periodType === 'Days'
            ? Number(form.depositPeriod)
            : 0,

        debitAccountNumber: form.savingAccount,
        repayAccountNumber: form.savingAccount,

        closeonMaturity: 'Y',
        autoRenewal: toAutoRenewalFlag(form.renewalRequired as RenewalRequired),
        renewalType: toRenewalApiCode(form.renewalRequired as RenewalRequired),

        depositType:
          form.depositType === 'Simple'
            ? 'S'
            : 'C',

        interestPayMode: toInterestPayModeApiCode(form.interestPayMode),

        nomineeRequired: form.nomineeSource === 'no' ? 'N' : 'Y',

        nomineeAsdebitAccount:
          form.nomineeSource === 'existing'
            ? 'Y'
            : 'N',

        nomineeisMinor: 'N',
      });

      console.log('FD Open Response', response);

      // Optional:
      // setFdAccNo(response.fdAccountNo);

      setStep('success');
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : 'FD opening failed'
      );
      throw err;
    }
  };


  const validate = (): boolean => {
    const e: FDErrors = {};
    if (!form.savingAccount) e.savingAccount = 'Please select an account';
    if (!form.depositAmount.trim() || isNaN(Number(form.depositAmount)) || Number(form.depositAmount) < 1000)
      e.depositAmount = 'Minimum deposit is ₹1,000';
    if (!form.depositType) e.depositType = 'Please select deposit type';
    if (!form.renewalRequired) e.renewalRequired = 'Please select renewal option';
    if (!form.interestPayMode) e.interestPayMode = 'Please select interest pay mode';
    if (!form.periodType) e.periodType = 'Please select period type';
    if (!form.depositPeriod.trim() || isNaN(Number(form.depositPeriod)) || Number(form.depositPeriod) < 1)
      e.depositPeriod = 'Enter a valid deposit period';
    if (!form.nomineeSource) e.nomineeSource = 'Please select nominee option';

    const ne: NomineeFieldErrors = form.nomineeSource === 'new'
      ? validateNomineeFields(nominee)
      : {};

    setErrors(e);
    setNomineeErrors(ne);

    for (const field of FD_FIELD_ORDER) {
      if (e[field]) {
        focusFormField(fdFieldId(field));
        return false;
      }
    }

    for (const field of NOMINEE_FIELD_ORDER) {
      if (ne[field]) {
        focusFormField(fdFieldId(field));
        return false;
      }
    }

    return true;
  };

  const handleReview = () => {
    if (validate()) setStep('confirm');
  };

  const handleResendOtp = async () => {
    if (!otpCountdown.expired) return;
    setLoading(true);
    setApiError('');
    try {
      await sendOtp(customer.mobileNo, 'TDACCOUNTOPEN');
      otpCountdown.restart();
      setApiError('');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const acc = accounts.find(a => a.value === form.savingAccount);
  const interestModes = getInterestPayModeOptions(
    form.depositType as 'Simple' | 'Compound' | '',
    form.renewalRequired,
  );
  const interestPayModeReadonly = isInterestPayModeReadonly(
    form.depositType as 'Simple' | 'Compound' | '',
    form.renewalRequired,
  );

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

        <div className="form-group">
          <label className="form-label">Debit Savings Account <span className="required">*</span></label>
          <Select
            id="fd-savingAccount"
            className={errors.savingAccount ? 'is-error' : ''}
            value={form.savingAccount}
            placeholder="Select savings account"
            options={accounts}
            onChange={v => set('savingAccount', v)}
          />
          {accountsLoading && <p className="form-hint">Loading accounts…</p>}
          {errors.savingAccount && <p className="form-error">⚠ {errors.savingAccount}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Deposit Amount (₹) <span className="required">*</span></label>
          <input
            id="fd-depositAmount"
            className={`form-input ${errors.depositAmount ? 'is-error' : ''}`}
            placeholder="Minimum ₹1,000"
            value={form.depositAmount}
            inputMode="decimal"
            onChange={e => set('depositAmount', e.target.value)}
          />
          {errors.depositAmount && <p className="form-error">⚠ {errors.depositAmount}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Deposit Type <span className="required">*</span></label>
          <Select
            id="fd-depositType"
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

        <div className="form-group">
          <label className="form-label">Renewal <span className="required">*</span></label>
          <Select
            id="fd-renewalRequired"
            className={errors.renewalRequired ? 'is-error' : ''}
            value={form.renewalRequired}
            placeholder="Select renewal option"
            options={RENEWAL_REQUIRED_OPTIONS}
            disabled={!form.depositType}
            onChange={v => set('renewalRequired', v as RenewalRequired)}
          />
          {!form.depositType && (
            <p className="form-hint">Select deposit type first</p>
          )}
          {errors.renewalRequired && <p className="form-error">⚠ {errors.renewalRequired}</p>}
        </div>

        <div className="form-group">
          <label className="form-label">Interest Pay Mode <span className="required">*</span></label>
          <Select
            id="fd-interestPayMode"
            className={errors.interestPayMode ? 'is-error' : ''}
            value={form.interestPayMode}
            placeholder="Select mode"
            options={interestModes.map(m => ({ value: m, label: m }))}
            disabled={!form.depositType || !form.renewalRequired || interestPayModeReadonly}
            onChange={v => set('interestPayMode', v)}
          />
          {interestPayModeReadonly && form.interestPayMode && (
            <p className="form-hint">Interest pay mode is set automatically for this deposit and renewal combination.</p>
          )}
          {errors.interestPayMode && <p className="form-error">⚠ {errors.interestPayMode}</p>}
        </div>

        <div className="form-grid-2">
          <div className="form-group form-group-full">
            <label className="form-label">Period Type <span className="required">*</span></label>
            <div className="radio-group horizontal">
              {(['Days', 'Months'] as const).map(t => (
                <label key={t} className={`radio-option ${form.periodType === t ? 'selected' : ''}`}>
                  <input
                    id={t === 'Days' ? 'fd-periodType-days' : 'fd-periodType-months'}
                    type="radio"
                    name="periodType"
                    checked={form.periodType === t}
                    onChange={() => set('periodType', t)}
                  />
                  <span className="radio-label">{t}</span>
                </label>
              ))}
            </div>
            {errors.periodType && <p className="form-error">⚠ {errors.periodType}</p>}
          </div>

          <div className="form-group form-group-full">
            <label className="form-label">Deposit Period <span className="required">*</span></label>
            <input
              id="fd-depositPeriod"
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

        {/* <div className="form-group">
          <label className="form-label">Interest Rate (% p.a.)</label>
          <input
            className="form-input form-input-readonly"
            value={interestRateLabel}
            readOnly
            aria-readonly="true"
            tabIndex={-1}
          />
          <p className="form-hint">
            {interestRateLoading
              ? 'Fetching applicable rate from bank…'
              : 'Rate is fetched automatically based on deposit type and tenure.'}
          </p>
        </div> */}
        {maturityLoading && (
          <p className="form-hint">Calculating maturity amount…</p>
        )}
        {maturityData && (
          <div className="card fd-preview-card">
            <div className="card-title fd-preview-title">
              <span className="card-icon">📊</span>Maturity Preview
            </div>
            <div className="summary-row">
              <span className="summary-key">Interest Type</span>
              <span className="summary-val">{form.depositType}</span>
            </div>
            <div className="summary-row">
              <span className="summary-key">Interest Rate</span>
              <span className="summary-val">{maturityData.interestRate}% p.a.</span>
            </div>
            <div className="summary-row">
              <span className="summary-key">Interest Earned</span>
              <span className="summary-val">
                ₹ {Number(maturityData.interestAmount).toLocaleString('en-IN', {
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-key">Maturity Date</span>
              <span className="summary-val">
                {formatDDMMYYYY(maturityData.maturityDate)}
              </span>
            </div>
            <div className="summary-row">
              <span className="summary-key">Maturity Amount</span>
              <span className="summary-val fd-maturity-amount">
                ₹ {maturityData.maturityAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
            </div>
            {isPeriodicInterestPayMode(form.interestPayMode) && (
              <p className="form-hint fd-preview-note">
                Interest is paid {form.interestPayMode.toLowerCase()}; maturity amount is the principal returned at tenure end.
              </p>
            )}
            {maturityData.isEstimate && (
              <p className="form-hint fd-preview-note">
                Estimated preview — final values are confirmed at account opening.
              </p>
            )}
          </div>
        )}

        <div className="divider" />

        <div className="form-group">
          <label className="form-label">Add Nominee <span className="required">*</span></label>
          <Select
            id="fd-nomineeSource"
            className={errors.nomineeSource ? 'is-error' : ''}
            value={form.nomineeSource}
            placeholder={nomineeLoading ? 'Loading nominee options…' : 'Select nominee option'}
            options={nomineeOptions}
            disabled={nomineeLoading}
            onChange={v => set('nomineeSource', v as NomineeSource)}
          />
          {errors.nomineeSource && <p className="form-error">⚠ {errors.nomineeSource}</p>}
        </div>
        {nomineeLoading && (
          <p className="form-hint">Fetching nominee details...</p>
        )}

        {form.nomineeSource === 'existing' && existingNominee && (
          <div className="info-box" style={{ marginTop: 10 }}>
            <span className="info-icon">👤</span>
            <span>
              Existing Nominee :
              <strong>
                {' '}
                {existingNominee.nomineeName}
              </strong>
            </span>
          </div>
        )}

        {form.nomineeSource === 'new' && (
          <>
            <div className="section-heading">Nominee Details</div>
            <NomineeFields
              values={nominee}
              errors={nomineeErrors}
              onChange={setNomineeField}
              relationType="relation"
              fieldIdPrefix="fd"
            />
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
        <button className="btn btn-primary" onClick={handleReview}>
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
        <div className="summary-row"><span className="summary-key">Renewal</span><span className="summary-val">{form.renewalRequired}</span></div>
        <div className="summary-row"><span className="summary-key">Interest Pay Mode</span><span className="summary-val">{form.interestPayMode}</span></div>
        <div className="summary-row"><span className="summary-key">Period</span><span className="summary-val">{form.depositPeriod} {form.periodType}</span></div>
        {maturityData && <>
          <div className="summary-row"><span className="summary-key">Maturity Date</span><span className="summary-val">{formatDDMMYYYY(maturityData.maturityDate)}</span></div>
          <div className="summary-row"><span className="summary-key">Interest Earned</span><span className="summary-val">₹ {maturityData.interestAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
          <div className="summary-row"><span className="summary-key">Maturity Amount</span><span className="summary-val">₹ {maturityData.maturityAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span></div>
        </>}
        <div className="summary-row"><span className="summary-key">Interest Rate</span><span className="summary-val">{maturityData?.interestRate != null ? `${maturityData.interestRate}% p.a.` : '—'}</span></div>
        <div className="divider" />
        <div className="summary-row"><span className="summary-key">Nominee</span><span className="summary-val">{form.nomineeSource === 'existing'
          ? 'Account Nominee'
          : form.nomineeSource === 'new'
            ? 'New Nominee'
            : 'Nominee Not Required'}</span></div>
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
            onClick={sendOtpAndProceed}>
            {loading ? 'Sending OTP…' : 'Confirm & Get OTP →'}
          </button>
        </div>
        {apiError && <p className="form-error" style={{ marginTop: 12 }}>⚠ {apiError}</p>}
      </Actions>
    </>
  );

  /* ── OTP ── */
  if (step === 'otp') return (
    <>      <div className="flow-content">
      <div className="card otp-screen">
        <div className="card-title" style={{ justifyContent: 'center' }}><span className="card-icon">📱</span>OTP Verification</div>
        <p className="otp-subtitle">Enter the 5-digit OTP sent to your registered mobile number to authorise the FD</p>
        <p className="form-hint" style={{ textAlign: 'center', marginBottom: 12 }}>
          {otpCountdown.expired
            ? 'OTP has expired. Please request a new OTP.'
            : `OTP expires in ${otpCountdown.label}`}
        </p>
        <OTPInput
          onComplete={async (otp) => {
            if (otpCountdown.expired) {
              setApiError('OTP has expired. Please tap Resend OTP.');
              return;
            }
            setLoading(true);
            try {
              await handleOtpComplete(otp);
            } finally {
              setLoading(false);
            }
          }}
        />
        {loading && <p style={{ marginTop: 14, fontSize: 13, color: 'var(--text-muted)' }}>Verifying…</p>}
        {apiError && <p className="form-error" style={{ marginTop: 14 }}>⚠ {apiError}</p>}
        <p className="resend-text">
          Didn't receive OTP?{' '}
          <button
            type="button"
            className="resend-link"
            style={{ background: 'none', border: 'none', padding: 0, cursor: otpCountdown.expired && !loading ? 'pointer' : 'not-allowed', opacity: otpCountdown.expired && !loading ? 1 : 0.5 }}
            disabled={!otpCountdown.expired || loading}
            onClick={handleResendOtp}
          >
            Resend OTP
          </button>
        </p>
      </div>
    </div>
      <Actions>
        <button className="btn btn-secondary" onClick={() => setStep('confirm')}>← Back</button>
      </Actions>
    </>
  );

  return null;
}
