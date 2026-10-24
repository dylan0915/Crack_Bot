# Implementation Plan: CrackBot AI

## Overview

Build the backend (Python 3.11+, FastAPI, Ultralytics YOLO11n-seg, OpenCV, NumPy, pytest + Hypothesis) first, starting with `train.py` early so training can run while the rest is coded. Then build the frontend (React + TypeScript + Vite + Tailwind, Vitest + fast-check + React Testing Library) up to a working upload → analyze → overlay demo, then add path simulation, history, and the README. All commands target Windows PowerShell. Property-based tests are optional sub-tasks marked with `*`.

Documentation convention (Requirement 12.1–12.4): every implementation sub-task that creates source functions, methods, classes, or React components MUST write a plain-language Function_Comment for each one as it is written: Google-style docstrings in Python (summary line, `Args:` describing each parameter and its meaning, `Returns:` describing the value or stating it returns nothing, `Raises:` where relevant) and TSDoc blocks in TypeScript/React (summary, `@param` for each parameter or prop, `@returns`). Comments avoid jargon so a non-developer can follow them. Task 12.3 is a final coverage pass, and task 12.2 adds the separate non-developer User_Manual at `docs/USER_MANUAL.md`.

## Tasks

- [x] 1. Set up backend project and data models
  - [x] 1.1 Create backend project structure and configuration
    - Create `backend/app/__init__.py`, `backend/app/config.py` (paths, `DEFAULT_CONFIDENCE = 0.25`, `MAX_WAYPOINTS_PER_DETECTION = 50`, `MODEL_NOT_LOADED_MSG`)
    - Create `backend/requirements.txt` with pinned versions of fastapi, uvicorn, python-multipart, ultralytics (>= 8.3 for YOLO11), opencv-python, numpy, pydantic, pytest, hypothesis, httpx
    - Leave torch/torchvision out of `requirements.txt` (plain `pip install torch` on Windows is CPU-only); the README installs them first from the PyTorch CUDA index or the CPU wheel
    - Create `backend/tests/__init__.py`, `backend/tests/conftest.py`, `backend/pytest.ini`, and a `.gitignore` covering `backend/weights/`, `backend/data/`, `runs/`, `node_modules/`
    - _Requirements: 4.3, 11.1, 11.3_

  - [x] 1.2 Implement Pydantic schemas in `backend/app/schemas.py`
    - `CalibrationSettings` (mm_per_pixel > 0, finite offsets, defaults 1.0/0.0/0.0), `PixelPoint`, `ArmPoint`, `BoundingBox`, `Detection`, `Waypoint`, `InspectionReport`, `InspectionFiles`, `InspectionResponse`, `InspectionSummary`, `StatusResponse`
    - _Requirements: 6.4, 6.5, 7.4, 9.3, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 1.3 Write property test for backend calibration validation
    - **Property 10: Calibration validation** (backend half, `CalibrationSettings`)
    - File: `backend/tests/test_properties_schemas.py`
    - **Validates: Requirements 6.5**

  - [ ]* 1.4 Write property test for inspection report round trip
    - **Property 19: Inspection report round trip**
    - File: `backend/tests/test_properties_report.py`
    - **Validates: Requirements 9.3**

- [x] 2. Implement the training script
  - [x] 2.1 Implement `backend/train.py`
    - `parse_args` with `--epochs` (50), `--imgsz` (640), `--batch` (16), `--device` (CUDA `"0"` if available else `"cpu"`), `--weights-out` (default `config.WEIGHTS_PATH`)
    - `main`: `YOLO("yolo11n-seg.pt").train(data="crack-seg.yaml", ...)`, copy `model.trainer.best` to the weights path, validate the copied weights, print weights path and mask mAP50 (`metrics.seg.map50`)
    - Wrap the entry point in `if __name__ == "__main__":` (required on Windows for dataloader workers)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 2.2 Write unit tests for `train.py`
    - Test `parse_args` defaults and overrides; test `main` with mocked `YOLO` copies `best.pt` and prints the path and mAP50
    - File: `backend/tests/test_train.py`
    - _Requirements: 1.3, 1.4, 1.5_

