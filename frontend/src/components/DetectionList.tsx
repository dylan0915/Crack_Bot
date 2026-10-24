import type { Detection } from '../types';

/** Inputs for {@link DetectionList}. */
export interface DetectionListProps {
  /** The cracks found in the photo. */
  detections: Detection[];
}

/**
 * Formats a number with a fixed count of decimal places.
 *
 * @param value - The number to show.
 * @param digits - How many decimal places to keep.
 * @returns The number as text, such as "12.50".
 */
function fmt(value: number, digits = 2): string {
  return value.toFixed(digits);
}

/**
 * A table listing every crack: its number, how sure the model is, its size,
 * its length, and its center point in pixels and in arm millimeters.
 * Shows "No cracks detected" when the list is empty.
 *
 * @param props - The component inputs.
 * @param props.detections - The cracks found in the photo.
 * @returns The crack table or the "No cracks detected" message.
 */
export function DetectionList({ detections }: DetectionListProps) {
  if (detections.length === 0) {
    return (
      <p role="status" className="rounded-lg border border-emerald-800 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
        No cracks detected
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">Detected cracks</caption>
        <thead className="text-xs uppercase text-slate-400">
          <tr className="border-b border-slate-800">
            <th scope="col" className="px-2 py-2">#</th>
            <th scope="col" className="px-2 py-2">Confidence</th>
            <th scope="col" className="px-2 py-2">Area (px / mm²)</th>
            <th scope="col" className="px-2 py-2">Length (px / mm)</th>
            <th scope="col" className="px-2 py-2">Center (px)</th>
            <th scope="col" className="px-2 py-2">Center arm (mm)</th>
          </tr>
        </thead>
        <tbody className="font-mono text-slate-200">
          {detections.map((d) => (
            <tr key={d.index} className="border-b border-slate-800/60">
              <td className="px-2 py-1.5 font-sans font-semibold text-amber-300">#{d.index}</td>
              <td className="px-2 py-1.5">{fmt(d.confidence)}</td>
              <td className="px-2 py-1.5">
                {d.area_px} / {fmt(d.area_mm2)}
              </td>
              <td className="px-2 py-1.5">
                {fmt(d.length_px, 0)} / {fmt(d.length_mm)}
              </td>
              <td className="px-2 py-1.5">
                ({fmt(d.centroid_px.x, 1)}, {fmt(d.centroid_px.y, 1)})
              </td>
              <td className="px-2 py-1.5">
                ({fmt(d.centroid_arm.x)}, {fmt(d.centroid_arm.y)})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
