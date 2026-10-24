import { useCallback, useEffect, useState } from 'react';

import { api, ApiError, resolveUrl } from '../api';
import type { InspectionResponse, InspectionSummary } from '../types';

/** Inputs for {@link HistoryView}. */
export interface HistoryViewProps {
  /** Called with the full inspection after the user picks one to reopen. */
  onOpen: (inspection: InspectionResponse) => void;
}

/**
 * The History tab: a grid of saved inspections (newest first) with a preview
 * picture, date, and crack count. Clicking one reopens it.
 *
 * @param props - The component inputs.
 * @param props.onOpen - Called with the reopened inspection.
 * @returns The history panel.
 */
export function HistoryView({ onOpen }: HistoryViewProps) {
  const [items, setItems] = useState<InspectionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  /**
   * Fetches the list of saved inspections from the backend.
   *
   * @returns Nothing (finishes once the list or an error is shown).
   */
  const refresh = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.listInspections());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * Loads one saved inspection in full and hands it to the parent.
   *
   * @param id - The inspection's unique name.
   * @returns Nothing (finishes once it is opened or an error is shown).
   */
  const open = async (id: string) => {
    setOpening(id);
    setError(null);
    try {
      onOpen(await api.getInspection(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setOpening(null);
    }
  };

  return (
    <section className="card" aria-labelledby="history-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="history-title" className="card-title mb-0">
          Saved inspections
        </h2>
        <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="alert-error mb-3">
          {error}
        </p>
      )}
      {items === null && !error && <p className="text-sm text-slate-400">Loading…</p>}
      {items !== null && items.length === 0 && <p className="text-sm text-slate-400">No inspections yet</p>}
      {items !== null && items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => void open(item.id)}
                disabled={opening !== null}
                className="w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-left transition hover:border-amber-400 focus-visible:outline-2 focus-visible:outline-amber-400 disabled:opacity-60"
              >
                <img
                  src={resolveUrl(item.thumbnail_url)}
                  alt={`Overlay preview of inspection ${item.id}`}
                  loading="lazy"
                  className="aspect-video w-full bg-black object-contain"
                />
                <span className="block space-y-0.5 p-3 text-sm">
                  <span className="block font-medium text-slate-100">{new Date(item.created_at).toLocaleString()}</span>
                  <span className="block text-slate-400">
                    {item.detection_count} crack{item.detection_count === 1 ? '' : 's'}
                    {opening === item.id ? ' · opening…' : ''}
                  </span>
                  <span className="block truncate font-mono text-xs text-slate-500">{item.id}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
