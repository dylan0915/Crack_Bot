import { useEffect, useRef } from 'react';

import type { Waypoint } from '../types';

/** Inputs for {@link WaypointList}. */
export interface WaypointListProps {
  /** Every stop on the tool path. */
  path: Waypoint[];
  /** The index of the stop to highlight. */
  currentIndex: number;
}

/**
 * A scrolling list of every stop on the tool path with its crack number and
 * arm position. The current stop is highlighted and kept in view.
 *
 * @param props - The component inputs.
 * @param props.path - Every stop on the tool path.
 * @param props.currentIndex - The stop to highlight.
 * @returns The list of stops.
 */
export function WaypointList({ path, currentIndex }: WaypointListProps) {
  const containerRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLLIElement>(null);

  // Scroll only inside the list (not the whole page) so the highlighted stop stays visible.
  useEffect(() => {
    const box = containerRef.current;
    const item = currentRef.current;
    if (!box || !item) return;
    const top = item.offsetTop - box.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = bottom - box.clientHeight;
  }, [currentIndex]);

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 px-2 pb-1 text-xs uppercase text-slate-400" aria-hidden="true">
        <span>Waypoint</span>
        <span>Crack</span>
        <span>Arm X (mm)</span>
        <span>Arm Y (mm)</span>
      </div>
      <ol ref={containerRef} aria-label="Tool path waypoints" className="relative max-h-64 overflow-y-auto rounded-lg border border-slate-800">
        {path.map((w) => {
          const isCurrent = w.index === currentIndex;
          return (
            <li
              key={w.index}
              ref={isCurrent ? currentRef : undefined}
              aria-current={isCurrent ? 'step' : undefined}
              className={`grid grid-cols-4 gap-2 px-2 py-1 font-mono text-sm ${
                isCurrent ? 'bg-fuchsia-500/25 text-fuchsia-100' : 'text-slate-300 odd:bg-slate-900'
              }`}
            >
              <span>{w.index}</span>
              <span>#{w.detection_index}</span>
              <span>{w.arm.x.toFixed(2)}</span>
              <span>{w.arm.y.toFixed(2)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
