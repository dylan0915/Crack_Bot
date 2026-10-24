import { useCallback, useEffect, useRef, useState } from 'react';

/** Inputs for {@link WebcamCapture}. */
export interface WebcamCaptureProps {
  /** Called with the snapshot picture and a file name when the user captures a frame. */
  onCapture: (image: Blob, name: string) => void;
}

/**
 * Turns a browser camera error into a plain explanation.
 *
 * @param err - The error the browser gave when opening the camera.
 * @returns A short reason such as "access was denied".
 */
function describeCameraError(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'access was denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no webcam was found';
  if (name === 'NotReadableError') return 'the webcam is being used by another app';
  return (err as Error)?.message || 'unknown error';
}

/**
 * A live webcam preview with a button to capture a still snapshot.
 * If the camera cannot be used, it explains why; uploading still works.
 *
 * @param props - The component inputs.
 * @param props.onCapture - Called with the captured snapshot.
 * @returns The webcam panel.
 */
export function WebcamCapture({ onCapture }: WebcamCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Turns the camera off and releases it so other apps can use it.
   *
   * @returns Nothing.
   */
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  // Always release the camera when this panel disappears.
  useEffect(() => stopCamera, [stopCamera]);

  /**
   * Asks the browser for camera access and shows the live preview.
   *
   * @returns Nothing (finishes once the camera is on or an error is shown).
   */
  const startCamera = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Webcam unavailable: this browser does not support camera access. You can still upload an image.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setActive(true);
    } catch (err) {
      setError(`Webcam unavailable: ${describeCameraError(err)}. You can still upload an image.`);
      stopCamera();
    }
  };

  /**
   * Copies the current preview frame into a PNG picture and passes it on.
   *
   * @returns Nothing.
   */
  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setError('The webcam is not ready yet. Wait a moment and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        onCapture(blob, `webcam-${stamp}.png`);
      } else {
        setError('Could not capture the snapshot. Please try again.');
      }
    }, 'image/png');
  };

  return (
    <section className="card" aria-labelledby="webcam-title">
      <h2 id="webcam-title" className="card-title">
        Webcam
      </h2>
      <div className="mb-3 overflow-hidden rounded-lg border border-slate-800 bg-black">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Live webcam preview"
          className={active ? 'block aspect-video w-full object-contain' : 'hidden'}
        />
        {!active && (
          <div className="flex aspect-video items-center justify-center text-sm text-slate-500">
            Webcam is off
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {active ? (
          <button type="button" className="btn btn-secondary" onClick={stopCamera}>
            Stop webcam
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={startCamera}>
            Start webcam
          </button>
        )}
        <button type="button" className="btn btn-primary" onClick={capture} disabled={!active}>
          Capture snapshot
        </button>
      </div>
      {error && (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
