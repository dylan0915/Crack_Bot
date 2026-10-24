"""Shapes of the data the backend sends and receives.

Each class below describes one kind of record (for example a crack or a tool
path point). The web server uses them to check incoming data and to build
the JSON it sends back. The frontend file ``frontend/src/types.ts`` mirrors
these field for field.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class CalibrationSettings(BaseModel):
    """How to turn photo pixels into robot-arm millimeters.

    Fields:
        mm_per_pixel: How many millimeters one pixel covers. Must be above zero.
        offset_x: Where the photo's left edge sits on the arm's X axis, in mm.
        offset_y: Where the photo's top edge sits on the arm's Y axis, in mm.
    """

    mm_per_pixel: float = Field(1.0, gt=0, allow_inf_nan=False)
    offset_x: float = Field(0.0, allow_inf_nan=False)
    offset_y: float = Field(0.0, allow_inf_nan=False)


class PixelPoint(BaseModel):
    """A spot on the photo, measured in pixels from the top-left corner.

    Fields:
        x: Pixels from the left edge.
        y: Pixels from the top edge.
    """

    x: float
    y: float


class ArmPoint(BaseModel):
    """A spot in the robot arm's space, measured in millimeters.

    Fields:
        x: Arm X position in mm (rounded to 2 decimals).
        y: Arm Y position in mm (rounded to 2 decimals).
    """

    x: float
    y: float


class BoundingBox(BaseModel):
    """The smallest upright rectangle that fully contains a crack, in pixels.

    Fields:
        x_min: Left-most pixel column of the crack.
        y_min: Top-most pixel row of the crack.
        x_max: Right-most pixel column of the crack.
        y_max: Bottom-most pixel row of the crack.
    """

    x_min: int
    y_min: int
    x_max: int
    y_max: int


class Detection(BaseModel):
    """Everything we measured about one crack.

    Fields:
        index: The crack's number (0 is the one the model was most sure about).
        confidence: How sure the model is that this is a crack (0 to 1).
        outline: Corner points tracing the crack's border, as [x, y] pixels.
        bbox: The rectangle around the crack.
        centroid_px: The crack's center point in pixels.
        centroid_arm: The crack's center point in arm millimeters.
        area_px: How many pixels the crack covers.
        area_mm2: The crack's area in square millimeters.
        length_px: The crack's length along its center line, in pixels.
        length_mm: The crack's length in millimeters.
    """

    index: int
    confidence: float
    outline: list[tuple[int, int]]
    bbox: BoundingBox
    centroid_px: PixelPoint
    centroid_arm: ArmPoint
    area_px: int
    area_mm2: float
    length_px: float
    length_mm: float


class Waypoint(BaseModel):
    """One stop on the simulated robot tool's path.

    Fields:
        index: Position of this stop in the whole path (0 is first).
        detection_index: Which crack this stop belongs to.
        pixel: Where the stop is on the photo.
        arm: Where the stop is in arm millimeters.
    """

    index: int
    detection_index: int
    pixel: PixelPoint
    arm: ArmPoint


class InspectionReport(BaseModel):
    """The full saved record of one inspection (written to report.json).

    Fields:
        id: Unique name of the inspection, such as 20250301T143012_3fa9c2d1.
        created_at: When the inspection happened (with time zone).
        image_width: Photo width in pixels.
        image_height: Photo height in pixels.
        calibration: The calibration settings used for this inspection.
        weights_path: Which model file did the detecting.
        confidence_threshold: The minimum confidence used to keep a crack.
        detections: All cracks found.
        tool_path: The ordered stops the simulated tool visits.
    """

    id: str
    created_at: datetime
    image_width: int
    image_height: int
    calibration: CalibrationSettings
    weights_path: str
    confidence_threshold: float
    detections: list[Detection]
    tool_path: list[Waypoint]


class InspectionFiles(BaseModel):
    """Web addresses for the images saved with an inspection.

    Fields:
        original_url: Address of the original photo.
        overlay_url: Address of the photo with cracks drawn on it.
        mask_url: Address of the black-and-white crack mask.
    """

    original_url: str
    overlay_url: str
    mask_url: str


class InspectionResponse(BaseModel):
    """What the server returns after an analysis or when reopening one.

    Fields:
        report: The inspection's full record.
        files: Addresses of its images.
    """

    report: InspectionReport
    files: InspectionFiles


class InspectionSummary(BaseModel):
    """A short entry for the history list.

    Fields:
        id: The inspection's unique name.
        created_at: When it happened.
        detection_count: How many cracks were found.
        thumbnail_url: Address of the overlay image used as a preview picture.
    """

    id: str
    created_at: datetime
    detection_count: int
    thumbnail_url: str


class StatusResponse(BaseModel):
    """Tells the frontend whether the crack model is ready.

    Fields:
        model_loaded: True when the trained model was found and loaded.
        weights_path: Where the server looks for the trained model file.
        device: Which hardware runs the model, "cuda:0" (graphics card) or "cpu".
    """

    model_loaded: bool
    weights_path: str
    device: str
