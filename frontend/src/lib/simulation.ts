/**
 * The "brain" of the robot-tool simulation, with no screen code in it.
 *
 * The tool moves along the path at a steady speed. Its position is stored as
 * "which segment it is on" (segment i runs from waypoint i to waypoint i + 1)
 * and "how far along that segment" (t, from 0 at the start to 1 at the end).
 * Every function returns a new state instead of changing the old one.
 */
import type { ArmPoint, Waypoint } from '../types';

/** What the simulation is doing right now. */
export type SimStatus = 'idle' | 'running' | 'paused' | 'complete';

/** Where the tool is and what it is doing. */
export interface SimState {
  /** Index of the waypoint the tool most recently passed. */
  segment: number;
  /** Fraction (0 to 1) of the way from that waypoint to the next one. */
  t: number;
  /** Whether the tool is waiting, moving, paused, or finished. */
  status: SimStatus;
}

/** The tool's on-screen position plus its arm position. */
export interface MarkerPosition {
  /** Pixels from the photo's left edge. */
  px: number;
  /** Pixels from the photo's top edge. */
  py: number;
  /** The matching arm position in millimeters. */
  arm: ArmPoint;
}

/** How fast the tool moves across the photo, in pixels per second. */
export const SPEED_PX_PER_SEC = 200;

/**
 * Gives the starting state: tool at the first waypoint, not moving.
 *
 * @returns A state at segment 0, t 0, status "idle".
 */
export function initialState(): SimState {
  return { segment: 0, t: 0, status: 'idle' };
}

/**
 * Tells whether the Start button should be clickable.
 *
 * @param path - The tool path.
 * @param s - The current simulation state.
 * @returns True when there is a path and the tool is waiting or paused.
 */
export function canStart(path: Waypoint[], s: SimState): boolean {
  return path.length > 0 && (s.status === 'idle' || s.status === 'paused');
}

/**
 * Starts (or resumes) the tool's movement.
 *
 * @param s - The current simulation state.
 * @param path - The tool path.
 * @returns The new state. A path with a single waypoint finishes immediately;
 *   an empty path, or a state that cannot start, is returned unchanged.
 */
export function start(s: SimState, path: Waypoint[]): SimState {
  if (!canStart(path, s)) return s;
  if (path.length === 1) return { segment: 0, t: 0, status: 'complete' };
  return { ...s, status: 'running' };
}

/**
 * Pauses the tool where it is.
 *
 * @param s - The current simulation state.
 * @returns A paused copy if the tool was moving; otherwise the same state.
 */
export function pause(s: SimState): SimState {
  return s.status === 'running' ? { ...s, status: 'paused' } : s;
}

/**
 * Sends the tool back to the first waypoint and stops it.
 *
 * @returns The starting state (segment 0, t 0, "idle").
 */
export function reset(): SimState {
  return initialState();
}

/**
 * Measures the on-screen length of one segment of the path.
 *
 * @param path - The tool path.
 * @param i - The segment number (from waypoint i to waypoint i + 1).
 * @returns The segment length in pixels.
 */
function segmentLength(path: Waypoint[], i: number): number {
  const a = path[i].pixel;
  const b = path[i + 1].pixel;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Moves the tool forward by the distance it travels in a short time step.
 *
 * Segments of zero length (two waypoints in the same spot) are skipped.
 * When the tool reaches the last waypoint, the simulation is marked complete.
 *
 * @param s - The current simulation state.
 * @param dtMs - How much time has passed since the last step, in milliseconds.
 * @param path - The tool path.
 * @returns The new state. Nothing changes unless the tool is running.
 */
export function tick(s: SimState, dtMs: number, path: Waypoint[]): SimState {
  if (s.status !== 'running' || !(dtMs > 0)) return s;
  const n = path.length;
  if (n <= 1) return { segment: Math.max(0, n - 1), t: 0, status: 'complete' };

  let remaining = (SPEED_PX_PER_SEC * dtMs) / 1000;
  let segment = s.segment;
  let t = s.t;
  while (segment < n - 1) {
    const length = segmentLength(path, segment);
    if (length > 0) {
      const next = t + remaining / length;
      if (next < 1) return { segment, t: next, status: 'running' };
      remaining -= (1 - t) * length;
    }
    segment += 1;
    t = 0;
    if (remaining <= 0 && segment < n - 1) return { segment, t: 0, status: 'running' };
  }
  return { segment: n - 1, t: 0, status: 'complete' };
}

/**
 * Works out exactly where the tool marker should be drawn.
 *
 * @param s - The current simulation state.
 * @param path - The tool path.
 * @returns The pixel and arm position between the current waypoint and the
 *   next one, or null if the path is empty.
 */
export function markerPosition(s: SimState, path: Waypoint[]): MarkerPosition | null {
  const n = path.length;
  if (n === 0) return null;
  const a = path[Math.min(s.segment, n - 1)];
  const b = path[Math.min(s.segment + 1, n - 1)];
  const t = Math.min(Math.max(s.t, 0), 1);
  /**
   * Finds the value a fraction t of the way from one number to another.
   *
   * @param from - The starting value.
   * @param to - The ending value.
   * @returns The in-between value.
   */
  const lerp = (from: number, to: number) => from + (to - from) * t;
  return {
    px: lerp(a.pixel.x, b.pixel.x),
    py: lerp(a.pixel.y, b.pixel.y),
    arm: { x: lerp(a.arm.x, b.arm.x), y: lerp(a.arm.y, b.arm.y) },
  };
}

/**
 * Tells which waypoint to highlight in the list.
 *
 * @param s - The current simulation state.
 * @returns The index of the waypoint the tool most recently passed.
 */
export function currentWaypointIndex(s: SimState): number {
  return s.segment;
}
