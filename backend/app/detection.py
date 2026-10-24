"""Measures each crack the model found: shape, size, center, and length.

The model gives us each crack as a border polygon. Here we fill that polygon
into a mask (a black-and-white picture where white = crack), then measure the
mask: its outline, surrounding box, center point, area, and a thin center line
(the "skeleton") whose pixel count is used as the crack length.
"""

from dataclasses import dataclass

import cv2
import numpy as np

from .mapping import area_to_mm2, length_to_mm, to_arm
from .model_service import RawInstance
from .schemas import BoundingBox, CalibrationSettings, Detection, PixelPoint

# Small plus-shaped brush used when shrinking and growing the mask.
_CROSS_KERNEL = cv2.getStructuringElement(cv2.MORPH_CROSS, (3, 3))


@dataclass
class DetectionGeometry:
    """Pixel-level measurements of one crack, kept alongside its Detection.

    Fields:
        mask: Full-size picture of 0s and 1s where 1 marks the crack.
        outline: Border points of the crack as (x, y) pixels.
        bbox: Box around the crack as (x_min, y_min, x_max, y_max), edges included.
        centroid: Center point of the crack as (x, y) pixels.
        area_px: Number of pixels the crack covers.
        skeleton_points: Points of the crack's thin center line, as a (K, 2) list of x, y.
        length_px: Crack length in pixels (number of center-line points).
    """

    mask: np.ndarray
    outline: list[tuple[int, int]]
    bbox: tuple[int, int, int, int]
    centroid: tuple[float, float]
    area_px: int
    skeleton_points: np.ndarray
    length_px: float


def rasterize(polygon: np.ndarray, h: int, w: int) -> np.ndarray:
    """Fill a crack's border polygon into a mask picture.

    Args:
        polygon: Border points as an (N, 2) list of x, y pixels.
        h: Height of the picture in pixels.
        w: Width of the picture in pixels.

    Returns:
        A height x width picture of 0s and 1s, with 1 inside the polygon.
        Polygons with fewer than 3 points cannot enclose anything, so they
        give an all-zero mask.
    """
    mask = np.zeros((h, w), dtype=np.uint8)
    if polygon is None or len(polygon) < 3:
        return mask
    pts = np.round(np.asarray(polygon, dtype=np.float64)).astype(np.int32)
    pts[:, 0] = np.clip(pts[:, 0], 0, w - 1)
    pts[:, 1] = np.clip(pts[:, 1], 0, h - 1)
    cv2.fillPoly(mask, [pts.reshape(-1, 1, 2)], 1)
    return mask


def skeletonize(mask: np.ndarray) -> np.ndarray:
    """Find the thin center line of a crack mask.

    Works by repeatedly shrinking the shape by one pixel and keeping the
    pixels that would disappear for good. To make sure the shrinking always
    finishes (and to stay fast on big photos), we first cut out just the area
    around the crack and add a one-pixel empty border.

    Args:
        mask: Picture of 0s and 1s where 1 marks the crack.

    Returns:
        The center-line points as a (K, 2) array of whole-number x, y pixels on
        the full picture. If the mask is empty, returns an empty (0, 2) array.
    """
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return np.zeros((0, 2), dtype=np.int32)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()), int(ys.min()), int(ys.max())
    crop = (mask[y0 : y1 + 1, x0 : x1 + 1] > 0).astype(np.uint8) * 255
    img = cv2.copyMakeBorder(crop, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    skel = np.zeros_like(img)
    while cv2.countNonZero(img) > 0:
        eroded = cv2.erode(img, _CROSS_KERNEL)
        opened = cv2.dilate(eroded, _CROSS_KERNEL)
        skel = cv2.bitwise_or(skel, cv2.subtract(img, opened))
        img = eroded
    sy, sx = np.nonzero(skel)
    # Undo the crop and the 1-pixel border to get full-picture coordinates.
    points = np.stack([sx - 1 + x0, sy - 1 + y0], axis=1).astype(np.int32)
    if len(points) == 0:
        cx, cy = int(round(xs.mean())), int(round(ys.mean()))
        points = np.array([[cx, cy]], dtype=np.int32)
    return points


def compute_geometry(mask: np.ndarray) -> DetectionGeometry | None:
    """Measure one crack mask.

    Args:
        mask: Picture of 0s and 1s where 1 marks the crack.

    Returns:
        All measurements of the crack (outline, box, center, area, center line,
        length), or None if the mask has no crack pixels at all.
    """
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return None
    bbox = (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))
    centroid = (float(xs.mean()), float(ys.mean()))
    area_px = int(len(xs))

    contours, _ = cv2.findContours(
        (mask > 0).astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if contours:
        largest = max(contours, key=lambda c: (cv2.contourArea(c), len(c)))
        outline = [(int(p[0][0]), int(p[0][1])) for p in largest]
    else:
        outline = [(int(xs[0]), int(ys[0]))]

    skeleton_points = skeletonize(mask)
    return DetectionGeometry(
        mask=(mask > 0).astype(np.uint8),
        outline=outline,
        bbox=bbox,
        centroid=centroid,
        area_px=area_px,
        skeleton_points=skeleton_points,
        length_px=float(max(1, len(skeleton_points))),
    )


def build_detections(
    raw: list[RawInstance],
    h: int,
    w: int,
    threshold: float,
    cal: CalibrationSettings,
) -> tuple[list[Detection], list[DetectionGeometry]]:
    """Turn the model's raw cracks into fully measured Detection records.

    Cracks below the confidence threshold, or whose polygon covers no pixels,
    are dropped. The rest are numbered 0, 1, 2, ... from most to least confident,
    and their sizes and center points are also given in millimeters.

    Args:
        raw: Cracks exactly as the model reported them.
        h: Picture height in pixels.
        w: Picture width in pixels.
        threshold: Lowest confidence (0 to 1) a crack needs to be kept.
        cal: Calibration settings used to convert pixels to millimeters.

    Returns:
        Two lists of the same length and order: the Detection records (what
        gets sent and saved) and their pixel measurements (used for drawing
        and path planning).
    """
    kept: list[tuple[float, DetectionGeometry]] = []
    for inst in raw:
        if inst.confidence < threshold:
            continue
        geom = compute_geometry(rasterize(inst.polygon, h, w))
        if geom is None:
            continue
        kept.append((float(inst.confidence), geom))

    kept.sort(key=lambda item: item[0], reverse=True)  # stable: equal scores keep model order

    detections: list[Detection] = []
    geoms: list[DetectionGeometry] = []
    for index, (confidence, geom) in enumerate(kept):
        cx, cy = geom.centroid
        x_min, y_min, x_max, y_max = geom.bbox
        detections.append(
            Detection(
                index=index,
                confidence=round(confidence, 4),
                outline=geom.outline,
                bbox=BoundingBox(x_min=x_min, y_min=y_min, x_max=x_max, y_max=y_max),
                centroid_px=PixelPoint(x=round(cx, 2), y=round(cy, 2)),
                centroid_arm=to_arm(cx, cy, cal),
                area_px=geom.area_px,
                area_mm2=area_to_mm2(geom.area_px, cal),
                length_px=geom.length_px,
                length_mm=length_to_mm(geom.length_px, cal),
            )
        )
        geoms.append(geom)
    return detections, geoms
