"""Loads the trained crack model once and runs it on pictures."""

import logging
import threading
from dataclasses import dataclass
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class RawInstance:
    """One crack exactly as the model reported it, before we measure it.

    Fields:
        polygon: Border points of the crack, as an (N, 2) list of x, y pixels
            on the original picture.
        confidence: How sure the model is that this is a crack (0 to 1).
    """

    polygon: np.ndarray
    confidence: float


def xpu_works_correctly() -> bool:
    """Check that the Intel graphics chip (XPU) gives correct answers.

    Some PyTorch builds (for example 2.14.x on Intel Arc 140V / Lunar Lake)
    silently return wrong results for "find the matching items" operations,
    which would quietly ruin training and detection. This runs a quick test
    on the graphics chip and compares it with the regular processor.

    Returns:
        True if an Intel graphics chip is present and passes the test,
        otherwise False.
    """
    try:
        import torch

        if not (hasattr(torch, "xpu") and torch.xpu.is_available()):
            return False
        generator = torch.Generator().manual_seed(0)
        values = torch.randint(0, 50, (20000,), generator=generator)
        on_gpu = values.to("xpu")
        same_nonzero = torch.equal(torch.nonzero(values > 25), torch.nonzero(on_gpu > 25).cpu())
        same_unique = torch.equal(
            torch.unique(values, return_counts=True)[1], torch.unique(on_gpu, return_counts=True)[1].cpu()
        )
        if not (same_nonzero and same_unique):
            logger.warning(
                "Intel GPU (XPU) self-test failed with torch %s; using the CPU instead. "
                "Install torch 2.12.1+xpu (see README 'GPU acceleration').",
                torch.__version__,
            )
            return False
        return True
    except Exception:
        logger.exception("Intel GPU (XPU) self-test crashed; using the CPU instead")
        return False


def select_device() -> str:
    """Pick the hardware to run the model on.

    Uses a graphics chip when one is available because it is much faster:
    an NVIDIA card (CUDA) first, then an Intel graphics chip such as Intel Arc
    (XPU), but only if it passes a quick correctness test. Otherwise falls
    back to the regular processor.

    Returns:
        "cuda:0" for an NVIDIA card, "xpu:0" for an Intel graphics chip, or "cpu".
    """
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda:0"
        if xpu_works_correctly():
            return "xpu:0"
    except Exception:  # torch missing or broken: the CPU is the only option
        pass
    return "cpu"


class ModelService:
    """Keeps one copy of the crack model in memory and answers detection requests."""

    def __init__(self, weights_path: Path):
        """Set up the service without loading anything yet.

        Args:
            weights_path: Where the trained model file (best.pt) should be.

        Returns nothing.
        """
        self.weights_path = Path(weights_path)
        self._model = None
        self._device = select_device()
        self._lock = threading.Lock()

    def load(self) -> None:
        """Load the trained model from disk, if the file is there.

        This never crashes the server: if the file is missing or broken, it
        logs a warning and leaves the model unloaded so the app can tell the
        user to train first.

        Returns nothing.
        """
        if not self.weights_path.is_file():
            logger.warning("Model weights not found at %s — run train.py first", self.weights_path)
            self._model = None
            return
        try:
            from ultralytics import YOLO  # imported here so startup is fast without weights

            self._model = YOLO(str(self.weights_path))
            logger.info("Loaded model from %s on %s", self.weights_path, self._device)
        except Exception:
            logger.exception("Could not load model from %s", self.weights_path)
            self._model = None

    @property
    def is_loaded(self) -> bool:
        """Tell whether the model is ready to use.

        Returns:
            True if the model was loaded successfully, otherwise False.
        """
        return self._model is not None

    @property
    def device(self) -> str:
        """Tell which hardware runs the model.

        Returns:
            "cuda:0" for a graphics card or "cpu" for the regular processor.
        """
        return self._device

    def predict(self, image_bgr: np.ndarray, conf: float) -> list[RawInstance]:
        """Ask the model to find cracks in one picture.

        Only one picture is processed at a time (a lock makes other requests wait).

        Args:
            image_bgr: The picture as a height x width x 3 grid in blue-green-red order.
            conf: The lowest confidence (0 to 1) a crack needs to be reported.

        Returns:
            A list of cracks with their border points and confidence. The list
            is empty when nothing is found.

        Raises:
            RuntimeError: If called before the model was loaded.
        """
        if self._model is None:
            raise RuntimeError("Model is not loaded")
        with self._lock:
            results = self._model(
                image_bgr, conf=conf, device=self._device, retina_masks=True, verbose=False
            )
        instances: list[RawInstance] = []
        for result in results:
            if result.masks is None or result.boxes is None:
                continue
            confidences = result.boxes.conf.cpu().numpy().tolist()
            for polygon, score in zip(result.masks.xy, confidences):
                instances.append(
                    RawInstance(polygon=np.asarray(polygon, dtype=np.float32), confidence=float(score))
                )
        return instances