- [x] 3. Implement image decoding and model service
  - [x] 3.1 Implement `backend/app/imaging.py`
    - `InvalidImageError` and `decode_image(data)` using `cv2.imdecode`; raise on empty or undecodable bytes
    - _Requirements: 3.6, 12.1, 12.2, 12.3, 12.4_

  - [x] 3.2 Implement `backend/app/model_service.py`
    - `RawInstance` dataclass, `select_device()` (CUDA if available else CPU), `ModelService` with `load()` (never raises on missing/corrupt weights), `is_loaded`, `device`, and lock-guarded `predict(image, conf)` converting `result.masks.xy` + `result.boxes.conf` to `RawInstance` list (empty list when no masks)
    - _Requirements: 2.1, 2.2, 4.2, 11.4, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 3.3 Write unit tests for model service
    - Mocked `YOLO` loaded exactly once across multiple predicts; missing weights leaves `is_loaded` false; `select_device` with mocked `torch.cuda.is_available`
    - File: `backend/tests/test_model_service.py`
    - _Requirements: 2.1, 2.2, 11.4_

- [x] 4. Implement geometry, mapping, and path planning
  - [x] 4.1 Implement `backend/app/mapping.py`
    - `to_arm`, `length_to_mm`, `area_to_mm2`, all rounded to 2 decimal places
    - _Requirements: 5.1, 5.3, 5.4, 5.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.2 Write property test for pixel-to-arm mapping
    - **Property 1: Pixel-to-arm mapping formula**
    - File: `backend/tests/test_properties_mapping.py`
    - **Validates: Requirements 5.1, 5.5**

  - [x] 4.3 Implement `backend/app/detection.py`
    - `rasterize` (cv2.fillPoly; polygons with < 3 points give an empty mask), `skeletonize` (bbox crop + 1-pixel zero padding to guarantee termination, iterative morphological skeleton, centroid fallback), `compute_geometry` (outline, inclusive bbox, centroid, area, skeleton points, length), `build_detections` (drop below threshold / empty masks, index by descending confidence, fill mm and arm fields via `mapping.py`)
    - _Requirements: 4.2, 4.4, 5.2, 5.3, 5.4, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.4 Write property test for detection geometry
    - **Property 3: Detection geometry invariants**
    - File: `backend/tests/test_properties_geometry.py`
    - **Validates: Requirements 4.4**

  - [ ]* 4.5 Write property test for confidence filtering
    - **Property 4: Confidence threshold filtering**
    - File: `backend/tests/test_properties_threshold.py`
    - **Validates: Requirements 4.2**

  - [ ]* 4.6 Write property test for metric scaling
    - **Property 2: Metric scaling of length and area**
    - File: `backend/tests/test_properties_scaling.py`
    - **Validates: Requirements 5.3, 5.4**

  - [x] 4.7 Implement `backend/app/path_planner.py`
    - `sample_skeleton` (PCA-axis sort, ≤ 50 uniform samples), `order_detections` (greedy nearest neighbor from arm origin, ties by lower index), `plan_tool_path` (per-detection reversal to minimize jump, sequential waypoint indices, arm coords via `to_arm`, empty list for no detections)
    - _Requirements: 5.2, 7.1, 7.2, 7.3, 7.4, 7.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 4.8 Write property test for tool path coverage
    - **Property 5: Tool path covers every detection with bounded waypoints**
    - File: `backend/tests/test_properties_path.py`
    - **Validates: Requirements 7.1, 7.2, 7.5**

  - [ ]* 4.9 Write property test for nearest-neighbor ordering
    - **Property 6: Nearest-neighbor detection ordering**
    - File: `backend/tests/test_properties_ordering.py`
    - **Validates: Requirements 7.3**

  - [ ]* 4.10 Write property test for arm coordinate consistency
    - **Property 7: Arm coordinates are consistent with pixels**
    - File: `backend/tests/test_properties_consistency.py`
    - **Validates: Requirements 5.2, 7.4**

