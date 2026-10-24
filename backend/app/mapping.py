"""Converts photo measurements (pixels) into robot-arm measurements (millimeters).

The camera is assumed to look straight down at a flat surface, so one simple
scale and a fixed offset are enough:

    arm X = pixel x * mm_per_pixel + offset_x
    arm Y = pixel y * mm_per_pixel + offset_y
"""

from .schemas import ArmPoint, CalibrationSettings


def to_arm(px: float, py: float, cal: CalibrationSettings) -> ArmPoint:
    """Turn a point on the photo into a position the robot arm understands.

    Multiplies the pixel position by the millimeters-per-pixel scale and adds
    the arm offsets, then rounds to two decimal places.

    Args:
        px: How far the point is from the left edge of the photo, in pixels.
        py: How far the point is from the top edge of the photo, in pixels.
        cal: The calibration settings (scale and X/Y offsets in millimeters).

    Returns:
        The arm position in millimeters as an ArmPoint with x and y.
    """
    return ArmPoint(
        x=round(px * cal.mm_per_pixel + cal.offset_x, 2),
        y=round(py * cal.mm_per_pixel + cal.offset_y, 2),
    )


def length_to_mm(length_px: float, cal: CalibrationSettings) -> float:
    """Turn a length measured in pixels into millimeters.

    Args:
        length_px: The length in pixels.
        cal: The calibration settings; only the scale is used.

    Returns:
        The length in millimeters, rounded to two decimal places.
    """
    return round(length_px * cal.mm_per_pixel, 2)


def area_to_mm2(area_px: float, cal: CalibrationSettings) -> float:
    """Turn an area measured in pixels into square millimeters.

    Each pixel is a small square, so its area is the scale times itself.

    Args:
        area_px: The area as a count of pixels.
        cal: The calibration settings; only the scale is used.

    Returns:
        The area in square millimeters, rounded to two decimal places.
    """
    return round(area_px * cal.mm_per_pixel * cal.mm_per_pixel, 2)
