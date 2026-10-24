import { useState } from 'react';

import { api, ApiError, resolveUrl } from '../api';
import { useSimulation } from '../lib/useSimulation';
import { canAnalyze } from '../lib/validation';
import type { InspectionResponse, SelectedInput, Waypoint } from '../types';
import { DetectionList } from './DetectionList';
import { OverlaySvg } from './OverlaySvg';
import { PathSimulator } from './PathSimulator';

/** Inputs for {@link InspectionWorkspace}. */
export interface InspectionWorkspaceProps {
  /** True when the trained model is ready on the backend. */
  modelLoaded: boolean;
  /** The picture the user picked, or null if none yet. */
  selectedInput: SelectedInput | null;
  /** The inspection being shown (new or reopened from history), or null. */
  inspection: InspectionResponse | null;
  /** Called with the result after a successful analysis. */
  onAnalyzed: (result: InspectionResponse) => void;
}

/** A shared empty path, so the simulation is not restarted by a new empty list each render. */
const EMPTY_PATH: Waypoint[] = [];

/**
 * The main results area: the Analyze button, the photo with cracks drawn on it,
 * the crack table, and the robot path simulation.
 *
 * @param props - The component inputs.
 * @param props.modelLoaded - Whether the model is ready.
 * @param props.selectedInput - The picture the user picked.
 * @param props.inspection - The inspection being shown.
 * @param props.onAnalyzed - Called after a successful analysis.
 * @returns The workspace panel.
 */
export function InspectionWorkspace({ modelLoaded, selectedInput, inspection, onAnalyzed }: InspectionWorkspaceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = inspection?.report ?? null;
  const path = report?.tool_path ?? EMPTY_PATH;
  const sim = useSimulation(path, report?.id);
  const enabled = canAnalyze({ modelLoaded, hasImage: selectedInput !== null, loading });

  /**
   * Sends the selected picture to the backend and shows the result.
   *
   * @returns Nothing (finishes once the result or an error is shown).
   */
  const handleAnalyze = async () => {
    if (!selectedInput) return;
    setLoading(true);
    setError(null);
    try {
      onAnalyzed(await api.analyze(selectedInput.blob, selectedInput.name));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="card space-y-4" aria-labelledby="workspace-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="workspace-title" className="card-title mb-0">
          Inspection
        </h2>
        <div className="flex items-center gap-3">
          {loading && (
            <span aria-live="polite" className="flex items-center gap-2 text-sm text-slate-300">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden="true" />
              Analyzing…
            </span>
          )}
          <button type="button" className="btn btn-primary" onClick={handleAnalyze} disabled={!enabled}>
            Analyze
          </button>
        </div>
      </div>

      {!modelLoaded && (
        <p className="text-sm text-amber-300">Analyze is disabled until the model is trained and the backend restarted.</p>
      )}
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}

      {inspection && report ? (
        <>
          <OverlaySvg
            imageUrl={resolveUrl(inspection.files.original_url)}
            width={report.image_width}
            height={report.image_height}
            detections={report.detections}
            toolPath={path}
            marker={path.length > 0 ? sim.marker : null}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Inspection <span className="font-mono">{report.id}</span> · {new Date(report.created_at).toLocaleString()} ·{' '}
              {report.detections.length} crack{report.detections.length === 1 ? '' : 's'} · scale {report.calibration.mm_per_pixel} mm/px,
              offset ({report.calibration.offset_x}, {report.calibration.offset_y}) mm
            </span>
            <span className="flex gap-3">
              <a className="underline hover:text-amber-300" href={resolveUrl(inspection.files.overlay_url)} target="_blank" rel="noreferrer">
                Open overlay image
              </a>
              <a className="underline hover:text-amber-300" href={resolveUrl(inspection.files.mask_url)} target="_blank" rel="noreferrer">
                Open mask image
              </a>
            </span>
          </div>
          <div>
            <h3 className="card-title">Detected cracks</h3>
            <DetectionList detections={report.detections} />
          </div>
          <PathSimulator path={path} sim={sim} />
        </>
      ) : selectedInput ? (
        <div className="space-y-2">
          <img
            src={selectedInput.previewUrl}
            alt="Selected photo, ready to analyze"
            className="block h-auto w-full rounded-lg border border-slate-800"
          />
          <p className="text-sm text-slate-400">
            Selected: <span className="font-mono">{selectedInput.name}</span>. Press Analyze to look for cracks.
          </p>
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-slate-700 text-center text-sm text-slate-500">
          Capture a webcam snapshot or upload a photo to begin.
        </div>
      )}
    </section>
  );
}
