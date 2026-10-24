/**
 * A React hook that runs the tool simulation in real time using the
 * browser's animation timer (requestAnimationFrame).
 */
import { useCallback, useEffect, useState } from 'react';

import type { Waypoint } from '../types';
import {
  initialState,
  markerPosition,
  pause as pauseState,
  reset as resetState,
  start as startState,
  tick,
  type MarkerPosition,
  type SimState,
} from './simulation';

/** What the hook gives back to the screen. */
export interface SimulationControls {
  /** Where the tool is and what it is doing. */
  state: SimState;
  /** Where to draw the tool marker (null when there is no path). */
  marker: MarkerPosition | null;
  /** Starts or resumes the movement. */
  start: () => void;
  /** Pauses the movement. */
  pause: () => void;
  /** Sends the tool back to the first waypoint. */
  reset: () => void;
}

/**
 * Keeps the simulation state and moves the tool on every screen refresh while running.
 *
 * @param path - The tool path to follow.
 * @param resetKey - Any value that changes when a different inspection is shown;
 *   when it changes, the simulation goes back to the start.
 * @returns The current state, the marker position, and start/pause/reset actions.
 */
export function useSimulation(path: Waypoint[], resetKey: string | undefined): SimulationControls {
  const [state, setState] = useState<SimState>(initialState);

  // A different inspection was opened: start over.
  useEffect(() => {
    setState(initialState());
  }, [resetKey]);

  // While running, advance the tool once per screen refresh.
  useEffect(() => {
    if (state.status !== 'running') return undefined;
    let frame = 0;
    let last = performance.now();
    /**
     * Moves the tool by the time passed since the previous screen refresh, then waits for the next one.
     *
     * @param now - The browser's current time in milliseconds.
     * @returns Nothing.
     */
    const step = (now: number) => {
      const dt = now - last;
      last = now;
      setState((s) => tick(s, dt, path));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [state.status, path]);

  const start = useCallback(() => setState((s) => startState(s, path)), [path]);
  const pause = useCallback(() => setState((s) => pauseState(s)), []);
  const reset = useCallback(() => setState(resetState()), []);

  return { state, marker: markerPosition(state, path), start, pause, reset };
}
