"""Fixed settings for the CrackBot AI backend: file locations and default numbers.

Everything here is a constant. Change a value here to change it everywhere.
"""

from pathlib import Path

# The "backend" folder (one level above this "app" folder).
BACKEND_DIR = Path(__file__).resolve().parent.parent

# Where the trained crack model is expected. train.py copies best.pt here.
WEIGHTS_PATH = BACKEND_DIR / "weights" / "best.pt"

# Where settings and saved inspections live on disk.
DATA_DIR = BACKEND_DIR / "data"
SETTINGS_PATH = DATA_DIR / "settings.json"
INSPECTIONS_DIR = DATA_DIR / "inspections"

# How sure the model must be (0 to 1) before we count something as a crack.
DEFAULT_CONFIDENCE = 0.25

# The most tool-path points we create for any single crack.
MAX_WAYPOINTS_PER_DETECTION = 50

# Message shown when someone tries to analyze before the model is trained.
MODEL_NOT_LOADED_MSG = "Model not trained — run train.py first (expected weights at {path})"

# Web addresses of the frontend that are allowed to talk to this server.
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

# Names of the image files saved for each inspection (also the only files we serve).
ORIGINAL_NAME = "original.png"
OVERLAY_NAME = "overlay.png"
MASK_NAME = "mask.png"
REPORT_NAME = "report.json"
SERVABLE_FILES = (ORIGINAL_NAME, OVERLAY_NAME, MASK_NAME)

# Shape every inspection id must have, for example 20250301T143012_3fa9c2d1.
INSPECTION_ID_PATTERN = r"^[0-9]{8}T[0-9]{6}_[0-9a-f]{8}$"
