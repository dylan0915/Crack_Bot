# Requirements Document

## Introduction

CrackBot AI is a hackathon MVP for autonomous concrete inspection. It is a local web application that runs on a Windows laptop with a webcam and no robot hardware. A fine-tuned YOLO11n-seg segmentation model (trained on the Ultralytics Crack-seg dataset) detects and outlines cracks in concrete images. The application converts crack positions from image pixels into robotic-arm coordinates using a fixed scale and offset, plans a tool path across detected cracks, and simulates the inspection by animating a marker along that path. Each inspection is saved to the local filesystem with a JSON report and can be reopened from a history view.

The frontend is React + TypeScript + Vite + Tailwind with Canvas or SVG visualization. The backend is Python 3.11+ with FastAPI, PyTorch, Ultralytics, OpenCV, and NumPy. Frontend and backend communicate over REST. Storage is the local filesystem plus JSON files.

## Glossary

- **CrackBot_App**: The complete local application, consisting of the Frontend and the Backend.
- **Frontend**: The React + TypeScript single-page web application running in the browser.
- **Backend**: The Python FastAPI server that loads the Model, runs inference, computes coordinates, plans paths, and manages storage.
- **Training_Script**: The Python script `train.py` that fine-tunes YOLO11n-seg on the Crack-seg dataset and outputs a Weights_File.
- **Model**: The fine-tuned YOLO11n-seg segmentation model loaded by the Backend from the Weights_File.
- **Weights_File**: The trained model weights file `best.pt` produced by the Training_Script, located at a configured path.
- **Crack-seg_Dataset**: The Ultralytics Crack-seg segmentation dataset of concrete crack images.
- **Inspection**: One analysis run on one input image, including the original image, detection results, Overlay_Image, Mask_Image, Tool_Path, and Inspection_Report.
- **Detection**: One crack instance found by the Model, with a segmentation mask, Outline, confidence score, Bounding_Box, Centroid, area, and length.
- **Outline**: The polygon of pixel coordinates tracing the boundary of a Detection's segmentation mask.
- **Bounding_Box**: The axis-aligned rectangle enclosing a Detection, expressed as pixel coordinates (x_min, y_min, x_max, y_max).
- **Centroid**: The center of mass of a Detection's segmentation mask, in pixel coordinates.
- **Crack_Area**: The number of mask pixels of a Detection, also reported in square millimeters using the Calibration_Settings.
- **Crack_Length**: The estimated length of a Detection along its skeleton, reported in pixels and in millimeters using the Calibration_Settings.
- **Calibration_Settings**: The user-defined mapping parameters: millimeters-per-pixel scale, arm-origin X offset in millimeters, and arm-origin Y offset in millimeters.
- **Settings_File**: The local JSON file in which the Backend persists the Calibration_Settings.
- **Arm_Frame**: The 2D coordinate system of the simulated robotic arm, in millimeters, with the camera assumed to look straight down at a flat surface.
- **Arm_Coordinate**: A point (X, Y) in the Arm_Frame computed as X = pixel_x × mm_per_pixel + offset_x and Y = pixel_y × mm_per_pixel + offset_y.
- **Waypoint**: One point on the Tool_Path, with pixel coordinates, Arm_Coordinate, and the index of the Detection the Waypoint belongs to.
- **Tool_Path**: The ordered list of Waypoints that the simulated arm tool follows to visit every Detection.
- **Path_Simulator**: The Frontend component that draws the Tool_Path over the image and animates the Tool_Marker along the Tool_Path.
- **Tool_Marker**: The visual marker representing the simulated arm tool position during the path simulation.
- **Overlay_Image**: The image file showing the original image with Detection Outlines and masks drawn over the original image.
- **Mask_Image**: The binary image file combining all Detection segmentation masks.
- **Inspection_Report**: The JSON file storing an Inspection's metadata, Calibration_Settings used, Detections, and Tool_Path.
- **Inspection_Store**: The local filesystem directory in which the Backend saves one subdirectory per Inspection.
- **History_View**: The Frontend view that lists saved Inspections and allows reopening a saved Inspection.
- **Webcam_Capture**: The Frontend component that shows a live webcam preview and captures a still snapshot.

## Requirements

### Requirement 1: Model Training Script

**User Story:** As a developer, I want a script that fine-tunes YOLO11n-seg on the Crack-seg dataset, so that the application has a trained crack segmentation model.

#### Acceptance Criteria

1. WHEN the developer runs the Training_Script, THE Training_Script SHALL fine-tune the pretrained YOLO11n-seg model on the Crack-seg_Dataset using the Ultralytics training API.
2. WHEN the Crack-seg_Dataset is absent from the local machine, THE Training_Script SHALL download the Crack-seg_Dataset through the Ultralytics dataset configuration before training.
3. THE Training_Script SHALL accept command-line arguments for number of epochs, image size, batch size, and compute device.
4. WHEN training completes, THE Training_Script SHALL copy the best weights to the Weights_File path used by the Backend.
5. WHEN training completes, THE Training_Script SHALL print the Weights_File path and the validation segmentation mAP50 value to the console.

