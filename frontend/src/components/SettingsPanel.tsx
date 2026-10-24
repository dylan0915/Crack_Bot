import { useEffect, useState, type FormEvent } from 'react';

import { api, ApiError } from '../api';
import { validateCalibration, type CalibrationInput } from '../lib/validation';
import type { CalibrationSettings } from '../types';

/** Inputs for {@link SettingsPanel}. */
export interface SettingsPanelProps {
  /** The settings currently saved on the backend, or null while loading. */
  settings: CalibrationSettings | null;
  /** Called with the new settings after they were saved successfully. */
  onSaved: (settings: CalibrationSettings) => void;
}

/** Labels and help text for each settings box. */
const FIELDS: { key: keyof CalibrationInput; label: string; help: string }[] = [
  { key: 'mm_per_pixel', label: 'mm per pixel', help: 'How many millimeters one pixel covers (above 0).' },
  { key: 'offset_x', label: 'Offset X (mm)', help: "Arm X position of the photo's left edge." },
  { key: 'offset_y', label: 'Offset Y (mm)', help: "Arm Y position of the photo's top edge." },
];

/**
 * Turns saved settings into text for the input boxes.
 *
 * @param s - The saved settings, or null.
 * @returns The three values as text (empty strings when nothing is loaded).
 */
function toInput(s: CalibrationSettings | null): CalibrationInput {
  return s
    ? { mm_per_pixel: String(s.mm_per_pixel), offset_x: String(s.offset_x), offset_y: String(s.offset_y) }
    : { mm_per_pixel: '', offset_x: '', offset_y: '' };
}

/**
 * The calibration panel: three number boxes (scale and arm offsets) and a Save button.
 * Bad values are pointed out next to the box and are not sent to the backend.
 *
 * @param props - The component inputs.
 * @param props.settings - The settings currently saved on the backend.
 * @param props.onSaved - Called after a successful save.
 * @returns The settings panel.
 */
export function SettingsPanel({ settings, onSaved }: SettingsPanelProps) {
  const [values, setValues] = useState<CalibrationInput>(() => toInput(settings));
  const [errors, setErrors] = useState<Partial<Record<keyof CalibrationInput, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Refill the boxes whenever fresh settings arrive from the backend.
  useEffect(() => {
    setValues(toInput(settings));
  }, [settings]);

  /**
   * Checks the boxes and, if they are valid, saves the settings on the backend.
   *
   * @param event - The form's submit event.
   * @returns Nothing (finishes once saved or an error is shown).
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setServerError(null);
    const result = validateCalibration(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = await api.putSettings(result.value);
      onSaved(saved);
      setMessage('Settings saved. They apply to the next analysis.');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card" aria-labelledby="settings-title">
      <h2 id="settings-title" className="card-title">
        Calibration
      </h2>
      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {FIELDS.map(({ key, label, help }) => (
          <div key={key}>
            <label htmlFor={`cal-${key}`} className="block text-sm font-medium text-slate-200">
              {label}
            </label>
            <input
              id={`cal-${key}`}
              type="number"
              step="any"
              inputMode="decimal"
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              aria-invalid={Boolean(errors[key])}
              aria-describedby={`cal-${key}-help${errors[key] ? ` cal-${key}-error` : ''}`}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none"
            />
            <p id={`cal-${key}-help`} className="mt-1 text-xs text-slate-400">
              {help}
            </p>
            {errors[key] && (
              <p id={`cal-${key}-error`} role="alert" className="mt-1 text-xs text-red-300">
                {errors[key]}
              </p>
            )}
          </div>
        ))}
        <p className="rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-400">
          arm X = pixel x × mm_per_pixel + offset X
          <br />
          arm Y = pixel y × mm_per_pixel + offset Y
        </p>
        <button type="submit" className="btn btn-primary w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {message && (
          <p role="status" className="text-sm text-emerald-300">
            {message}
          </p>
        )}
        {serverError && (
          <p role="alert" className="alert-error">
            {serverError}
          </p>
        )}
      </form>
    </section>
  );
}
