"""Saves and loads the calibration settings in a small JSON file."""

import logging
import os
from pathlib import Path

from .schemas import CalibrationSettings

logger = logging.getLogger(__name__)


class SettingsStore:
    """Keeps the current calibration settings in memory and on disk."""

    def __init__(self, path: Path):
        """Open the settings file and read what is in it.

        Args:
            path: Where the settings JSON file lives (it may not exist yet).

        Returns nothing.
        """
        self.path = Path(path)
        self.current: CalibrationSettings = self.load()

    def load(self) -> CalibrationSettings:
        """Read the calibration settings from the file.

        If the file is missing, cannot be read, or holds bad values, a warning
        is logged and the defaults are used instead (1.0 mm per pixel, no offsets).

        Returns:
            The calibration settings from the file, or the defaults.
        """
        if not self.path.is_file():
            logger.warning("Settings file %s not found; using defaults", self.path)
            return CalibrationSettings()
        try:
            return CalibrationSettings.model_validate_json(self.path.read_bytes())
        except (OSError, ValueError) as exc:
            logger.warning("Settings file %s is unreadable (%s); using defaults", self.path, exc)
            return CalibrationSettings()

    def save(self, cal: CalibrationSettings) -> None:
        """Write new calibration settings to the file and start using them.

        The settings are first written to a temporary file and then swapped in,
        so a crash halfway through never leaves a half-written file.

        Args:
            cal: The new calibration settings (already checked to be valid).

        Returns nothing.

        Raises:
            OSError: If the file cannot be written.
        """
        self.path.parent.mkdir(parents=True, exist_ok=True)
        temp_path = self.path.with_name(self.path.name + ".tmp")
        temp_path.write_text(cal.model_dump_json(indent=2), encoding="utf-8")
        os.replace(temp_path, self.path)
        self.current = cal
