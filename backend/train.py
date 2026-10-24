"""Teach (fine-tune) the YOLO11n-seg model to find cracks in concrete.

Run from the ``backend`` folder:

    python train.py                 # full training, 50 rounds (epochs)
    python train.py --epochs 1      # quick test run

The Ultralytics "crack-seg" practice photos are downloaded automatically the
first time. When training ends, the best model file is copied to
``backend/weights/best.pt`` where the web server looks for it.
"""

import argparse
import shutil
import sys
from pathlib import Path

from app.config import BACKEND_DIR, WEIGHTS_PATH

DATASET_YAML = "crack-seg.yaml"  # dataset description bundled with Ultralytics
BASE_MODEL = "yolo11n-seg.pt"  # small pretrained model we start from
DEFAULT_PROJECT = BACKEND_DIR / "runs"  # training logs always go to backend/runs
VENV_PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"


def require_ultralytics():
    """Load the Ultralytics library, or explain how to fix it if it is missing.

    The usual cause is running this script with the computer's main Python
    instead of the project's own Python in backend/.venv, where the libraries
    were installed.

    Returns:
        The Ultralytics ``YOLO`` class and its ``settings`` object.

    Raises:
        SystemExit: With a plain-language fix if Ultralytics is not installed
            for the Python that is running this script.
    """
    try:
        from ultralytics import YOLO, settings
    except ModuleNotFoundError:
        raise SystemExit(
            "\nCould not find the 'ultralytics' library.\n"
            f"This script was started with:  {sys.executable}\n"
            f"but the libraries are installed in:  {VENV_PYTHON}\n\n"
            "Fix: run it with the project's Python, from PowerShell:\n"
            f'    cd "{BACKEND_DIR}"\n'
            "    .\\.venv\\Scripts\\Activate.ps1\n"
            "    python train.py\n\n"
            "If backend\\.venv does not exist yet, follow the setup steps in README.md first."
        ) from None
    return YOLO, settings


def default_device() -> str:
    """Pick the fastest available hardware for training.

    Checks for an NVIDIA graphics card (CUDA) first, then an Intel graphics
    chip such as Intel Arc (XPU) that passes a quick correctness test, and
    falls back to the regular processor.

    Returns:
        "0" for the first NVIDIA card, "xpu" for an Intel graphics chip, or "cpu".
    """
    try:
        import torch

        from app.model_service import xpu_works_correctly

        if torch.cuda.is_available():
            return "0"
        if xpu_works_correctly():
            return "xpu"
    except Exception:
        pass
    return "cpu"


def describe_device(device: str) -> str:
    """Give a readable name for the hardware that will do the training.

    Args:
        device: The device code, such as "0", "xpu", or "cpu".

    Returns:
        A description like "Intel GPU: Intel(R) Arc(TM) 140V GPU (16GB)" or
        "CPU (no supported graphics card found)".
    """
    try:
        import torch

        if device.startswith("xpu") and torch.xpu.is_available():
            return f"Intel GPU: {torch.xpu.get_device_name(0)}"
        if device != "cpu" and torch.cuda.is_available():
            return f"NVIDIA GPU: {torch.cuda.get_device_name(0)}"
    except Exception:
        pass
    return "CPU (no supported graphics card found — see README 'GPU acceleration')"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Read the options typed after ``python train.py``.

    Args:
        argv: The options as a list of words. When left empty, the real
            command-line options are used.

    Returns:
        The chosen settings: epochs, imgsz, batch, device, workers,
        weights_out, project, and datasets_dir.
    """
    parser = argparse.ArgumentParser(description="Fine-tune YOLO11n-seg on the Crack-seg dataset.")
    parser.add_argument("--epochs", type=int, default=50, help="How many full passes over the training photos (default 50).")
    parser.add_argument("--imgsz", type=int, default=640, help="Size photos are resized to while training (default 640).")
    parser.add_argument("--batch", type=int, default=16, help="How many photos are processed at once (default 16; lower it if you run out of memory).")
    parser.add_argument("--device", default=None, help='Hardware: "0" for an NVIDIA card, "xpu" for an Intel Arc GPU, or "cpu". Default: the fastest one available.')
    parser.add_argument("--workers", type=int, default=2, help="Helper processes that load photos (default 2).")
    parser.add_argument("--weights-out", type=Path, default=WEIGHTS_PATH, help=f"Where to copy the finished model (default {WEIGHTS_PATH}).")
    parser.add_argument("--project", type=Path, default=DEFAULT_PROJECT, help=f"Folder for training logs and checkpoints (default {DEFAULT_PROJECT}).")
    parser.add_argument("--datasets-dir", type=Path, default=None, help="Folder to download datasets into (useful to keep them out of OneDrive).")
    args = parser.parse_args(argv)
    if args.device is None:
        args.device = default_device()
    return args


def main(argv: list[str] | None = None) -> int:
    """Run the whole training job from start to finish.

    Steps: start from the pretrained model, train on the crack photos, copy
    the best result to the weights folder, re-check it on the validation
    photos, and print where it was saved and its accuracy score (mAP50).

    Args:
        argv: Command-line options as a list of words, or empty to use the real ones.

    Returns:
        0 when training succeeded (used as the program's exit code).
    """
    args = parse_args(argv)
    YOLO, settings = require_ultralytics()

    if args.datasets_dir is not None:
        settings.update({"datasets_dir": str(Path(args.datasets_dir).resolve())})

    print(f"Training {BASE_MODEL} on {DATASET_YAML}: epochs={args.epochs}, imgsz={args.imgsz}, batch={args.batch}")
    print(f"Training hardware: {describe_device(args.device)} (device={args.device})")
    model = YOLO(BASE_MODEL)
    model.train(
        data=DATASET_YAML,
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
        workers=args.workers,
        project=str(Path(args.project).resolve()),
        name="crackbot",
        exist_ok=True,
    )

    best = Path(model.trainer.best)
    weights_out = Path(args.weights_out)
    weights_out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best, weights_out)

    metrics = YOLO(str(weights_out)).val(
        data=DATASET_YAML, imgsz=args.imgsz, batch=args.batch, device=args.device, workers=args.workers
    )
    map50 = float(metrics.seg.map50)

    print(f"Saved weights to: {weights_out.resolve()}")
    print(f"Validation mask mAP50: {map50:.4f}")
    return 0


# This guard is required on Windows: photo-loading helper processes re-import
# this file, and without it they would start training again and crash.
if __name__ == "__main__":
    sys.exit(main())
