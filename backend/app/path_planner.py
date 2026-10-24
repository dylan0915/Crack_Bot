"""Plans the route the simulated robot tool takes over all detected cracks.

For each crack we pick up to 50 evenly spaced points along its center line,
in order from one end to the other. Cracks are visited "nearest first":
start at the crack closest to the arm's origin, then always hop to the
closest crack not yet visited.
"""

import math

import numpy as np

from .config import MAX_WAYPOINTS_PER_DETECTION
from .detection import DetectionGeometry
from .mapping import to_arm
from .schemas import ArmPoint, CalibrationSettings, Detection, PixelPoint, Waypoint


def sample_skeleton(points: np.ndarray, max_points: int = MAX_WAYPOINTS_PER_DETECTION) -> np.ndarray:
    """Put a crack's center-line points in end-to-end order and thin them out.

    Points are sorted along the crack's main direction (the direction in which
    the points spread out the most), then up to ``max_points`` evenly spaced
    ones are kept.

    Args:
        points: Center-line points as a (K, 2) array of x, y pixels.
        max_points: The most points to keep.

    Returns:
        A (M, 2) array of points in travel order, where M is at most
        ``max_points`` and at most K. Empty input gives empty output.
    """
    pts = np.asarray(points)
    if len(pts) <= 1:
        return pts.reshape(-1, 2)
    as_float = pts.astype(np.float64)
    centered = as_float - as_float.mean(axis=0)
    # The first right-singular vector is the direction of greatest spread.
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    main_axis = vt[0]
    side_axis = np.array([-main_axis[1], main_axis[0]])
    along = centered @ main_axis
    across = centered @ side_axis
    order = np.lexsort((across, along))  # sort by "along", break ties by "across"
    ordered = pts[order]
    count = min(len(ordered), max_points)
    picks = np.unique(np.linspace(0, len(ordered) - 1, count).round().astype(int))
    return ordered[picks]


def _distance(a: ArmPoint, b: ArmPoint) -> float:
    """Measure the straight-line distance between two arm positions.

    Args:
        a: First position in millimeters.
        b: Second position in millimeters.

    Returns:
        The distance between them in millimeters.
    """
    return math.hypot(a.x - b.x, a.y - b.y)


def order_detections(centroids_arm: list[ArmPoint]) -> list[int]:
    """Decide the order in which the tool visits the cracks.

    Starts with the crack whose center is closest to the arm origin (0, 0),
    then repeatedly moves to the closest crack not yet visited. When two
    cracks are equally close, the one with the lower number goes first.

    Args:
        centroids_arm: Center point of each crack in arm millimeters, listed
            by crack number.

    Returns:
        Crack numbers in visiting order. Every crack appears exactly once.
        An empty input gives an empty list.
    """
    remaining = list(range(len(centroids_arm)))
    order: list[int] = []
    current = ArmPoint(x=0.0, y=0.0)
    while remaining:
        nearest = min(remaining, key=lambda i: (_distance(centroids_arm[i], current), i))
        order.append(nearest)
        remaining.remove(nearest)
        current = centroids_arm[nearest]
    return order


def plan_tool_path(
    detections: list[Detection],
    geoms: list[DetectionGeometry],
    cal: CalibrationSettings,
) -> list[Waypoint]:
    """Build the full list of stops the simulated tool travels through.

    Cracks are visited nearest first. Each crack is traced from whichever end
    is closer to where the tool currently is, so the tool does not jump back
    and forth needlessly.

    Args:
        detections: The measured cracks, in crack-number order.
        geoms: The pixel measurements for the same cracks, in the same order.
        cal: Calibration settings used to convert each stop to millimeters.

    Returns:
        The stops in travel order, numbered 0, 1, 2, ... Each stop knows its
        pixel position, arm position, and which crack it belongs to. No cracks
        means an empty list.
    """
    waypoints: list[Waypoint] = []
    tool_position = ArmPoint(x=0.0, y=0.0)
    for det_pos in order_detections([d.centroid_arm for d in detections]):
        detection = detections[det_pos]
        sampled = sample_skeleton(geoms[det_pos].skeleton_points)
        if len(sampled) == 0:
            continue
        arm_points = [to_arm(float(x), float(y), cal) for x, y in sampled]
        pixel_points = [(float(x), float(y)) for x, y in sampled]
        if len(arm_points) > 1 and _distance(arm_points[-1], tool_position) < _distance(
            arm_points[0], tool_position
        ):
            arm_points.reverse()
            pixel_points.reverse()
        for (px, py), arm in zip(pixel_points, arm_points):
            waypoints.append(
                Waypoint(
                    index=len(waypoints),
                    detection_index=detection.index,
                    pixel=PixelPoint(x=px, y=py),
                    arm=arm,
                )
            )
        tool_position = arm_points[-1]
    return waypoints
