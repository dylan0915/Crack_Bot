"""Saves each inspection to its own folder and reads saved ones back.

Folder layout for one inspection:

    data/inspections/<id>/original.png   the photo that was analyzed
    data/inspections/<id>/overlay.png    the photo with cracks drawn on it
    data/inspections/<id>/mask.png       white = crack, black = no crack
    data/inspections/<id>/report.json    every number we measured
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np

from .config import (
    INSPECTION_ID_PATTERN,
    MASK_NAME,
    ORIGINAL_NAME,
    OVERLAY_NAME,
    REPORT_NAME,
    SERVABLE_FILES,
)
from .schemas import InspectionFiles, InspectionReport, InspectionSummary

logger = logging.getLogger(__name__)
_ID_RE = re.compile(INSPECTION_ID_PATTERN)


class InspectionSaveError(Exception):
    """Raised when one of an inspection's files could not be written."""

    def __init__(self, filename: str, inspection_id: str = ""):
        """Remember which file failed so the error message can name it.

        Args:
            filename: Name of the file that could not be saved.
            inspection_id: The inspection the file belongs to.

        Returns nothing.
        """
        self.filename = filename
        self.inspection_id = inspection_id
        super().__init__(f"Failed to save {filename} for inspection {inspection_id}")


def is_valid_id(inspection_id: str) -> bool:
    """Check that an inspection id has the expected shape.

    This stops anyone from asking for files outside the inspections folder
    (for example with "..\\" in the name).

    Args:
        inspection_id: The id to check.

    Returns:
        True if it looks like 20250301T143012_3fa9c2d1, otherwise False.
    """
    return bool(_ID_RE.fullmatch(inspection_id))


def file_url(inspection_id: str, name: str) -> str:
    """Build the web address the frontend uses to fetch a saved image.

    Args:
        inspection_id: The inspection's unique name.
        name: The image file name, such as overlay.png.

    Returns:
        A path like /api/inspections/<id>/files/overlay.png (relative to the server).
    """
    return f"/api/inspections/{inspection_id}/files/{name}"


def files_for(inspection_id: str) -> InspectionFiles:
    """List the web addresses of all three images of an inspection.

    Args:
        inspection_id: The inspection's unique name.

    Returns:
        The addresses of the original, overlay, and mask images.
    """
    return InspectionFiles(
        original_url=file_url(inspection_id, ORIGINAL_NAME),
        overlay_url=file_url(inspection_id, OVERLAY_NAME),
        mask_url=file_url(inspection_id, MASK_NAME),
    )


def _sort_key(created_at: datetime) -> datetime:
    """Make a timestamp safe to compare with others when sorting.

    Args:
        created_at: A timestamp that may or may not include a time zone.

    Returns:
        The same moment, treated as UTC if it had no time zone.
    """
    return created_at if created_at.tzinfo else created_at.replace(tzinfo=timezone.utc)


