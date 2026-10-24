import { canStart, currentWaypointIndex, type SimStatus } from '../lib/simulation';
import type { SimulationControls } from '../lib/useSimulation';
import type { Waypoint } from '../types';
import { WaypointList } from './WaypointList';

/** Inputs for {@link PathSimulator}. */
export interface PathSimulatorProps {
  /** Every stop on the tool path. */
  path: Waypoint[];
  /** The running simulation (state, marker, and start/pause/reset actions). */
  sim: SimulationControls;
}

/** Plain-language label for each simulation status. */
const STATUS_TEXT: Record<SimStatus, string> = {
  idle: 'Ready',
  running: 'Inspecting…',
  paused: 'Paused',
  complete: 'Inspection complete',
};

/**
 * The robot-tool simulation controls: Start/Resume, Pause, and Reset buttons,
 * the current status, the tool's live arm position, and the list of stops.
 * The moving marker itself is drawn on the photo by OverlaySvg.
 *
 * @param props - The component inputs.
 * @param props.path - Every stop on the tool path.
 * @param props.sim - The running simulation.
 * @returns The simulation panel.
 */
export function PathSimulator({ path, sim }: PathSimulatorProps) {
  const { state, marker } = sim;
  const current = currentWaypointIndex(state);
  const startable = canStart(path, state);

  return (
    <section aria-labelledby="sim-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="sim-title" className="card-title mb-0">
          Robot path simulation
        </h3>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={sim.start} disabled={!startable}>
            {state.status === 'paused' ? 'Resume' : 'Start'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={sim.pause} disabled={state.status !== 'running'}>
            Pause
          </button>
          <button type="button" className="btn btn-secondary" onClick={sim.reset} disabled={path.length === 0}>
            Reset
          </button>
        </div>
      </div>

      {path.length === 0 ? (
        <p className="text-sm text-slate-400">No tool path — there are no cracks to visit.</p>
      ) : (
        <>
          <div className="grid gap-2 rounded-lg bg-slate-950/60 p-3 text-sm sm:grid-cols-3" aria-live="polite">
            <p>
              <span className="text-slate-400">Status: </span>
              <span className={state.status === 'complete' ? 'font-semibold text-emerald-300' : 'font-semibold'}>
                {STATUS_TEXT[state.status]}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Waypoint: </span>
              <span className="font-mono">
                {current + 1} / {path.length}
              </span>
            </p>
            <p>
              <span className="text-slate-400">Tool at (mm): </span>
              <span className="font-mono">
                {marker ? `(${marker.arm.x.toFixed(2)}, ${marker.arm.y.toFixed(2)})` : '—'}
              </span>
            </p>
          </div>
          <WaypointList path={path} currentIndex={current} />
        </>
      )}
    </section>
  );
}
