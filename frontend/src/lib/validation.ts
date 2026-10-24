/**
 * Simple checks used before sending anything to the backend.
 */
import type { CalibrationSettings } from '../types';

/** Picture types the app accepts, as reported by the browser. */
export const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/bmp'] as const;

/** File name endings the app accepts, used when the browser does not report a type. */
export const SUPPORTED_EXT = ['.jpg', '.jpeg', '.png', '.bmp'] as const;

/** Message shown when the user picks a file the app cannot use. */
export const UNSUPPORTED_MSG = 'Unsupported file. Please choose a JPEG, PNG, or BMP image.';

/**
 * Checks whether a chosen file is a picture type the app supports.
 *
 * @param file - The chosen file (only its name and type are looked at).
 * @param file.name - The file name, such as "wall.jpg".
 * @param file.type - The picture type reported by the browser, such as "image/png" (may be empty).
 * @returns True for JPEG, PNG, or BMP pictures; otherwise false.
 */
export function isSupportedImage(file: { name: string; type: string }): boolean {
  if ((SUPPORTED_TYPES as readonly string[]).includes(file.type)) return true;
  if (file.type !== '') return false;
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
  return (SUPPORTED_EXT as readonly string[]).includes(ext);
}

/** The calibration values exactly as typed into the settings boxes. */
export type CalibrationInput = { mm_per_pixel: string; offset_x: string; offset_y: string };

/** Result of checking the settings boxes: either good numbers or a message per bad box. */
export type CalibrationResult =
  | { ok: true; value: CalibrationSettings }
  | { ok: false; errors: Partial<Record<keyof CalibrationInput, string>> };

/**
 * Turns typed text into a number, refusing blanks (which JavaScript would otherwise treat as 0).
 *
 * @param text - What the user typed.
 * @returns The number, or null if the text is blank or not a normal number.
 */
function parseNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/**
 * Checks the three calibration boxes before saving.
 *
 * @param input - The text typed into the mm-per-pixel, offset X, and offset Y boxes.
 * @returns The numbers when everything is valid, otherwise an error message for each bad box.
 *   The scale must be a number above zero; the offsets must be numbers (they may be negative).
 */
export function validateCalibration(input: CalibrationInput): CalibrationResult {
  const errors: Partial<Record<keyof CalibrationInput, string>> = {};
  const scale = parseNumber(input.mm_per_pixel);
  const offsetX = parseNumber(input.offset_x);
  const offsetY = parseNumber(input.offset_y);

  if (scale === null) errors.mm_per_pixel = 'Enter a number for mm per pixel.';
  else if (scale <= 0) errors.mm_per_pixel = 'mm per pixel must be greater than 0.';
  if (offsetX === null) errors.offset_x = 'Enter a number for offset X (it can be 0 or negative).';
  if (offsetY === null) errors.offset_y = 'Enter a number for offset Y (it can be 0 or negative).';

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { mm_per_pixel: scale!, offset_x: offsetX!, offset_y: offsetY! } };
}

/**
 * Decides whether the Analyze button should be clickable.
 *
 * @param s - The current app state.
 * @param s.modelLoaded - True when the trained crack model is ready on the backend.
 * @param s.hasImage - True when a webcam snapshot or uploaded image is selected.
 * @param s.loading - True while an analysis is already running.
 * @returns True only when the model is ready, an image is chosen, and nothing is running.
 */
export function canAnalyze(s: { modelLoaded: boolean; hasImage: boolean; loading: boolean }): boolean {
  return s.modelLoaded && s.hasImage && !s.loading;
}
