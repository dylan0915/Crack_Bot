import type { StatusResponse } from '../types';

/** Inputs for {@link ModelBanner}. */
export interface ModelBannerProps {
  /** The latest model status from the backend, or null if not known yet. */
  status: StatusResponse | null;
  /** A message to show if the backend could not be reached, or null. */
  error: string | null;
}

/**
 * Shows a warning strip at the top of the page when the backend is unreachable
 * or when the crack model has not been trained yet.
 *
 * @param props - The component inputs.
 * @param props.status - The latest model status, or null if not known yet.
 * @param props.error - A connection error message, or null.
 * @returns The warning strip, or nothing when everything is ready.
 */
export function ModelBanner({ status, error }: ModelBannerProps) {
  if (error) {
    return (
      <div role="alert" className="border-b border-red-800 bg-red-950/70 px-6 py-3 text-sm text-red-100">
        <strong className="font-semibold">Backend unavailable.</strong> {error}
      </div>
    );
  }
  if (!status || status.model_loaded) return null;
  return (
    <div role="alert" className="border-b border-amber-700 bg-amber-950/70 px-6 py-3 text-sm text-amber-100">
      <p className="font-semibold">Model not trained — run train.py first</p>
      <p className="mt-1">
        Expected weights file: <code className="break-all rounded bg-black/40 px-1">{status.weights_path}</code>
      </p>
      <p className="mt-1 text-amber-200/80">
        In the <code>backend</code> folder run <code>python train.py</code>, then restart the backend.
      </p>
    </div>
  );
}