- [x] 5. Implement rendering and local storage
  - [x] 5.1 Implement `backend/app/render.py`
    - `render_overlay` (40% red mask fill, green outline, yellow bbox, index labels) and `render_mask` (0/255 union)
    - _Requirements: 9.2, 12.1, 12.2, 12.3, 12.4_

  - [x] 5.2 Implement `backend/app/settings_store.py`
    - `SettingsStore` with `load()` (defaults + warning on missing/unreadable/invalid), atomic `save()` (temp file + `os.replace`), in-memory `current`
    - _Requirements: 6.2, 6.3, 6.4, 6.7, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 5.3 Write property test for settings round trip
    - **Property 8: Settings persistence round trip**
    - File: `backend/tests/test_properties_settings_roundtrip.py`
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 5.4 Write property test for settings fallback
    - **Property 9: Unreadable settings fall back to defaults**
    - File: `backend/tests/test_properties_settings_fallback.py`
    - **Validates: Requirements 6.4**

  - [x] 5.5 Implement `backend/app/inspection_store.py`
    - `InspectionSaveError(filename)`, `InspectionStore` with `new_id` (`%Y%m%dT%H%M%S_<8 hex>`), `save` (original/overlay/mask PNGs + `report.json`, raise naming the failed file), `list` (skip and warn on missing/invalid reports, newest first), `load`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 5.6 Write property test for inspection id uniqueness
    - **Property 18: Inspection identifiers are unique**
    - File: `backend/tests/test_properties_ids.py`
    - **Validates: Requirements 9.1**

  - [ ]* 5.7 Write property test for history listing
    - **Property 20: History listing is complete, filtered, and newest first**
    - File: `backend/tests/test_properties_history.py`
    - **Validates: Requirements 10.1, 10.5**

- [x] 6. Wire the FastAPI application
  - [x] 6.1 Implement `backend/app/main.py`
    - Lifespan handler creating `ModelService`, `SettingsStore`, `InspectionStore` on `app.state`; CORS for `http://localhost:5173` and `http://127.0.0.1:5173`
    - Routes: `GET /api/status`, `GET`/`PUT /api/settings`, `POST /api/analyze` (sync `def` handler so inference runs in the threadpool; 503 not loaded, 400 invalid image, 500 inference/save failure, uses current settings and threshold 0.25), `GET /api/inspections`, `GET /api/inspections/{id}`, `GET /api/inspections/{id}/files/{name}` (id regex + filename allow-list, else 404)
    - `if __name__ == "__main__"` runs uvicorn on `127.0.0.1:8000`
    - _Requirements: 2.3, 2.4, 3.6, 4.2, 4.3, 6.2, 6.7, 9.1, 9.2, 9.4, 9.5, 10.1, 11.3, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 6.2 Write property test for undecodable uploads
    - **Property 12: Undecodable bytes are rejected** (`decode_image` and `POST /api/analyze` with a stubbed model; generate empty bytes or `b"NOT_AN_IMAGE"` + random bytes, since unrestricted random bytes can be valid PBM/TIFF headers)
    - File: `backend/tests/test_properties_imaging.py`
    - **Validates: Requirements 3.6**

  - [ ]* 6.3 Write API unit tests with FastAPI `TestClient`
    - Status loaded/not loaded; 503 message mentions `train.py`; settings PUT then analyze uses new calibration; four files saved; 500 naming file on `cv2.imwrite` failure; image serving and 404 on bad id/name; CORS preflight from `http://localhost:5173`
    - File: `backend/tests/test_api.py`
    - _Requirements: 2.3, 2.4, 4.3, 6.7, 9.2, 9.4, 9.5, 11.3_

- [x] 7. Checkpoint - Backend complete
  - Ensure all tests pass (`python -m pytest` in `backend/`), ask the user if questions arise.

