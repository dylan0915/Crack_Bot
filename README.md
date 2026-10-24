# CrackBot AI — Autonomous Concrete Inspection

Hackathon MVP. A local web app that finds and outlines cracks in concrete photos with a fine-tuned
YOLO11n-seg model, converts crack positions into robotic-arm coordinates (fixed scale + offset),
plans a tool path across the cracks, and animates a simulated robot tool along it. Every inspection
is saved locally (images + JSON report) and can be reopened from History.

> **Not a developer?** Read the step-by-step [User Manual](docs/USER_MANUAL.md) instead.

| Part | Stack | Address |
|---|---|---|
| Backend | Python 3.11+, FastAPI, Ultralytics YOLO11n-seg, PyTorch, OpenCV, NumPy | http://127.0.0.1:8000 (API docs at `/docs`) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, SVG overlays | http://127.0.0.1:5173 |
| Training | `backend/train.py` on Ultralytics `crack-seg.yaml` | writes `backend/weights/best.pt` |

There is no fallback detector: until `best.pt` exists the backend starts normally, reports
`model_loaded: false`, and `/api/analyze` returns 503 with a "run train.py first" message.

## Prerequisites

- Windows 10/11 with PowerShell
- Python 3.11 or newer (verified on 3.14)
- Node.js 22 or 24 (verified on 24.12)
- Optional: an NVIDIA GPU with a current driver (training on CPU works but takes hours)

### OneDrive warning

This project lives under OneDrive. OneDrive can lock files while it syncs, which breaks `pip`,
`npm`, and training. Either **pause OneDrive sync** while installing and training, or keep the heavy
folders out of OneDrive: `backend\.venv`, `frontend\node_modules`, `backend\runs`, and the
Ultralytics datasets folder (use `--datasets-dir`, below).

## Setup (PowerShell)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # if blocked: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 1) PyTorch first, from the PyTorch index (plain "pip install torch" on Windows is CPU-only).
#    Pick the line that matches your graphics hardware:
#    Intel Arc / Core Ultra integrated GPU (XPU) — use 2.12.1; 2.14.x gives wrong results on Arc 140V:
pip install torch==2.12.1+xpu torchvision==0.27.1+xpu --index-url https://download.pytorch.org/whl/xpu --extra-index-url https://pypi.org/simple
#    NVIDIA GPU:
pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cu128
#    ...or CPU only:
pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu

# 2) Everything else
pip install -r requirements.txt

# Check which accelerator PyTorch can see
python -c "import torch; print('cuda', torch.cuda.is_available(), '| xpu', torch.xpu.is_available())"
```

### GPU acceleration

`train.py` and the backend pick the fastest device automatically: NVIDIA (`cuda`), then Intel GPU
(`xpu`), then CPU. Training prints `Training hardware: ...` at the start so you can confirm.

- **Intel Arc / Core Ultra GPUs** need the `+xpu` PyTorch build above and an up-to-date Intel
  graphics driver. Force it with `python train.py --device xpu`.
- **Use torch 2.12.1+xpu, not 2.14.x.** On Intel Arc 140V (Lunar Lake), 2.14.1+xpu silently returns
  wrong results for `torch.nonzero` / boolean masks / `torch.unique`
  ([pytorch#200713](https://github.com/pytorch/pytorch/issues/200713)), which breaks YOLO training.
  The app runs a quick self-test and falls back to the CPU (with a warning) if it detects this.
- **Expected speed on Arc 140V:** measured on a Core Ultra 9 288V (1 epoch, 25% of Crack-seg,
  imgsz 416, batch 16), the GPU took about 275–300 s per epoch and the CPU about 430 s, so expect
  roughly 1.4× faster. This small model is limited by photo loading, so integrated graphics help
  less than a discrete NVIDIA card would.
- **NPUs (Intel AI Boost, AMD Ryzen AI, Qualcomm Hexagon)** cannot be used for training. PyTorch
  has no NPU training backend on Windows; NPUs are built for running already-trained models.
- If `torch.xpu.is_available()` is `False` with the `+xpu` build, update the Intel graphics driver
  from https://www.intel.com/content/www/us/en/download-center/home.html and reboot.

### Frontend

```powershell
cd frontend
npm install
```

## Train the model

From `backend` with the virtual environment active:

```powershell
python train.py                                   # 50 epochs, imgsz 640, batch 16
python train.py --epochs 1                        # quick smoke run
python train.py --epochs 10 --imgsz 416 --batch 8 # faster CPU option (Crack-seg photos are 416 px)
python train.py --datasets-dir C:\crackbot-data\datasets   # keep the dataset out of OneDrive
```

The Crack-seg dataset downloads automatically on first run. When training finishes the script copies
the best checkpoint to `backend/weights/best.pt` and prints the path and the validation mask mAP50.
Options: `--epochs`, `--imgsz`, `--batch`, `--device` (`0` or `cpu`), `--workers`, `--weights-out`,
`--project`, `--datasets-dir`. Full 50-epoch training on CPU takes several hours.

**Restart the backend after training** — the model is loaded once at startup.

## Run

Two PowerShell windows:

```powershell
# Window 1 — backend
cd backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Window 2 — frontend
cd frontend
npm run dev
```

Open http://127.0.0.1:5173 in Chrome or Edge. The frontend calls `http://127.0.0.1:8000` by default
(not `localhost`, which Windows may resolve to IPv6). Override with `VITE_API_BASE` in `frontend/.env`.

## Tests and checks

```powershell
cd backend;  python -m pytest        # pytest + Hypothesis (shared fixtures in tests/conftest.py)
cd frontend; npm test                # vitest --run
cd frontend; npm run build           # TypeScript check + production build
```

The test runners and fixtures (fake model + test client in `backend/tests/conftest.py`) are set up,
but the property and unit tests in the spec are optional tasks and are not written yet, so
`pytest` currently reports "no tests ran".

## REST API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | `model_loaded`, `weights_path`, `device` |
| GET / PUT | `/api/settings` | Calibration (`mm_per_pixel` > 0, `offset_x`, `offset_y`); 422 on bad values |
| POST | `/api/analyze` | multipart `file` → inspection; 503 not trained, 400 bad image, 500 inference/save failure |
| GET | `/api/inspections` | History, newest first |
| GET | `/api/inspections/{id}` | Reopen an inspection |
| GET | `/api/inspections/{id}/files/{name}` | `original.png`, `overlay.png`, or `mask.png` only |

Arm mapping: `X = px × mm_per_pixel + offset_x`, `Y = py × mm_per_pixel + offset_y`, rounded to 2 dp.
Tool path: ≤ 50 waypoints per crack along its skeleton, cracks visited nearest-neighbor from the arm origin.

## Project layout

```
backend/
  app/            FastAPI app: config, schemas, model_service, imaging, detection, mapping,
                  path_planner, render, settings_store, inspection_store, main
  train.py        fine-tuning script
  tests/          pytest fixtures (fake model, test client)
  weights/        best.pt (git-ignored)
  data/           settings.json + inspections/<id>/ (git-ignored)
frontend/src/
  api.ts, types.ts, App.tsx
  lib/            validation.ts, simulation.ts (pure reducer), useSimulation.ts
  components/     ModelBanner, WebcamCapture, ImageUpload, SettingsPanel, InspectionWorkspace,
                  OverlaySvg, DetectionList, PathSimulator, WaypointList, HistoryView
docs/USER_MANUAL.md
```

## Security note

The backend has **no authentication** and no upload size limit. It binds to `127.0.0.1` only and
CORS allows only the local dev server, so it is not reachable from other machines. Do not expose it
on a network without adding authentication.