class InspectionStore:
    """Creates, lists, and reopens saved inspections in one folder on disk."""

    def __init__(self, root: Path):
        """Point the store at its folder.

        Args:
            root: The folder that holds one sub-folder per inspection.

        Returns nothing.
        """
        self.root = Path(root)
        self._issued: set[str] = set()

    def new_id(self, now: datetime) -> str:
        """Make a fresh, unique name for a new inspection.

        The name is the date and time plus 8 random characters, so it sorts by
        time and two inspections in the same second still get different names.

        Args:
            now: The moment the inspection happened.

        Returns:
            A name like 20250301T143012_3fa9c2d1 not used by any other inspection.
        """
        stamp = now.strftime("%Y%m%dT%H%M%S")
        while True:
            candidate = f"{stamp}_{uuid.uuid4().hex[:8]}"
            if candidate not in self._issued and not (self.root / candidate).exists():
                self._issued.add(candidate)
                return candidate

    def save(
        self,
        report: InspectionReport,
        original: np.ndarray,
        overlay: np.ndarray,
        mask: np.ndarray,
    ) -> None:
        """Write all files of one inspection into its own new folder.

        Args:
            report: The inspection's full record (its id names the folder).
            original: The photo that was analyzed.
            overlay: The photo with cracks drawn on it.
            mask: The black-and-white crack picture.

        Returns nothing.

        Raises:
            InspectionSaveError: If the folder or any file could not be written;
                the error names the file that failed.
        """
        folder = self.root / report.id
        try:
            folder.mkdir(parents=True, exist_ok=False)
        except OSError as exc:
            raise InspectionSaveError(f"folder {report.id}", report.id) from exc

        for name, picture in ((ORIGINAL_NAME, original), (OVERLAY_NAME, overlay), (MASK_NAME, mask)):
            # imencode + write_bytes also works with non-English folder names on Windows.
            try:
                ok, encoded = cv2.imencode(".png", picture)
                if not ok:
                    raise InspectionSaveError(name, report.id)
                (folder / name).write_bytes(encoded.tobytes())
            except InspectionSaveError:
                raise
            except (OSError, cv2.error) as exc:
                raise InspectionSaveError(name, report.id) from exc

        try:
            (folder / REPORT_NAME).write_text(report.model_dump_json(indent=2), encoding="utf-8")
        except OSError as exc:
            raise InspectionSaveError(REPORT_NAME, report.id) from exc

    def list(self) -> list[InspectionSummary]:
        """List every saved inspection for the history screen, newest first.

        Folders whose report is missing or broken are skipped, and a warning
        naming the folder is logged.

        Returns:
            One short summary per valid inspection, sorted newest first.
            An empty list if nothing has been saved yet.
        """
        if not self.root.is_dir():
            return []
        found: list[InspectionReport] = []
        for folder in self.root.iterdir():
            if not folder.is_dir():
                continue
            report = self._read_report(folder)
            if report is not None:
                found.append(report)
        found.sort(key=lambda r: _sort_key(r.created_at), reverse=True)
        return [
            InspectionSummary(
                id=r.id,
                created_at=r.created_at,
                detection_count=len(r.detections),
                thumbnail_url=file_url(r.id, OVERLAY_NAME),
            )
            for r in found
        ]

    def load(self, inspection_id: str) -> InspectionReport | None:
        """Read back one saved inspection.

        Args:
            inspection_id: The inspection's unique name.

        Returns:
            The inspection's full record, or None if the id is badly shaped,
            the folder does not exist, or its report is missing or broken.
        """
        if not is_valid_id(inspection_id):
            return None
        folder = self.root / inspection_id
        if not folder.is_dir():
            return None
        return self._read_report(folder)

    def file_path(self, inspection_id: str, name: str) -> Path | None:
        """Find a saved image on disk, but only if the request is safe.

        Args:
            inspection_id: The inspection's unique name.
            name: One of original.png, overlay.png, or mask.png.

        Returns:
            The file's location, or None if the id or name is not allowed or
            the file does not exist.
        """
        if not is_valid_id(inspection_id) or name not in SERVABLE_FILES:
            return None
        path = self.root / inspection_id / name
        return path if path.is_file() else None

    def _read_report(self, folder: Path) -> InspectionReport | None:
        """Read and check the report.json inside one inspection folder.

        Args:
            folder: The inspection's folder.

        Returns:
            The parsed report, or None (with a logged warning) if the folder
            name is not a valid id, or the report is missing, unreadable,
            invalid, or belongs to a different id.
        """
        if not is_valid_id(folder.name):
            logger.warning("Skipping inspection folder %s: unexpected folder name", folder)
            return None
        report_path = folder / REPORT_NAME
        if not report_path.is_file():
            logger.warning("Skipping inspection folder %s: report.json is missing", folder)
            return None
        try:
            report = InspectionReport.model_validate_json(report_path.read_bytes())
        except (OSError, ValueError) as exc:
            logger.warning("Skipping inspection folder %s: report.json is invalid (%s)", folder, exc)
            return None
        if report.id != folder.name:
            logger.warning("Skipping inspection folder %s: report id %s does not match", folder, report.id)
            return None
        return report