- [x] 8. Set up frontend foundation
  - [x] 8.1 Scaffold the frontend
    - Vite React + TypeScript project in `frontend/` with Tailwind, Vitest (jsdom), fast-check, React Testing Library; pinned dependency versions; `npm test` runs `vitest --run`
    - Create `frontend/src/types.ts` mirroring backend schemas
    - _Requirements: 11.1_

  - [x] 8.2 Implement `frontend/src/api.ts`
    - Typed REST client for all endpoints, `API_BASE` from `VITE_API_BASE` defaulting to `http://127.0.0.1:8000`, `ApiError` with backend `detail` (string or joined 422 messages), network failure mapped to "Cannot reach backend at <API_BASE>", `fileUrl` helper
    - _Requirements: 4.1, 4.9, 6.6, 9.5, 12.1, 12.2, 12.3, 12.4_

  - [x] 8.3 Implement `frontend/src/lib/validation.ts`
    - `isSupportedImage`, `UNSUPPORTED_MSG`, `validateCalibration` (per-field errors; empty/whitespace strings rejected rather than coerced to 0), `canAnalyze`
    - _Requirements: 2.6, 3.4, 3.5, 4.8, 6.5, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 8.4 Write property test for file type validation
    - **Property 11: Supported file type validation**
    - File: `frontend/src/lib/fileType.property.test.ts`
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 8.5 Write property test for frontend calibration validation
    - **Property 10: Calibration validation** (frontend half, `validateCalibration`)
    - File: `frontend/src/lib/calibration.property.test.ts`
    - **Validates: Requirements 6.5**

  - [ ]* 8.6 Write property test for analyze gating
    - **Property 13: Analyze action gating**
    - File: `frontend/src/lib/canAnalyze.property.test.ts`
    - **Validates: Requirements 2.6, 4.8**

- [x] 9. Build the Inspect workflow UI (first end-to-end demo)
  - [x] 9.1 Implement input and status components
    - `ModelBanner.tsx` ("Model not trained — run train.py first" + weights path), `ImageUpload.tsx` (accept filter, `isSupportedImage`, `UNSUPPORTED_MSG` with `role="alert"`), `WebcamCapture.tsx` (getUserMedia preview, canvas capture to PNG blob, error alert keeping upload available, stop tracks on unmount)
    - _Requirements: 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 12.1, 12.2, 12.3, 12.4_

  - [x] 9.2 Implement result display components
    - `OverlaySvg.tsx` (`<img>` + SVG with `viewBox`, polygon per outline, rect per bbox, labels, optional path polyline and marker props, `role="img"` + `aria-label`), `DetectionList.tsx` (index, confidence 2 dp, area px/mm², length px/mm, centroid px and arm; "No cracks detected" when empty)
    - _Requirements: 4.5, 4.6, 4.7, 8.1, 12.1, 12.2, 12.3, 12.4_

  - [x] 9.3 Implement `SettingsPanel.tsx`
    - Labeled numeric inputs for mm_per_pixel, offset_x, offset_y populated from `getSettings`; Save validates, shows per-field errors, calls `putSettings`, shows backend error detail
    - _Requirements: 6.1, 6.5, 6.6, 12.1, 12.2, 12.3, 12.4_

  - [x] 9.4 Implement `InspectionWorkspace.tsx` and `App.tsx` Inspect tab
    - App polls `getStatus` on load and window focus, holds model status, settings, selected input, current inspection
    - Workspace: Analyze button gated by `canAnalyze`, spinner with `aria-live="polite"`, error alert from `ApiError.message`, renders `OverlaySvg` and `DetectionList`
    - _Requirements: 2.5, 2.6, 4.1, 4.5, 4.6, 4.8, 4.9, 6.7, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 9.5 Write component tests for the Inspect UI
    - ModelBanner text; webcam rejection keeps upload enabled; unsupported file message; Analyze posts multipart to `/api/analyze`; backend error shown; "No cracks detected"; detection table fields; one polygon per detection
    - Files: `frontend/src/components/*.test.tsx`
    - _Requirements: 2.5, 3.3, 3.5, 4.1, 4.5, 4.6, 4.7, 4.9_

