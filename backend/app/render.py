"""Draws the result pictures that get saved with each inspection."""

import cv2
import numpy as np

from .detection import DetectionGeometry

# Colors in OpenCV's blue-green-red order.
_RED = np.array([0, 0, 255], dtype=np.float32)
_GREEN = (0, 255, 0)
_YELLOW = (0, 255, 255)
_WHITE = (255, 255, 255)
_BLACK = (0, 0, 0)


def render_overlay(image_bgr: np.ndarray, geoms: list[DetectionGeometry]) -> np.ndarray:
    """Draw the found cracks on top of the photo.

    Each crack gets a see-through red fill (40%), a green outline, a yellow
    box around it, and its number as a label.

    Args:
        image_bgr: The original photo (height x width x 3, blue-green-red).
        geoms: Pixel measurements of each crack, in crack-number order.

    Returns:
        A new picture the same size as the photo with the drawings added.
        The original photo is not changed.
    """
    h, w = image_bgr.shape[:2]
    out = image_bgr.copy()
    thickness = max(1, round(max(h, w) / 400))
    if geoms:
        union = np.zeros((h, w), dtype=bool)
        for g in geoms:
            union |= g.mask.astype(bool)
        blended = out[union].astype(np.float32) * 0.6 + _RED * 0.4
        out[union] = blended.astype(np.uint8)
    for number, g in enumerate(geoms):
        outline = np.array(g.outline, dtype=np.int32).reshape(-1, 1, 2)
        cv2.polylines(out, [outline], True, _GREEN, thickness)
        x_min, y_min, x_max, y_max = g.bbox
        cv2.rectangle(out, (x_min, y_min), (x_max, y_max), _YELLOW, thickness)
        label = f"#{number}"
        font_scale = max(0.4, max(h, w) / 1200)
        origin = (x_min, max(12, y_min - 4))
        cv2.putText(out, label, origin, cv2.FONT_HERSHEY_SIMPLEX, font_scale, _BLACK, thickness + 2)
        cv2.putText(out, label, origin, cv2.FONT_HERSHEY_SIMPLEX, font_scale, _WHITE, thickness)
    return out


def render_mask(h: int, w: int, geoms: list[DetectionGeometry]) -> np.ndarray:
    """Make a black-and-white picture showing every crack pixel in white.

    Args:
        h: Picture height in pixels.
        w: Picture width in pixels.
        geoms: Pixel measurements of each crack.

    Returns:
        A height x width picture where crack pixels are 255 (white) and
        everything else is 0 (black).
    """
    mask = np.zeros((h, w), dtype=np.uint8)
    for g in geoms:
        mask[g.mask.astype(bool)] = 255
    return mask
