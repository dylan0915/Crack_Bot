import type { MarkerPosition } from '../lib/simulation';
import type { Detection, Waypoint } from '../types';

/** Inputs for {@link OverlaySvg}. */
export interface OverlaySvgProps {
  /** Address of the original photo. */
  imageUrl: string;
  /** Photo width in pixels (sets the drawing's coordinate system). */
  width: number;
  /** Photo height in pixels. */
  height: number;
  /** The cracks to outline. */
  detections: Detection[];
  /** The tool path to draw as a line (optional). */
  toolPath?: Waypoint[];
  /** Where to draw the moving tool marker (optional). */
  marker?: MarkerPosition | null;
}

/**
 * Shows the photo with each crack's outline (green, red fill), its box (yellow),
 * its number, the planned tool path (cyan), and the moving tool marker.
 * The drawing is an SVG laid exactly over the photo, so it lines up at any size.
 *
 * @param props - The component inputs.
 * @param props.imageUrl - Address of the original photo.
 * @param props.width - Photo width in pixels.
 * @param props.height - Photo height in pixels.
 * @param props.detections - The cracks to outline.
 * @param props.toolPath - The tool path to draw, if any.
 * @param props.marker - The tool marker position, if any.
 * @returns The photo with drawings on top.
 */
export function OverlaySvg({ imageUrl, width, height, detections, toolPath = [], marker = null }: OverlaySvgProps) {
  const size = Math.max(width, height);
  const fontSize = Math.max(10, size / 40);
  const markerRadius = Math.max(4, size / 70);
  const count = detections.length;

  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-slate-800 bg-black">
      <img src={imageUrl} alt="" className="block h-auto w-full" />
      <svg
        role="img"
        aria-label={`Photo with ${count} detected crack${count === 1 ? '' : 's'} outlined${toolPath.length ? ' and the tool path drawn' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
      >
        {detections.map((d) => (
          <g key={d.index}>
            <polygon
              data-testid="crack-outline"
              points={d.outline.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="rgba(239, 68, 68, 0.35)"
              stroke="#22c55e"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
            />
            <rect
              x={d.bbox.x_min}
              y={d.bbox.y_min}
              width={d.bbox.x_max - d.bbox.x_min + 1}
              height={d.bbox.y_max - d.bbox.y_min + 1}
              fill="none"
              stroke="#facc15"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
            <text
              x={d.bbox.x_min}
              y={Math.max(fontSize, d.bbox.y_min - fontSize * 0.25)}
              fontSize={fontSize}
              fontWeight={700}
              fill="#ffffff"
              stroke="#000000"
              strokeWidth={fontSize / 8}
              paintOrder="stroke"
            >
              #{d.index}
            </text>
          </g>
        ))}
        {toolPath.length > 1 && (
          <polyline
            data-testid="tool-path"
            points={toolPath.map((w) => `${w.pixel.x},${w.pixel.y}`).join(' ')}
            fill="none"
            stroke="#22d3ee"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
          />
        )}
        {marker && (
          <circle
            data-testid="tool-marker"
            cx={marker.px}
            cy={marker.py}
            r={markerRadius}
            fill="#e879f9"
            stroke="#ffffff"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  );
}
