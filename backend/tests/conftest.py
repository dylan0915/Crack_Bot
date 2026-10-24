"""Shared test helpers: a fake crack model and a ready-made test web client.

The fake model never runs real AI, so tests are fast and need no trained weights.
"""

from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.model_service import RawInstance


class FakeModelService:
    """Stands in for the real ModelService and returns pre-set cracks."""

    def __init__(self, loaded: bool = True, instances: list[RawInstance] | None = None):
        """Set up the fake model.

        Args:
            loaded: Whether the fake should claim the model is ready.
            instances: The cracks every prediction should return.

        Returns nothing.
        """
        self.weights_path = Path("weights/best.pt")
        self._loaded = loaded
        self.instances = instances or []
        self.device = "cpu"

    @property
    def is_loaded(self) -> bool:
        """Tell whether the fake model claims to be ready.

        Returns:
            The ``loaded`` value given when the fake was created.
        """
        return self._loaded

    def predict(self, image_bgr: np.ndarray, conf: float) -> list[RawInstance]:
        """Return the pre-set cracks, ignoring the picture.

        Args:
            image_bgr: The picture (not used).
            conf: The confidence threshold (not used; filtering happens later).

        Returns:
            The cracks given when the fake was created.
        """
        return list(self.instances)


@pytest.fixture
def fake_model() -> FakeModelService:
    """Provide a loaded fake model that reports one diagonal crack.

    Returns:
        A FakeModelService with one thin crack polygon at 0.9 confidence.
    """
    polygon = np.array([[10, 10], [90, 60], [92, 64], [12, 14]], dtype=np.float32)
    return FakeModelService(instances=[RawInstance(polygon=polygon, confidence=0.9)])


@pytest.fixture
def client(tmp_path: Path, fake_model: FakeModelService):
    """Provide a test web client wired to the fake model and a temporary folder.

    Args:
        tmp_path: A fresh temporary folder supplied by pytest.
        fake_model: The fake model fixture.

    Returns:
        A TestClient (given to the test while it runs, then closed).
    """
    app = create_app(
        model_service=fake_model,
        settings_path=tmp_path / "settings.json",
        inspections_dir=tmp_path / "inspections",
    )
    with TestClient(app) as test_client:
        yield test_client
