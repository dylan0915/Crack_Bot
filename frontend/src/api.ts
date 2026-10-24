/**
 * Small helper for talking to the CrackBot backend over the web (REST).
 * Every function returns a Promise that either gives the data or fails with an ApiError.
 */
import type {
  CalibrationSettings,
  InspectionResponse,
  InspectionSummary,
  StatusResponse,
} from './types';

/**
 * Address of the backend. Uses 127.0.0.1 rather than "localhost" because
 * Windows sometimes turns "localhost" into an IPv6 address the backend is not listening on.
 */
export const API_BASE: string = (import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

/** The names of the images saved with each inspection. */
export type InspectionFileName = 'original.png' | 'overlay.png' | 'mask.png';

/** An error from the backend (or from failing to reach it) with a readable message. */
export class ApiError extends Error {
  /** The web status code, such as 400 or 503. 0 means the backend could not be reached. */
  readonly status: number;

  /**
   * Creates the error.
   *
   * @param status - The web status code (0 if the backend could not be reached).
   * @param message - A readable explanation to show the user.
   */
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Pulls a readable error message out of a failed backend response.
 *
 * @param res - The failed response.
 * @returns The backend's "detail" message, a joined list of field errors, or a generic message.
 */
async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    const detail = (body as { detail?: unknown })?.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(item.loc) ? item.loc.filter((p) => p !== 'body').join('.') : '';
          return field ? `${field}: ${item.msg ?? 'invalid value'}` : item.msg ?? 'Invalid value';
        })
        .join('; ');
    }
  } catch {
    // The body was not JSON; fall through to the generic message.
  }
  return `Request failed (HTTP ${res.status})`;
}

/**
 * Sends one request to the backend and reads the JSON answer.
 *
 * @param path - The address after the server name, such as "/api/status".
 * @param init - Optional request details (method, body, headers).
 * @returns The parsed JSON answer.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, `Cannot reach backend at ${API_BASE}. Is the backend running?`);
  }
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorMessage(res));
  }
  return (await res.json()) as T;
}

/**
 * Turns a server-relative address (like "/api/inspections/…/files/overlay.png") into a full one.
 *
 * @param relative - The address returned by the backend.
 * @returns The full address the browser can load.
 */
export function resolveUrl(relative: string): string {
  return relative.startsWith('http') ? relative : `${API_BASE}${relative}`;
}

/** All the backend calls the app uses. */
export const api = {
  /**
   * Asks whether the trained model is loaded.
   *
   * @returns The model status, its expected file location, and the hardware used.
   */
  getStatus(): Promise<StatusResponse> {
    return request<StatusResponse>('/api/status');
  },

  /**
   * Gets the calibration settings currently used by the backend.
   *
   * @returns The mm-per-pixel scale and X/Y offsets.
   */
  getSettings(): Promise<CalibrationSettings> {
    return request<CalibrationSettings>('/api/settings');
  },

  /**
   * Saves new calibration settings on the backend.
   *
   * @param settings - The new scale and offsets.
   * @returns The settings as saved by the backend.
   */
  putSettings(settings: CalibrationSettings): Promise<CalibrationSettings> {
    return request<CalibrationSettings>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  /**
   * Sends a picture to be checked for cracks.
   *
   * @param image - The picture data (webcam snapshot or uploaded file).
   * @param filename - A file name to send with it.
   * @returns The finished inspection: cracks, tool path, and image addresses.
   */
  analyze(image: Blob, filename: string): Promise<InspectionResponse> {
    const form = new FormData();
    form.append('file', image, filename);
    return request<InspectionResponse>('/api/analyze', { method: 'POST', body: form });
  },

  /**
   * Gets the list of saved inspections.
   *
   * @returns Short summaries, newest first.
   */
  listInspections(): Promise<InspectionSummary[]> {
    return request<InspectionSummary[]>('/api/inspections');
  },

  /**
   * Reopens one saved inspection.
   *
   * @param id - The inspection's unique name.
   * @returns The inspection's full record and image addresses.
   */
  getInspection(id: string): Promise<InspectionResponse> {
    return request<InspectionResponse>(`/api/inspections/${encodeURIComponent(id)}`);
  },

  /**
   * Builds the address of one saved image.
   *
   * @param id - The inspection's unique name.
   * @param name - Which image: original.png, overlay.png, or mask.png.
   * @returns The full address the browser can load.
   */
  fileUrl(id: string, name: InspectionFileName): string {
    return `${API_BASE}/api/inspections/${encodeURIComponent(id)}/files/${name}`;
  },
};
