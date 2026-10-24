/**
 * Shapes of the data exchanged with the backend.
 * These mirror `backend/app/schemas.py` field for field.
 */

/** How photo pixels are turned into robot-arm millimeters. */
export interface CalibrationSettings {
  /** Millimeters covered by one pixel (always above zero). */
  mm_per_pixel: number;
  /** Arm X position of the photo's left edge, in mm. */
  offset_x: number;
  /** Arm Y position of the photo's top edge, in mm. */
  offset_y: number;
}

/** A spot on the photo, in pixels from the top-left corner. */
export interface PixelPoint {
  x: number;
  y: number;
}

/** A spot in the robot arm's space, in millimeters. */
export interface ArmPoint {
  x: number;
  y: number;
}

/** The upright rectangle around a crack, in pixels (edges included). */
export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

/** Everything measured about one crack. */
export interface Detection {
  index: number;
  confidence: number;
  outline: [number, number][];
  bbox: BoundingBox;
  centroid_px: PixelPoint;
  centroid_arm: ArmPoint;
  area_px: number;
  area_mm2: number;
  length_px: number;
  length_mm: number;
}

/** One stop on the simulated tool path. */
export interface Waypoint {
  index: number;
  detection_index: number;
  pixel: PixelPoint;
  arm: ArmPoint;
}

/** The full saved record of one inspection. */
export interface InspectionReport {
  id: string;
  /** When it happened, as an ISO 8601 date-time string. */
  created_at: string;
  image_width: number;
  image_height: number;
  calibration: CalibrationSettings;
  weights_path: string;
  confidence_threshold: number;
  detections: Detection[];
  tool_path: Waypoint[];
}

/** Server-relative addresses of an inspection's saved images. */
export interface InspectionFiles {
  original_url: string;
  overlay_url: string;
  mask_url: string;
}

/** What the server returns after an analysis or when reopening one. */
export interface InspectionResponse {
  report: InspectionReport;
  files: InspectionFiles;
}

/** A short entry in the history list. */
export interface InspectionSummary {
  id: string;
  created_at: string;
  detection_count: number;
  thumbnail_url: string;
}

/** Whether the trained crack model is ready. */
export interface StatusResponse {
  model_loaded: boolean;
  weights_path: string;
  device: string;
}

/** The picture the user picked (webcam snapshot or uploaded file). */
export interface SelectedInput {
  /** The picture data. */
  blob: Blob;
  /** A file name to send along with it. */
  name: string;
  /** A temporary browser address used to show the picture. */
  previewUrl: string;
}