### Requirement 2: Model Loading

**User Story:** As a user, I want the backend to load the trained model or clearly tell me to train it, so that I know whether the app is ready for inspection.

#### Acceptance Criteria

1. WHEN the Backend starts and the Weights_File exists, THE Backend SHALL load the Model from the Weights_File once and reuse the loaded Model for all inference requests.
2. IF the Weights_File is missing at Backend startup, THEN THE Backend SHALL continue running and report the Model status as not loaded.
3. THE Backend SHALL expose a status endpoint that returns whether the Model is loaded and the configured Weights_File path.
4. IF an inference request is received while the Model is not loaded, THEN THE Backend SHALL respond with HTTP status 503 and an error message instructing the user to run the Training_Script first.
5. WHILE the Model is not loaded, THE Frontend SHALL display a banner stating "Model not trained — run train.py first" together with the expected Weights_File path.
6. WHILE the Model is not loaded, THE Frontend SHALL disable the analyze action.

### Requirement 3: Image Input

**User Story:** As an inspector, I want to capture a webcam snapshot or upload an image, so that I can analyze concrete surfaces with the hardware I have.

#### Acceptance Criteria

1. WHEN the user opens the Webcam_Capture, THE Webcam_Capture SHALL display a live preview from the default webcam.
2. WHEN the user activates the capture control, THE Webcam_Capture SHALL capture the current preview frame as a still image and present the still image as the selected input.
3. IF the browser denies webcam access or no webcam is available, THEN THE Webcam_Capture SHALL display an error message and keep the image upload option available.
4. WHEN the user selects an image file in JPEG, PNG, or BMP format, THE Frontend SHALL display the selected image as the selected input.
5. IF the user selects a file that is not a JPEG, PNG, or BMP image, THEN THE Frontend SHALL display an error message stating the supported formats.
6. IF the Backend receives an image that cannot be decoded, THEN THE Backend SHALL respond with HTTP status 400 and an error message stating that the image is invalid.

### Requirement 4: Crack Detection and Segmentation

**User Story:** As an inspector, I want cracks detected and outlined in the image, so that I can see where the concrete is damaged.

#### Acceptance Criteria

1. WHEN the user activates the analyze action with a selected input image, THE Frontend SHALL send the image to the Backend analysis endpoint.
2. WHEN the Backend receives a valid image for analysis, THE Backend SHALL run the Model on the image and produce one Detection for each crack instance with confidence greater than or equal to the configured confidence threshold.
3. THE Backend SHALL use a default confidence threshold of 0.25.
4. WHEN the Backend produces a Detection, THE Backend SHALL compute the Outline, Bounding_Box, Centroid, confidence score, Crack_Area, and Crack_Length of the Detection.
5. WHEN the analysis completes, THE Frontend SHALL draw every Detection Outline and Bounding_Box over the input image using Canvas or SVG.
6. WHEN the analysis completes, THE Frontend SHALL display a detection list showing, for each Detection, the index, confidence score, Crack_Area, Crack_Length, Centroid pixel coordinates, and Centroid Arm_Coordinate.
7. WHEN the analysis finds zero Detections, THE Frontend SHALL display the message "No cracks detected".
8. WHILE an analysis request is in progress, THE Frontend SHALL display a loading indicator and disable the analyze action.
9. IF the analysis request fails, THEN THE Frontend SHALL display the error message returned by the Backend.

### Requirement 5: Pixel-to-Arm Coordinate Mapping

**User Story:** As an inspector, I want crack positions expressed in robotic-arm coordinates, so that a robot could move to each crack.

#### Acceptance Criteria

1. WHEN the Backend computes an Arm_Coordinate from a pixel point (px, py), THE Backend SHALL calculate X = px × mm_per_pixel + offset_x and Y = py × mm_per_pixel + offset_y using the current Calibration_Settings.
2. THE Backend SHALL compute the Arm_Coordinate of every Detection Centroid and every Waypoint.
3. WHEN the Backend computes Crack_Length in millimeters, THE Backend SHALL multiply the pixel length by mm_per_pixel.
4. WHEN the Backend computes Crack_Area in square millimeters, THE Backend SHALL multiply the pixel area by the square of mm_per_pixel.
5. THE Backend SHALL report all Arm_Coordinates in millimeters rounded to 2 decimal places.

### Requirement 6: Calibration Settings

**User Story:** As an inspector, I want to set the scale and arm-origin offset, so that coordinates match my physical setup.

#### Acceptance Criteria

1. THE Frontend SHALL provide a settings panel with numeric inputs for mm_per_pixel, offset_x, and offset_y.
2. WHEN the user saves the settings panel with valid values, THE Backend SHALL persist the Calibration_Settings to the Settings_File.
3. WHEN the Backend starts and the Settings_File exists, THE Backend SHALL load the Calibration_Settings from the Settings_File.
4. IF the Settings_File is missing or unreadable at Backend startup, THEN THE Backend SHALL use default Calibration_Settings of mm_per_pixel 1.0, offset_x 0.0, and offset_y 0.0.
5. IF the user submits a mm_per_pixel value less than or equal to zero or a non-numeric value, THEN THE CrackBot_App SHALL reject the submission and display a validation error message.
6. WHEN the Frontend loads, THE Frontend SHALL retrieve the current Calibration_Settings from the Backend and populate the settings panel.
7. WHEN the Calibration_Settings change, THE CrackBot_App SHALL apply the new Calibration_Settings to subsequent analyses.

