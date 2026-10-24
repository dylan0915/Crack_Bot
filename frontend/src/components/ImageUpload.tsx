import { useRef, useState, type ChangeEvent } from 'react';

import { isSupportedImage, UNSUPPORTED_MSG } from '../lib/validation';

/** Inputs for {@link ImageUpload}. */
export interface ImageUploadProps {
  /** Called with the picture and its file name when a valid file is chosen. */
  onSelect: (image: Blob, name: string) => void;
}

/**
 * A "choose file" panel that accepts JPEG, PNG, or BMP pictures and refuses anything else.
 *
 * @param props - The component inputs.
 * @param props.onSelect - Called with the chosen picture and its name.
 * @returns The upload panel.
 */
export function ImageUpload({ onSelect }: ImageUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Checks the chosen file and passes it on, or shows an error.
   *
   * @param event - The browser's "file chosen" event.
   * @returns Nothing.
   */
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isSupportedImage(file)) {
      setError(UNSUPPORTED_MSG);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setError(null);
    onSelect(file, file.name);
    if (inputRef.current) inputRef.current.value = ''; // allow choosing the same file again
  };

  return (
    <section className="card" aria-labelledby="upload-title">
      <h2 id="upload-title" className="card-title">
        Upload image
      </h2>
      <label htmlFor="image-upload" className="mb-2 block text-sm text-slate-300">
        Choose a photo of concrete (JPEG, PNG, or BMP)
      </label>
      <input
        id="image-upload"
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.bmp,image/jpeg,image/png,image/bmp"
        onChange={handleChange}
        className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
      />
      {error && (
        <p role="alert" className="alert-error mt-3">
          {error}
        </p>
      )}
    </section>
  );
}