- [x] 10. Checkpoint - End-to-end demo reachable
  - Ensure all tests pass (`python -m pytest` and `npm test`), ask the user if questions arise.

- [x] 11. Add path simulation and inspection history
  - [x] 11.1 Implement `frontend/src/lib/simulation.ts`
    - Pure reducer: `initialState`, `canStart`, `start`, `pause`, `reset`, `tick` (distance-based at `SPEED_PX_PER_SEC`, skips zero-length segments, completes at last waypoint), `markerPosition` (pixel and arm interpolation), `currentWaypointIndex`
    - _Requirements: 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 11.2 Write property test for simulation progress
    - **Property 14: Simulation progresses monotonically and completes**
    - File: `frontend/src/lib/simProgress.property.test.ts`
    - **Validates: Requirements 8.3, 8.7**

  - [ ]* 11.3 Write property test for marker position
    - **Property 15: Marker lies on the current segment**
    - File: `frontend/src/lib/simMarker.property.test.ts`
    - **Validates: Requirements 8.4**

  - [ ]* 11.4 Write property test for pause
    - **Property 16: Pause freezes the marker**
    - File: `frontend/src/lib/simPause.property.test.ts`
    - **Validates: Requirements 8.5**

  - [ ]* 11.5 Write property test for reset
    - **Property 17: Reset returns to the first waypoint**
    - File: `frontend/src/lib/simReset.property.test.ts`
    - **Validates: Requirements 8.6**

  - [x] 11.6 Implement `PathSimulator.tsx` and `WaypointList.tsx` and integrate into the workspace
    - Start/Pause/Reset buttons with `requestAnimationFrame` loop calling `tick`; Start disabled via `canStart`; current arm coordinate display; "Inspection complete" status
    - WaypointList with waypoint index, detection index, arm X/Y; highlight and auto-scroll current waypoint with `aria-current="step"`
    - Update `InspectionWorkspace.tsx` to render `PathSimulator` and pass path + marker to `OverlaySvg`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 12.1, 12.2, 12.3, 12.4_

  - [x] 11.7 Implement `HistoryView.tsx` and History tab
    - List summaries newest first with overlay thumbnail, timestamp, detection count; "No inspections yet" when empty; selecting calls `getInspection`, loads it as current inspection, and switches to the Inspect tab
    - Update `App.tsx` to add the History tab
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 12.1, 12.2, 12.3, 12.4_

  - [ ]* 11.8 Write component tests for simulation and history
    - Start disabled for empty path; "Inspection complete" shown after ticks; path polyline rendered; "No inspections yet"; selecting a history item loads the workspace
    - Files: `frontend/src/components/PathSimulator.test.tsx`, `frontend/src/components/HistoryView.test.tsx`
    - _Requirements: 8.1, 8.7, 8.8, 10.3, 10.4_