### Requirement 7: Tool Path Planning

**User Story:** As an inspector, I want a planned tool path covering all detected cracks, so that I can see how the robot would inspect the surface.

#### Acceptance Criteria

1. WHEN an analysis produces one or more Detections, THE Backend SHALL generate a Tool_Path that visits every Detection.
2. THE Backend SHALL generate, for each Detection, Waypoints sampled along the Detection's skeleton with a maximum of 50 Waypoints per Detection.
3. THE Backend SHALL order the Detections in the Tool_Path using nearest-neighbor ordering starting from the Detection closest to the Arm_Frame origin.
4. THE Backend SHALL include, for each Waypoint, the pixel coordinates, Arm_Coordinate, and Detection index.
5. WHEN an analysis produces zero Detections, THE Backend SHALL return an empty Tool_Path.

### Requirement 8: Robotic Inspection Path Simulation

**User Story:** As a hackathon judge, I want to watch a simulated robot tool trace the cracks, so that I can see the autonomous inspection concept working.

#### Acceptance Criteria

1. WHEN the analysis returns a non-empty Tool_Path, THE Path_Simulator SHALL draw the Tool_Path as a connected line over the input image.
2. THE Path_Simulator SHALL display a Waypoint list showing each Waypoint index, Detection index, and Arm_Coordinate.
3. WHEN the user activates the start simulation control, THE Path_Simulator SHALL animate the Tool_Marker along the Tool_Path from the first Waypoint to the last Waypoint.
4. WHILE the simulation is running, THE Path_Simulator SHALL display the current Arm_Coordinate of the Tool_Marker and highlight the current Waypoint in the Waypoint list.
5. WHEN the user activates the pause control during the simulation, THE Path_Simulator SHALL stop the Tool_Marker at the current position until the user activates the start simulation control again.
6. WHEN the user activates the reset control, THE Path_Simulator SHALL return the Tool_Marker to the first Waypoint.
7. WHEN the Tool_Marker reaches the last Waypoint, THE Path_Simulator SHALL stop the animation and display the status "Inspection complete".
8. WHILE the Tool_Path is empty, THE Path_Simulator SHALL disable the start simulation control.

### Requirement 9: Inspection Persistence

**User Story:** As an inspector, I want every inspection saved locally, so that I can keep a record of findings.

#### Acceptance Criteria

1. WHEN an analysis completes, THE Backend SHALL create a uniquely named subdirectory in the Inspection_Store for the Inspection.
2. WHEN an analysis completes, THE Backend SHALL save the original image, the Overlay_Image, the Mask_Image, and the Inspection_Report in the Inspection subdirectory.
3. THE Backend SHALL include in the Inspection_Report the Inspection identifier, creation timestamp in ISO 8601 format, image width and height, Calibration_Settings used, Model Weights_File path, confidence threshold, Detections with Outline, Bounding_Box, Centroid, confidence score, Crack_Area, Crack_Length, and Centroid Arm_Coordinate, and the Tool_Path.
4. IF saving any Inspection file fails, THEN THE Backend SHALL respond with HTTP status 500 and an error message identifying the failed file.
5. THE Backend SHALL serve saved Inspection images to the Frontend over REST.

### Requirement 10: Inspection History

**User Story:** As an inspector, I want to browse and reopen past inspections, so that I can review earlier results.

#### Acceptance Criteria

1. THE Backend SHALL expose an endpoint that returns the list of saved Inspections with identifier, creation timestamp, Detection count, and thumbnail image URL, ordered newest first.
2. WHEN the user opens the History_View, THE History_View SHALL display the list of saved Inspections.
3. WHEN the user selects a saved Inspection in the History_View, THE Frontend SHALL load the Inspection_Report and display the original image, Detection Outlines, detection list, Tool_Path, and Path_Simulator for the selected Inspection.
4. WHEN the Inspection_Store contains zero Inspections, THE History_View SHALL display the message "No inspections yet".
5. IF a saved Inspection_Report is missing or contains invalid JSON, THEN THE Backend SHALL omit the Inspection from the list and log a warning identifying the Inspection subdirectory.

### Requirement 11: Local Setup and Run

**User Story:** As a developer on Windows, I want simple setup and run instructions, so that I can launch the demo reliably on my laptop.

#### Acceptance Criteria

1. THE CrackBot_App SHALL run on Windows using PowerShell commands for installation, training, and launch.
2. THE CrackBot_App SHALL document in a README the commands to install Backend dependencies, install Frontend dependencies, run the Training_Script, start the Backend, and start the Frontend.
3. THE Backend SHALL listen on localhost port 8000 and allow cross-origin requests from the Frontend development server origin.
4. THE Backend SHALL run Model inference on a CUDA GPU when one is available and on the CPU otherwise.
