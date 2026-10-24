"""Helpers for turning uploaded file bytes into a picture the code can work with."""

import cv2
import numpy as np


class InvalidImageError(ValueError):
    """Raised when uploaded bytes are empty or are not a readable picture."""


def decode_image(data: bytes) -> np.ndarray:
    """Turn the raw bytes of an uploaded file into a color picture.

    Args:
        data: The file contents exactly as they were uploaded.

    Returns:
        The picture as a grid of pixels (height x width x 3 color channels,
        in blue-green-red order, which is what OpenCV uses).

    Raises:
        InvalidImageError: If the bytes are empty or are not a picture OpenCV can read.
    """
    if not data:
        raise InvalidImageError("Invalid image: could not decode the uploaded file")
    buffer = np.frombuffer(data, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise InvalidImageError("Invalid image: could not decode the uploaded file")
    return image
