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
import type { PMSocialSubservice } from '../../types';
import { doProcessAPYPolicy, doProcessPMJJBYSBY, sendOtp, validateOtp } from '../../services/api';
import AccountDisplay from '../../components/AccountDisplay';
import { formatInstallmentDisplayDate } from '../../utils/date';
import {
  PENSION_AMOUNT_OPTIONS,
  fetchPmSchemePreInsAmount,
  getPmapyInstallmentAmount,
  parsePmSchemePremiumFromApi,
  type PmapyInstallmentFrequency,
  type PmSchemePremiumFromApi,
} from '../../utils/pmPremium';
import { relationLabel } from '../../utils/relationLabel';
import { getInsufficientBalanceError } from '../../utils/accountBalance';
import ConsentCheckboxes from '../../components/ConsentCheckboxes';
import { useConsentState } from '../../hooks/useConsentState';

type RuralOrUrban = 'Rural' | 'Urban';
type Step = 'form' | 'confirm' | 'otp' | 'submit' | 'result';
const STEP_NUM: Record<Step, number> = { form: 1, confirm: 2, otp: 3, submit: 4, result: 5 };

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
  const [otpVerified, setOtpVerified] = useState(false);
  const [operationResult, setOperationResult] = useState<OperationResult | null>(null);
  const consent = useConsentState();
  const resetToServiceHome = useServiceFlowReset('pmsocial');

  const { accounts, loading: accountsLoading } = useAccounts(customer.customerId || null);
  const { relations } = useRelations('pmyrelation');
  const [schemePremium, setSchemePremium] = useState<PmSchemePremiumFromApi | null>(null);
  const [schemePremiumLoading, setSchemePremiumLoading] = useState(false);
  const [schemeMessage, setSchemeMessage] = useState('');
  const [schemeEligible, setSchemeEligible] = useState(true);
  const [apyPremium, setApyPremium] = useState<PmSchemePremiumFromApi | null>(null);
  const [apyPremiumLoading, setApyPremiumLoading] = useState(false);
  const [apyMessage, setApyMessage] = useState('');
  const [apyEligible, setApyEligible] = useState(true);


  useEffect(() => {
    const fetchSchemePremium = async () => {
      if (subservice !== 'PMJJBY' && subservice !== 'PMSBY') {
        setSchemePremium(null);
        return;
      }

      if (!customer.customerId) {
        setSchemePremium(null);
        return;
      }

      setSchemePremiumLoading(true);
      try {
        const response = await fetchPmSchemePreInsAmount(customer.customerId, subservice);

        if (!response) {
          setSchemePremium(null);
          return;
        }

        if (response.errorCode !== '00') {
          setSchemeEligible(false);
          setSchemePremium(null);
          setSchemeMessage(response.errorMsg || 'Unable to fetch premium details');
          return;
        }

        setSchemeEligible(true);
        setSchemeMessage('');
        setSchemePremium(parsePmSchemePremiumFromApi(response));
      } finally {
        setSchemePremiumLoading(false);
      }
    };

    fetchSchemePremium();
  }, [subservice, customer.customerId]);

  useEffect(() => {
    const fetchApyPremium = async () => {
      if (subservice !== 'PMAPY') {
        setApyPremium(null);
        return;
      }

      if (!savingAccount || !pensionAmount || !installmentFreq) {
        setApyPremium(null);
        return;
      }

      setApyPremiumLoading(true);
      try {
        const response = await getPmapyInstallmentAmount(
          savingAccount,
          Number(pensionAmount),
          installmentFreq as PmapyInstallmentFrequency,
        );

        if (!response) {
          setApyPremium(null);
          return;
        }

        if (response.errorCode !== '00') {
          setApyEligible(false);
          setApyPremium(null);
          setApyMessage(response.errorMsg || 'Unable to fetch premium details');
          return;
        }

        setApyEligible(true);
        setApyMessage('');
        setApyPremium(parsePmSchemePremiumFromApi(response));
      } finally {
        setApyPremiumLoading(false);
      }
    };

    fetchApyPremium();
  }, [subservice, savingAccount, pensionAmount, installmentFreq]);

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

    const ne = validateNomineeFields(nominee, { requireGuardianDob: false });
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
          <div className="summary-row"><span className="summary-key">Guardian Relation</span><span className="summary-val">{relationLabel(relations, nominee.guardianRelation)}</span></div>
        </>
      )}
    </>
  );

  const sendOtpAndProceed = async () => {
    setLoading(true);
    setApiError('');
    setResendMsg('');
    setOtpVerified(false);
    try {
      await sendOtp(customer.mobileNo, 'PMYSCHEMEOTP');
      setStep('otp');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendMsg('');
    setApiError('');
    setLoading(true);
    try {
      await sendOtp(customer.mobileNo, 'PMYSCHEMEOTP');
      setResendMsg('A new OTP has been sent ✓');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to resend OTP');
    } finally {
      setLoading(false);
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
        insurancePremiumAmount: Number(apyPremium?.firstPremium ?? 0),
        nomineeName: nominee.nomineeName,
        nomineedob: nominee.nomineeDob,
        nomineeRelCode: nominee.relation,
        nomineeAdharno: '',
        spouseName: '',
        spouseAdharno: '',
        guardinName: nomineeIsMinor ? nominee.guardianName : '',
        reltwithMinor: nomineeIsMinor ? Number(nominee.guardianRelation) : 0,
        providentFund: '',
      });
      return result.prannumber as string;
    }

    const result = await doProcessPMJJBYSBY({
      customerId: customer.customerId,
      debitAccountNumber: savingAccount,
      insuranceCompany: scheme as 'PMJJBY' | 'PMSBY',
      totalPremiumAmount: schemePremium?.totalPremium ?? 0,
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
    try {
      await validateOtp(customer.mobileNo, otp, 'PMYSCHEMEOTP');
      setOtpVerified(true);
      setStep('submit');
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'OTP verification failed');
      throw err;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setApiError('');
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

  const annualPremiumAmount =
    (scheme === 'PMJJBY' || scheme === 'PMSBY') && schemePremium
      ? schemePremium.totalPremium
      : scheme === 'PMAPY' && apyPremium
        ? apyPremium.totalPremium
        : null;

  const annualPremiumLabel =
    annualPremiumAmount != null
      ? `₹${annualPremiumAmount.toLocaleString('en-IN')} / year`
      : SCHEME_INFO[scheme].premium;

  const firstPremiumAmount =
    scheme === 'PMJJBY' || scheme === 'PMSBY'
      ? schemePremium?.firstPremium
      : scheme === 'PMAPY'
        ? apyPremium?.firstPremium
        : undefined;

  const pmapyInstallmentAmount = scheme === 'PMAPY' ? apyPremium?.firstPremium : undefined;

  const formatNextInstallmentDate = (value?: string) =>
    value ? formatInstallmentDisplayDate(value) : undefined;

  const balanceError = getInsufficientBalanceError(acc, firstPremiumAmount);

  const nextInstallmentDate =
    scheme === 'PMJJBY' || scheme === 'PMSBY'
      ? formatNextInstallmentDate(schemePremium?.nextInstallmentDate)
      : scheme === 'PMAPY'
        ? formatNextInstallmentDate(apyPremium?.nextInstallmentDate)
        : undefined;

  const premiumDetailsSection = scheme === 'PMAPY' ? (
    <>
      <div className="summary-row">
        <span className="summary-key">Installment Amount</span>
        <span className="summary-val">
          {apyPremiumLoading ? 'Loading…' : pmapyInstallmentAmount != null
            ? `₹${pmapyInstallmentAmount.toLocaleString('en-IN')}`
            : '—'}
        </span>
      </div>
      {nextInstallmentDate && (
        <div className="summary-row">
          <span className="summary-key">Next Installment Date</span>
          <span className="summary-val">{nextInstallmentDate}</span>
        </div>
      )}
    </>
  ) : (
    <>
      <div className="summary-row">
        <span className="summary-key">Annual Premium</span>
        <span className="summary-val">
          {schemePremiumLoading && (scheme === 'PMJJBY' || scheme === 'PMSBY')
            ? 'Loading…'
            : annualPremiumLabel}
        </span>
      </div>
      {firstPremiumAmount != null && (
        <div className="summary-row">
          <span className="summary-key">First Premium Amount (Pro Rata)</span>
          <span className="summary-val">₹{firstPremiumAmount.toLocaleString('en-IN')}</span>
        </div>
      )}
      {nextInstallmentDate && (
        <div className="summary-row">
          <span className="summary-key">Next Installment Date</span>
          <span className="summary-val">{nextInstallmentDate}</span>
        </div>
      )}
    </>
  );

  const reviewSummary = (
    <>
      <div className="summary-row summary-row-account"><span className="summary-key">Debit Account</span><span className="summary-val"><AccountDisplay account={acc} /></span></div>
      <div className="summary-row"><span className="summary-key">Scheme</span><span className="summary-val">{SCHEME_INFO[scheme].name}</span></div>
      <div className="divider" />
      <div className="section-heading">Premium Details</div>
      {premiumDetailsSection}
      {scheme === 'PMAPY' && (
        <>
          <div className="summary-row"><span className="summary-key">Pension Amount</span><span className="summary-val">₹{Number(pensionAmount).toLocaleString('en-IN')} / month</span></div>
          <div className="summary-row"><span className="summary-key">Installment Frequency</span><span className="summary-val">{installmentFreq}</span></div>
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
    </>
  );

  if (step === 'result' && operationResult) {
    return (
      <ServiceResultScreen
        variant={operationResult.status}
        title={operationResult.title}
        message={operationResult.message}
        refNo={operationResult.refNo}
        refLabel="Policy Reference Number"
        onCancel={resetToServiceHome}
      />
    );
  }

  /* ── ENROLLMENT DETAILS FORM ── */
  if (step === 'form') return (
    <>
      <div className="flow-content">
        {(scheme === 'PMJJBY' || scheme === 'PMSBY') && (
          <div className="card" style={{ borderColor: '#c5d6f5', background: '#f0f4fb' }}>
            <div className="card-title" style={{ fontSize: 13 }}>
              <span className="card-icon">📋</span>Scheme Details
              <span className={`scheme-badge scheme-${scheme}`} style={{ marginLeft: 'auto' }}>
                {scheme}
              </span>
            </div>

            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>
              {SCHEME_INFO[scheme].name}
            </p>

            <div className="summary-row">
              <span className="summary-key">Annual Premium</span>
              <span className="summary-val">
                {schemePremiumLoading ? 'Loading…' : annualPremiumLabel}
              </span>
            </div>

            {schemePremiumLoading && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                Loading premium details…
              </p>
            )}

            {schemePremium && (
              <div className="summary-row">
                <span className="summary-key">First Premium Amount (Pro Rata)</span>
                <span className="summary-val">
                  ₹{schemePremium.firstPremium.toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {schemePremium?.nextInstallmentDate && (
              <div className="summary-row">
                <span className="summary-key">Next Installment Date</span>
                <span className="summary-val">{formatNextInstallmentDate(schemePremium.nextInstallmentDate)}</span>
              </div>
            )}

            {!schemeEligible && schemeMessage && (
              <p className="form-error" style={{ marginTop: 6 }}>
                {schemeMessage}
              </p>
            )}
          </div>
        )}

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
            {!formErrors.savingAccount && balanceError && (
              <p className="form-error">⚠ {balanceError}</p>
            )}
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

              {apyPremiumLoading && (
                <p className="form-hint">Loading installment amount…</p>
              )}

              {apyPremium && (
                <>
                  <div className="summary-row">
                    <span className="summary-key">Installment Amount</span>
                    <span className="summary-val">₹{apyPremium.firstPremium.toLocaleString('en-IN')}</span>
                  </div>
                  {apyPremium.nextInstallmentDate && (
                    <div className="summary-row">
                      <span className="summary-key">Next Installment Date</span>
                      <span className="summary-val">{formatNextInstallmentDate(apyPremium.nextInstallmentDate)}</span>
                    </div>
                  )}
                </>
              )}

              {!apyEligible && apyMessage && (
                <p className="form-error" style={{ marginTop: 6 }}>
                  {apyMessage}
                </p>
              )}
            </>
          )}

          <div className="divider" />

          <div className="section-heading">Nominee Details</div>
          <NomineeFields
            values={nominee}
            errors={nomineeErrors}
            onChange={setNomineeField}
            relationType="pmyrelation"
            showGuardianDob={false}
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

          <ConsentCheckboxes
            idPrefix="pmsocial"
            dataConsent={consent.dataConsent}
            marketingConsent={consent.marketingConsent}
            onDataConsentChange={consent.setDataConsent}
            onMarketingConsentChange={consent.setMarketingConsent}
          />
        </div>
      </div>
      <Actions>
        <button
          className="btn btn-primary"
          disabled={
            Boolean(balanceError)
            || ((scheme === 'PMJJBY' || scheme === 'PMSBY') && !schemeEligible)
            || (scheme === 'PMAPY' && !apyEligible)
            || !consent.allAccepted
          }
          onClick={() => {
            if (balanceError) return;
            if (validateForm() && ((scheme !== 'PMJJBY' && scheme !== 'PMSBY' && scheme !== 'PMAPY') || (scheme === 'PMAPY' ? apyEligible : schemeEligible))) {
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
          {reviewSummary}
        </div>
      </div>
      <Actions>
        <div className="btn-row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('form')}>← Edit</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading || Boolean(balanceError)}
            onClick={() => { if (!balanceError && validateForm()) sendOtpAndProceed(); }}>
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
          {apiError && <p className="form-error">⚠ {apiError}</p>}
          <OTPInput onComplete={handleOtpComplete} />
          {resendMsg && <p className="form-hint" style={{ color: 'var(--success)' }}>{resendMsg}</p>}
          <p className="resend-text">
            Didn't receive OTP?{' '}
            <button type="button" className="resend-link" onClick={handleResendOtp}>Resend OTP</button>
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
  if (step === 'submit') return (
    <>
      <div className="flow-content">
        <div className="alert alert-warning">
          <span>⚠️</span>
          <span>OTP verified. Review once more and submit to complete enrollment.</span>
        </div>
        {apiError && <div className="alert alert-warning"><span>⚠️</span><span>{apiError}</span></div>}
        <div className="card">
          <div className="card-title"><span className="card-icon">📤</span>Final Submission</div>
          <p className="card-sub" style={{ marginBottom: 12 }}>Once submitted, the premium will be debited as per schedule.</p>
          {reviewSummary}
        </div>
      </div>
      <Actions>
        <div className="btn-row">
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep('otp')} disabled={loading}>← Back</button>
          <button className="btn btn-primary" style={{ flex: 2 }} disabled={loading || !otpVerified}
            onClick={handleSubmit}>
            {loading ? 'Submitting…' : 'Final Submit →'}
          </button>
        </div>
        <button type="button" className="btn btn-secondary" style={{ marginTop: 12, width: '100%' }} onClick={resetToServiceHome}>
          Cancel
        </button>
      </Actions>
    </>
  );

  return null;
}
