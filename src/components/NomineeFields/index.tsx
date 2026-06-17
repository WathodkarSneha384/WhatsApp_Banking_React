import Select from '../Select';
import { RELATIONS } from '../../types';
import { useRelations } from '../../hooks/useRelations';
import { formatDDMMYYYY } from '../../utils/date';

export interface NomineeFieldValues {
  nomineeName: string;
  nomineeDob: string;
  relation: string;
  guardianName: string;
  guardianDob: string;
  guardianRelation: string;
}

export type NomineeFieldErrors = Partial<Record<keyof NomineeFieldValues, string>>;

interface ValidateOptions {
  requireGuardianDob?: boolean;
}

interface Props {
  values: NomineeFieldValues;
  errors: NomineeFieldErrors;
  onChange: (key: keyof NomineeFieldValues, value: string) => void;
  showName?: boolean;
  showGuardianDob?: boolean;
  relationType?: 'relation' | 'pmyrelation';
}

function isMinor(dob: string): boolean {
  if (!dob) return false;
  const birth = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear()
    - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return age < 18;
}

export function calcAge(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - birth.getFullYear()
    - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  return age;
}

export function validateNomineeFields(
  values: NomineeFieldValues,
  options: ValidateOptions = {},
): NomineeFieldErrors {
  const { requireGuardianDob = true } = options;
  const e: NomineeFieldErrors = {};
  if (!values.nomineeName.trim()) e.nomineeName = 'Nominee name is required';
  if (!values.nomineeDob) e.nomineeDob = 'Date of birth is required';
  if (!values.relation) e.relation = 'Please select a relationship';
  if (isMinor(values.nomineeDob)) {
    if (!values.guardianName.trim()) e.guardianName = 'Guardian name is required for minor nominee';
    if (requireGuardianDob && !values.guardianDob) e.guardianDob = 'Guardian date of birth is required';
    if (!values.guardianRelation) e.guardianRelation = 'Please select guardian relationship';
  }
  return e;
}

const today = new Date().toISOString().split('T')[0];
const RELATION_OPTIONS = RELATIONS.map(r => ({ value: r, label: r }));

export default function NomineeFields({
  values,
  errors,
  onChange,
  showName = true,
  showGuardianDob = true,
 relationType = 'relation',
}: Props) {
  const { relations: relationOptions } = useRelations(relationType);

  const minor = isMinor(values.nomineeDob);
  const age = calcAge(values.nomineeDob);

  return (
    <>
      {showName && (
        <div className="form-group">
          <label className="form-label">Nominee Name <span className="required">*</span></label>
          <input
            className={`form-input ${errors.nomineeName ? 'is-error' : ''}`}
            placeholder="Full name as per records"
            value={values.nomineeName}
            onChange={e => onChange('nomineeName', e.target.value)}
          />
          {errors.nomineeName && <p className="form-error">⚠ {errors.nomineeName}</p>}
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Nominee Date of Birth <span className="required">*</span></label>
        <input
          className={`form-input ${errors.nomineeDob ? 'is-error' : ''}`}
          type="date"
          max={today}
          value={values.nomineeDob}
          onChange={e => onChange('nomineeDob', e.target.value)}
        />
        {errors.nomineeDob && <p className="form-error">⚠ {errors.nomineeDob}</p>}
        {age !== null && (
          <div style={{ marginTop: 6 }}>
            {minor
              ? <span className="minor-badge">⚠️ Minor ({age} yrs) — Guardian details required</span>
              : <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>✓ Age: {age} years</span>
            }
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Relationship <span className="required">*</span></label>
        <Select
          className={errors.relation ? 'is-error' : ''}
          value={values.relation}
          placeholder="Select relationship"
          options={relationOptions}
          onChange={v => onChange('relation', v)}
        />
        {errors.relation && <p className="form-error">⚠ {errors.relation}</p>}
      </div>

      {minor && (
        <>
          <div className="section-heading">Guardian Details (Nominee is Minor)</div>

          <div className="form-group">
            <label className="form-label">Guardian Name <span className="required">*</span></label>
            <input
              className={`form-input ${errors.guardianName ? 'is-error' : ''}`}
              placeholder="Full name of guardian"
              value={values.guardianName}
              onChange={e => onChange('guardianName', e.target.value)}
            />
            {errors.guardianName && <p className="form-error">⚠ {errors.guardianName}</p>}
          </div>

          {showGuardianDob && (
            <div className="form-group">
              <label className="form-label">Guardian Date of Birth (DD-MM-YYYY) <span className="required">*</span></label>
              <input
                className={`form-input ${errors.guardianDob ? 'is-error' : ''}`}
                type="date"
                max={today}
                value={values.guardianDob}
                onChange={e => onChange('guardianDob', e.target.value)}
              />
              {values.guardianDob && (
                <p className="form-hint" style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  Selected: {formatDDMMYYYY(values.guardianDob)}
                </p>
              )}
              {errors.guardianDob && <p className="form-error">⚠ {errors.guardianDob}</p>}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Guardian Relation with Minor <span className="required">*</span></label>
            <Select
              className={errors.guardianRelation ? 'is-error' : ''}
              value={values.guardianRelation}
              placeholder="Select relation"
              options={relationOptions}
              onChange={v => onChange('guardianRelation', v)}
            />
            {errors.guardianRelation && <p className="form-error">⚠ {errors.guardianRelation}</p>}
          </div>
        </>
      )}
    </>
  );
}
