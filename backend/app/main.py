"""The CrackBot AI web server.

Start it from the ``backend`` folder with:

    uvicorn app.main:app --host 127.0.0.1 --port 8000

It only listens on this computer (127.0.0.1) and has no login, because it is
meant for a local demo.
"""

import logging
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from . import config
from .detection import build_detections
from .imaging import InvalidImageError, decode_image
from .inspection_store import InspectionSaveError, InspectionStore, files_for
from .model_service import ModelService
from .path_planner import plan_tool_path
from .render import render_mask, render_overlay
from .schemas import (
    CalibrationSettings,
    InspectionReport,
    InspectionResponse,
    InspectionSummary,
    StatusResponse,
)
from .settings_store import SettingsStore

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("crackbot")


def create_app(
    model_service: ModelService | None = None,
    settings_path: Path = config.SETTINGS_PATH,
    inspections_dir: Path = config.INSPECTIONS_DIR,
) -> FastAPI:
    """Build the web server with all its addresses (routes) ready to use.

    Args:
        model_service: The crack model helper to use. When left empty, one is
            created that loads ``weights/best.pt`` at startup. Tests pass in a
            fake one here.
        settings_path: Where the calibration settings file lives.
        inspections_dir: The folder where inspections are saved.

    Returns:
        The configured FastAPI application.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Prepare the model and storage when the server starts.

        Args:
            app: The application being started.

        Returns nothing; it pauses (yields) while the server runs.
        """
        service = model_service or ModelService(config.WEIGHTS_PATH)
        if model_service is None:
            service.load()
        app.state.model_service = service
        app.state.settings_store = SettingsStore(settings_path)
        app.state.inspection_store = InspectionStore(inspections_dir)
        logger.info(
            "CrackBot backend ready (model loaded: %s, device: %s)", service.is_loaded, service.device
        )
        yield

    app = FastAPI(title="CrackBot AI", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/status", response_model=StatusResponse)
    def get_status(request: Request) -> StatusResponse:
        """Report whether the trained crack model is ready.

        Args:
            request: The incoming web request (used to reach the shared model helper).

        Returns:
            Whether the model is loaded, where its file is expected, and the hardware used.
        """
        service: ModelService = request.app.state.model_service
        return StatusResponse(
            model_loaded=service.is_loaded,
            weights_path=str(service.weights_path),
            device=service.device,
        )

    @app.get("/api/settings", response_model=CalibrationSettings)
    def get_settings(request: Request) -> CalibrationSettings:
        """Send back the calibration settings currently in use.

        Args:
            request: The incoming web request.

        Returns:
            The current mm-per-pixel scale and X/Y offsets.
        """
        return request.app.state.settings_store.current

    @app.put("/api/settings", response_model=CalibrationSettings)
    def put_settings(cal: CalibrationSettings, request: Request) -> CalibrationSettings:
        """Save new calibration settings; later analyses use them.

        Invalid values (for example a scale of zero or less) are rejected
        automatically with error code 422 before this code runs.

        Args:
            cal: The new settings sent by the frontend.
            request: The incoming web request.

        Returns:
            The settings that were saved.

        Raises:
            HTTPException: Code 500 if the settings file could not be written.
        """
        try:
            request.app.state.settings_store.save(cal)
        except OSError as exc:
            logger.exception("Could not save settings")
            raise HTTPException(status_code=500, detail=f"Failed to save settings: {exc}") from exc
        return cal

    # A plain "def" (not "async def") makes FastAPI run this in a worker thread,
    # so slow model work does not freeze the rest of the server.
    @app.post("/api/analyze", response_model=InspectionResponse)
    def analyze(request: Request, file: UploadFile = File(...)) -> InspectionResponse:
        """Find cracks in an uploaded photo, plan the tool path, and save everything.

        Args:
            request: The incoming web request.
            file: The uploaded photo (JPEG, PNG, or BMP).

        Returns:
            The full inspection record plus the addresses of its saved images.

        Raises:
            HTTPException: 503 if the model is not trained yet, 400 if the file
                is not a readable picture, 500 if detection or saving fails.
        """
        service: ModelService = request.app.state.model_service
        settings_store: SettingsStore = request.app.state.settings_store
        store: InspectionStore = request.app.state.inspection_store

        if not service.is_loaded:
            raise HTTPException(
                status_code=503,
                detail=config.MODEL_NOT_LOADED_MSG.format(path=service.weights_path),
            )
        try:
            image = decode_image(file.file.read())
        except InvalidImageError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        threshold = config.DEFAULT_CONFIDENCE
        cal = settings_store.current  # snapshot so one analysis uses one set of settings
        try:
            raw = service.predict(image, conf=threshold)
        except Exception as exc:
            logger.exception("Inference failed")
            raise HTTPException(status_code=500, detail=f"Inference failed: {type(exc).__name__}") from exc

        h, w = image.shape[:2]
        detections, geoms = build_detections(raw, h, w, threshold, cal)
        tool_path = plan_tool_path(detections, geoms, cal)

        now = datetime.now().astimezone()
        report = InspectionReport(
            id=store.new_id(now),
            created_at=now,
            image_width=w,
            image_height=h,
            calibration=cal,
            weights_path=str(service.weights_path),
            confidence_threshold=threshold,
            detections=detections,
            tool_path=tool_path,
        )
        try:
            store.save(report, image, render_overlay(image, geoms), render_mask(h, w, geoms))
        except InspectionSaveError as exc:
            logger.exception("Saving inspection failed")
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        logger.info("Inspection %s: %d crack(s), %d waypoint(s)", report.id, len(detections), len(tool_path))
        return InspectionResponse(report=report, files=files_for(report.id))

    @app.get("/api/inspections", response_model=list[InspectionSummary])
    def list_inspections(request: Request) -> list[InspectionSummary]:
        """List saved inspections for the history screen, newest first.

        Args:
            request: The incoming web request.

        Returns:
            A short summary of each saved inspection.
        """
        return request.app.state.inspection_store.list()

    @app.get("/api/inspections/{inspection_id}", response_model=InspectionResponse)
    def get_inspection(inspection_id: str, request: Request) -> InspectionResponse:
        """Reopen one saved inspection.

        Args:
            inspection_id: The inspection's unique name.
            request: The incoming web request.

        Returns:
            The inspection's full record plus the addresses of its images.

        Raises:
            HTTPException: 404 if it does not exist or its report is broken.
        """
        report = request.app.state.inspection_store.load(inspection_id)
        if report is None:
            raise HTTPException(status_code=404, detail="Inspection not found")
        return InspectionResponse(report=report, files=files_for(report.id))

    @app.get("/api/inspections/{inspection_id}/files/{name}")
    def get_inspection_file(inspection_id: str, name: str, request: Request) -> FileResponse:
        """Send one saved image (original, overlay, or mask) to the browser.

        Args:
            inspection_id: The inspection's unique name.
            name: original.png, overlay.png, or mask.png. Any other name is refused.
            request: The incoming web request.

        Returns:
            The PNG image file.

        Raises:
            HTTPException: 404 if the id or name is not allowed or the file is missing.
        """
        path = request.app.state.inspection_store.file_path(inspection_id, name)
        if path is None:
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(path, media_type="image/png")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)