- [x] 12. Document local setup, user manual, and code comments
  - [x] 12.1 Write `README.md` with PowerShell commands
    - Backend venv (Python 3.11 or 3.12), install torch/torchvision from the PyTorch CUDA index (or CPU wheel), then `pip install -r requirements.txt`; `python train.py` (with `--epochs 1` quick option and a note that CPU training of 50 epochs takes hours); start backend with `uvicorn app.main:app --host 127.0.0.1 --port 8000`; `npm install` and `npm run dev` for the frontend; running tests; note that the app is local-only and unauthenticated
    - Note that the project lives under OneDrive: pause sync or keep `.venv`, `node_modules`, `runs/`, and the Ultralytics `datasets/` dir out of synced folders to avoid file-lock errors and slow installs/training
    - Link to `docs/USER_MANUAL.md` for non-developer operating instructions
    - _Requirements: 11.1, 11.2, 11.3, 12.5_

  - [x] 12.2 Write `docs/USER_MANUAL.md` for non-developers
    - Separate from the README, written in plain language with numbered steps and exact PowerShell commands to copy
    - First-time setup: install Python and Node.js, create the venv, install torch then requirements, run `python train.py` (what the output means, where weights are saved, `--epochs 1` quick option)
    - Starting the backend (`uvicorn app.main:app --host 127.0.0.1 --port 8000`) and the frontend (`npm install`, `npm run dev`, open `http://localhost:5173`), in two separate PowerShell windows
    - Screen layout: Inspect and History tabs, model banner, webcam and upload area, Analyze button, overlay image, detection list, settings panel, path simulator controls, waypoint list
    - Capturing a webcam snapshot and uploading an image file (supported formats JPEG/PNG/BMP)
    - Running an analysis and reading results: red mask fill, green Outline, yellow box, index labels, each detection list column (confidence, area, length, centroid in pixels and Arm_Coordinates)
    - Setting Calibration_Settings (mm_per_pixel, offset_x, offset_y) with a worked numeric example, e.g. mm_per_pixel = 0.5, offset_x = 100, offset_y = 50, pixel (200, 80) → arm (100 + 200 × 0.5, 50 + 80 × 0.5) = (200.00, 90.00) mm, matching `mapping.to_arm`
    - Path simulation: Start, Pause, Reset, the moving marker, the highlighted waypoint, and the "Inspection complete" message
    - History: browsing saved Inspections and reopening one in the Inspect tab
    - Troubleshooting: "Model not trained" banner, denied webcam access, unreachable backend ("Cannot reach backend at …"), unsupported file format, slow training on CPU, OneDrive sync file locks
    - _Requirements: 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14_

  - [x] 12.3 Final Function_Comment coverage pass
    - Review every function, method, class, and React component in `backend/app/`, `backend/train.py`, and `frontend/src/` (excluding test files); add or fix comments so each one says in plain language what it does, describes every parameter/prop and its meaning, and describes the return value or states it returns nothing
    - Python: Google-style docstrings (`Args:`, `Returns:`, `Raises:`); TypeScript/React: TSDoc (`@param`, `@returns`)
    - Comment-only changes; do not alter behavior
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 12.4 Write docstring coverage test
    - Walk `backend/app/*.py` and `backend/train.py` with `ast`; assert every `FunctionDef`, `AsyncFunctionDef`, and `ClassDef` (including methods and nested functions) has a non-empty docstring; failure message lists `file:line name` for each missing one
    - File: `backend/tests/test_docstrings.py`
    - _Requirements: 12.1_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Start `python train.py` right after task 2.1 so weights are ready by the task 10 checkpoint; the backend runs without weights and reports `model_loaded: false`
- Property tests use Hypothesis (`max_examples=100`) and fast-check (`numRuns: 100`), tagged `Feature: crackbot-ai, Property N: ...`; model inference is stubbed in tests
- Each task references specific requirements for traceability
- Function_Comments are written alongside the code in each implementation task (Requirement 12.1–12.4); task 12.3 only catches gaps, so it runs last after all source files exist

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "8.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "8.2", "8.3"] },
    { "id": 2, "tasks": ["1.3", "1.4", "2.2", "3.2", "4.1", "5.2", "8.4", "8.5", "8.6"] },
    { "id": 3, "tasks": ["3.3", "4.2", "4.3", "5.3", "5.4", "5.5", "9.1", "9.2", "9.3"] },
    { "id": 4, "tasks": ["4.4", "4.5", "4.6", "4.7", "5.1", "5.6", "5.7", "9.4", "11.1"] },
    { "id": 5, "tasks": ["4.8", "4.9", "4.10", "6.1", "9.5", "11.2", "11.3", "11.4", "11.5"] },
    { "id": 6, "tasks": ["6.2", "6.3", "11.6", "11.7", "12.1"] },
    { "id": 7, "tasks": ["11.8", "12.2"] },
    { "id": 8, "tasks": ["12.3"] },
    { "id": 9, "tasks": ["12.4"] }
  ]
}
```
