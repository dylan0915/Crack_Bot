import { useCallback, useEffect, useState } from 'react';

import { api, ApiError } from './api';
import { HistoryView } from './components/HistoryView';
import { ImageUpload } from './components/ImageUpload';
import { InspectionWorkspace } from './components/InspectionWorkspace';
import { ModelBanner } from './components/ModelBanner';
import { SettingsPanel } from './components/SettingsPanel';
import { WebcamCapture } from './components/WebcamCapture';
import type { CalibrationSettings, InspectionResponse, SelectedInput, StatusResponse } from './types';

/** The two screens of the app. */
type Tab = 'inspect' | 'history';

/**
 * The whole app: header with tabs, the model warning banner, and either the
 * Inspect screen (inputs, settings, results) or the History screen.
 * It keeps the shared state: model status, settings, chosen picture, and shown inspection.
 *
 * @returns The app page.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('inspect');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CalibrationSettings | null>(null);
  const [selectedInput, setSelectedInput] = useState<SelectedInput | null>(null);
  const [inspection, setInspection] = useState<InspectionResponse | null>(null);

  /**
   * Asks the backend whether the model is ready, and loads the settings the first time.
   *
   * @returns Nothing (finishes once the status or an error is stored).
   */
  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await api.getStatus());
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.message : String(err));
      return;
    }
    try {
      const loaded = await api.getSettings();
      setSettings((current) => current ?? loaded);
    } catch {
      // Status worked, so a settings failure is unusual; the panel simply stays empty.
    }
  }, []);

  // Check the status when the page opens and whenever the window regains focus.
  useEffect(() => {
    void refreshStatus();
    /**
     * Re-checks the backend when the user comes back to this browser window.
     *
     * @returns Nothing.
     */
    const onFocus = () => void refreshStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshStatus]);

  // Free the temporary preview address of the previous picture when it is replaced.
  useEffect(() => {
    if (!selectedInput) return undefined;
    return () => URL.revokeObjectURL(selectedInput.previewUrl);
  }, [selectedInput]);

  /**
   * Stores a newly chosen picture (snapshot or upload) and clears the old result.
   *
   * @param blob - The picture data.
   * @param name - Its file name.
   * @returns Nothing.
   */
  const selectImage = (blob: Blob, name: string) => {
    setSelectedInput({ blob, name, previewUrl: URL.createObjectURL(blob) });
    setInspection(null);
  };

  /**
   * Shows an inspection reopened from history on the Inspect screen.
   *
   * @param opened - The reopened inspection.
   * @returns Nothing.
   */
  const openFromHistory = (opened: InspectionResponse) => {
    setInspection(opened);
    setTab('inspect');
  };

  const modelLoaded = status?.model_loaded ?? false;
  /**
   * Picks the look of a tab button: highlighted when it is the open screen.
   *
   * @param t - Which tab the button is for.
   * @returns The style classes for that button.
   */
  const tabClass = (t: Tab) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-amber-400 ${
      tab === t ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              <span className="text-amber-400">CrackBot</span> AI
            </h1>
            <p className="text-xs text-slate-400">Autonomous concrete inspection · simulated robot arm</p>
          </div>
          <nav role="tablist" aria-label="Screens" className="flex gap-2">
            <button type="button" role="tab" aria-selected={tab === 'inspect'} className={tabClass('inspect')} onClick={() => setTab('inspect')}>
              Inspect
            </button>
            <button type="button" role="tab" aria-selected={tab === 'history'} className={tabClass('history')} onClick={() => setTab('history')}>
              History
            </button>
          </nav>
          <p className="text-xs text-slate-400" aria-live="polite">
            {statusError ? (
              <span className="text-red-300">● Backend offline</span>
            ) : status ? (
              <span className={modelLoaded ? 'text-emerald-300' : 'text-amber-300'}>
                ● {modelLoaded ? 'Model ready' : 'Model not trained'} · {status.device}
              </span>
            ) : (
              'Connecting…'
            )}
          </p>
        </div>
      </header>

      <ModelBanner status={status} error={statusError} />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {tab === 'inspect' ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
            <div className="space-y-6">
              <WebcamCapture onCapture={selectImage} />
              <ImageUpload onSelect={selectImage} />
              <SettingsPanel settings={settings} onSaved={setSettings} />
            </div>
            <InspectionWorkspace
              modelLoaded={modelLoaded}
              selectedInput={selectedInput}
              inspection={inspection}
              onAnalyzed={setInspection}
            />
          </div>
        ) : (
          <HistoryView onOpen={openFromHistory} />
        )}
      </main>
    </div>
  );
}
