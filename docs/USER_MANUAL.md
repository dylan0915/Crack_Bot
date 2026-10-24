# CrackBot AI — User Manual

This guide explains, step by step, how to set up and use CrackBot AI. You do not need to be a
programmer. Whenever you see a grey box with a command, copy it, paste it into PowerShell, and
press **Enter**.

**What CrackBot AI does:** you show it a photo of concrete (from your webcam or a file). It finds the
cracks, draws them on the photo, measures them, works out where each crack is from a robot arm's
point of view, plans a route for the robot's tool, and plays an animation of the tool following
that route. No real robot is needed. Every inspection is saved so you can look at it again later.

**Contents**

1. [First-time setup and training](#1-first-time-setup-and-training)
2. [Starting the app](#2-starting-the-app)
3. [Screen tour](#3-screen-tour)
4. [Getting a photo: webcam or upload](#4-getting-a-photo-webcam-or-upload)
5. [Running an analysis and reading the results](#5-running-an-analysis-and-reading-the-results)
6. [Calibration settings (with a worked example)](#6-calibration-settings-with-a-worked-example)
7. [Robot path simulation](#7-robot-path-simulation)
8. [History](#8-history)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. First-time setup and training

You only do this once.

### 1.1 Install the tools

1. Install **Python** (version 3.11 or newer) from https://www.python.org/downloads/.
   During installation, tick **"Add python.exe to PATH"**.
2. Install **Node.js** (the "LTS" version) from https://nodejs.org/.
3. Open **PowerShell** (press the Windows key, type `PowerShell`, press Enter).
4. Check both are installed. Each command should print a version number:

   ```powershell
   python --version
   node --version
   ```

> **OneDrive users:** this project is stored in OneDrive. Before continuing, right-click the
> OneDrive cloud icon near the clock and choose **Pause syncing → 24 hours**. Syncing while
> installing or training can lock files and cause errors.

### 1.2 Go to the project folder

```powershell
cd "$env:USERPROFILE\OneDrive\Documents\New folder"
```

(If you moved the project, use that folder instead. Tip: type `cd ` and drag the folder into the
PowerShell window.)

### 1.3 Set up the backend (the part that runs the AI)

Run these one at a time:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

After the last command, the line in PowerShell starts with **(.venv)**. That means the project's
private Python is switched on.

> If you see *"running scripts is disabled on this system"*, run
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, answer **Y**, and try again.

Now install PyTorch (the AI engine). Pick **one** line:

- If your laptop has **Intel Arc graphics** (most Intel Core Ultra laptops; check in
  **Task Manager → Performance → GPU**):

  ```powershell
  pip install torch==2.12.1+xpu torchvision==0.27.1+xpu --index-url https://download.pytorch.org/whl/xpu --extra-index-url https://pypi.org/simple
  ```

  Use exactly version 2.12.1. Newer versions give wrong answers on some Intel Arc chips.

- If your laptop has an **NVIDIA graphics card**:

  ```powershell
  pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cu128
  ```

- Otherwise (most laptops):

  ```powershell
  pip install torch==2.14.1 torchvision==0.29.1 --index-url https://download.pytorch.org/whl/cpu
  ```

Then install everything else:

```powershell
pip install -r requirements.txt
```

This takes a few minutes. It is finished when you see the **(.venv)** prompt again with no red error text.

### 1.4 Train the crack model

The app needs a trained "crack brain" before it can analyze photos. Still in the `backend` folder
with **(.venv)** showing, run:

```powershell
python train.py
```

What happens:

1. It downloads a set of practice photos of cracked concrete (only the first time).
2. It trains for 50 rounds ("epochs"). Progress bars show each round.
3. At the end it prints two lines like:

   ```
   Saved weights to: C:\...\backend\weights\best.pt
   Validation mask mAP50: 0.6512
   ```

   The first line is where the trained model was saved. The second is an accuracy score from 0 to 1
   (higher is better; around 0.5–0.7 is typical for this dataset).

**How long does it take?** With an NVIDIA graphics card, roughly 20–60 minutes. On a regular laptop
processor it can take **many hours**. For a quick try, use a shorter training:

```powershell
python train.py --epochs 1
```

This finishes much faster but finds cracks less reliably. A good middle ground on a laptop:

```powershell
python train.py --epochs 10 --imgsz 416 --batch 8
```

### 1.5 Install the frontend (the part you see in the browser)

Open a **second** PowerShell window and run:

```powershell
cd "$env:USERPROFILE\OneDrive\Documents\New folder\frontend"
npm install
```

---

## 2. Starting the app

Every time you want to use CrackBot AI, open **two** PowerShell windows and keep both open.

**Window 1 — backend:**

```powershell
cd "$env:USERPROFILE\OneDrive\Documents\New folder\backend"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Wait for the line `Uvicorn running on http://127.0.0.1:8000`. You should also see
`CrackBot backend ready (model loaded: True, ...)`. If it says `model loaded: False`, the model is
not trained yet (see section 1.4).

**Window 2 — frontend:**

```powershell
cd "$env:USERPROFILE\OneDrive\Documents\New folder\frontend"
npm run dev
```

Wait for a line showing `http://127.0.0.1:5173/`.

**Open the app:** in Chrome or Edge go to **http://127.0.0.1:5173** (http://localhost:5173 usually works too).

**To stop the app:** click into each PowerShell window and press **Ctrl + C**.

> If you train the model while the backend is running, stop the backend (Ctrl + C) and start it
> again so it picks up the new model.

---

## 3. Screen tour

```
┌──────────────────────────────────────────────────────────────────────────┐
│ CrackBot AI           [ Inspect ] [ History ]        ● Model ready · cpu │  ← header
├──────────────────────────────────────────────────────────────────────────┤
│ (yellow banner appears here only if the model is not trained)            │  ← model banner
├──────────────────────┬───────────────────────────────────────────────────┤
│ WEBCAM               │ INSPECTION                             [Analyze]  │
│  live preview        │  photo with cracks outlined + tool path           │
│  [Start] [Capture]   │                                                   │
│ UPLOAD IMAGE         │  DETECTED CRACKS  (table)                         │
│  [Choose file]       │                                                   │
│ CALIBRATION          │  ROBOT PATH SIMULATION  [Start] [Pause] [Reset]   │
│  mm per pixel        │   Status · Waypoint n / N · Tool at (mm)          │
│  Offset X / Offset Y │   waypoint list                                   │
│  [Save settings]     │                                                   │
└──────────────────────┴───────────────────────────────────────────────────┘
```

| Area | What it is for |
|---|---|
| **Header** | App name, the **Inspect** and **History** tabs, and a status light: green "Model ready", amber "Model not trained", or red "Backend offline". It also shows `cpu` or `cuda:0` (graphics card). |
| **Model banner** | A yellow strip that appears only when the model is not trained. It shows where the app expects the model file. |
| **Webcam panel** | Live camera preview, **Start webcam / Stop webcam**, and **Capture snapshot**. |
| **Upload image panel** | **Choose file** to pick a photo from your computer. |
| **Calibration panel** | Three boxes that tell the app how photo pixels relate to robot-arm millimeters, and **Save settings**. |
| **Inspection panel** | The **Analyze** button, the photo (with cracks drawn on it after analysis), a summary line, and links to open the saved overlay and mask images. |
| **Detected cracks** | A table with one row per crack. |
| **Robot path simulation** | **Start/Resume**, **Pause**, **Reset**, the status, the current waypoint, the tool's live arm position, and the waypoint list. |
| **History tab** | Cards for every saved inspection, newest first. |

---

## 4. Getting a photo: webcam or upload

You need one photo selected before you can analyze. Picking a new photo replaces the previous one.

### Webcam snapshot

1. Click **Start webcam**.
2. The first time, the browser asks for camera permission. Click **Allow**.
3. Point the camera straight down at the concrete. Hold it steady and make sure the area is well lit.
4. Click **Capture snapshot**. The still picture appears in the Inspection panel on the right.
5. Click **Stop webcam** when you are done, so other apps can use the camera.

### Upload a file

1. In **Upload image**, click **Choose file**.
2. Pick a **JPEG** (`.jpg`, `.jpeg`), **PNG** (`.png`), or **BMP** (`.bmp`) picture.
3. The picture appears in the Inspection panel.

If you choose another type of file (for example a PDF or HEIC photo), you see:
*"Unsupported file. Please choose a JPEG, PNG, or BMP image."*

---

## 5. Running an analysis and reading the results

1. With a photo selected, click **Analyze** (top right of the Inspection panel).
2. A spinning circle and "Analyzing…" appear. This takes about a second with a graphics card, a few
   seconds on a regular processor. The Analyze button is greyed out while it works.
3. The photo is replaced by the analyzed version.

### Reading the photo

| You see | It means |
|---|---|
| **Red see-through fill** | The pixels the model believes are crack. |
| **Green line** | The crack's outline (its border). |
| **Yellow rectangle** | The smallest upright box that contains the whole crack. |
| **White label "#0", "#1", …** | The crack's number. **#0** is the crack the model is most sure about. |
| **Cyan dashed line** | The planned route of the robot tool. |
| **Pink dot** | The simulated robot tool (see section 7). |

If nothing is found, the table area shows **"No cracks detected"**.

### Reading the "Detected cracks" table

| Column | Meaning |
|---|---|
| **#** | Crack number, matching the label on the photo. |
| **Confidence** | How sure the model is, from 0 to 1. For example 0.87 means quite sure. Cracks below 0.25 are not shown. |
| **Area (px / mm²)** | How much surface the crack covers: first in pixels, then in square millimeters. |
| **Length (px / mm)** | How long the crack is along its middle line: in pixels, then in millimeters. |
| **Center (px)** | The crack's middle point on the photo, as (left-right, top-down) pixels from the top-left corner. |
| **Center arm (mm)** | The same middle point in **robot-arm coordinates**: where the robot would move to reach this crack. |

The millimeter values are only as accurate as your calibration settings (section 6).

Below the photo, the summary line shows the inspection's id, date, crack count, and the calibration
used. **Open overlay image** and **Open mask image** open the saved pictures in a new tab (the mask
shows cracks in white on black).

Every analysis is saved automatically. You can find it later in **History**.

---

## 6. Calibration settings (with a worked example)

The app has to know how photo pixels relate to the robot arm's real-world millimeters. It assumes
the camera looks **straight down** at a **flat** surface.

| Setting | Meaning |
|---|---|
| **mm per pixel** | How many millimeters one pixel covers on the surface. Must be greater than 0. |
| **Offset X (mm)** | Where the photo's **left edge** is along the arm's X axis. |
| **Offset Y (mm)** | Where the photo's **top edge** is along the arm's Y axis. Offsets can be 0 or negative. |

The formulas are:

```
arm X = pixel x × mm per pixel + Offset X
arm Y = pixel y × mm per pixel + Offset Y
```

### How to find "mm per pixel"

1. Put a ruler flat on the surface and take a snapshot.
2. Open the snapshot in any image viewer that shows pixel positions (for example Paint: the
   position appears in the bottom-left corner as you move the mouse).
3. Find how many pixels apart two ruler marks are, for example 0 cm and 10 cm (100 mm) are 200 pixels apart.
4. mm per pixel = 100 mm ÷ 200 pixels = **0.5**.

### How to find the offsets

Measure, with the arm's own coordinate system, where the top-left corner of the camera's view is.
If the corner sits at arm position X = 100 mm, Y = −20 mm, then Offset X = **100** and Offset Y = **−20**.

### Worked example

Settings: mm per pixel = **0.5**, Offset X = **100**, Offset Y = **−20**.
A crack's center is at pixel **(200, 80)**.

```
arm X = 200 × 0.5 + 100 = 100 + 100 = 200.00 mm
arm Y =  80 × 0.5 − 20  =  40 −  20 =  20.00 mm
```

So the robot would move to **(200.00, 20.00) mm**. Results are always rounded to 2 decimal places.

### Saving the settings

1. Type the three values in the **Calibration** panel.
2. Click **Save settings**. You see "Settings saved. They apply to the next analysis."
3. Click **Analyze** again to see the results with the new settings. Old inspections keep the
   settings they were made with.

If a value is wrong (empty, not a number, or mm per pixel of 0 or less), a red message appears under
that box and nothing is saved. The settings are stored on your computer and are remembered the next
time you start the app. The defaults are 1.0 mm per pixel and offsets of 0.

---

## 7. Robot path simulation

After an analysis that found cracks, the **Robot path simulation** section shows the route the robot
tool would take. The tool visits the crack closest to the arm's origin first, then always moves to
the nearest crack it has not visited yet. On each crack it follows the crack's middle line with up to
50 stops ("waypoints").

| Control | What it does |
|---|---|
| **Start** | The pink dot starts moving along the cyan route from the first waypoint. |
| **Pause** | The dot stops where it is. The Start button now reads **Resume**. |
| **Resume** | The dot continues from where it stopped. |
| **Reset** | The dot jumps back to the first waypoint and the status returns to "Ready". |

While it runs:

- **Status** shows *Ready*, *Inspecting…*, *Paused*, or **Inspection complete** (when the dot reaches
  the last waypoint and stops).
- **Waypoint** shows which stop the tool has reached, for example `12 / 85`.
- **Tool at (mm)** shows the tool's live robot-arm position.
- The **waypoint list** highlights the current stop in pink and scrolls to keep it in view. Each row
  shows the waypoint number, the crack it belongs to (#), and its arm X and Y in millimeters.

To watch it again after "Inspection complete", click **Reset** and then **Start**.
If no cracks were found, the buttons are greyed out and the text says there are no cracks to visit.

---

## 8. History

1. Click the **History** tab at the top.
2. Each card shows a preview picture (with cracks drawn), the date and time, the number of cracks,
   and the inspection id. The newest inspection is first.
3. Click a card to reopen it. The app switches to the **Inspect** tab and shows that inspection's
   photo, outlines, crack table, tool route, and simulation, exactly as saved.
4. Click **Refresh** to reload the list.

If nothing has been saved yet, you see **"No inspections yet"**.

Saved inspections live in `backend\data\inspections\`. Each one is a folder with `original.png`,
`overlay.png`, `mask.png`, and `report.json` (all the numbers). To delete an inspection, close the app
and delete its folder.

---

## 9. Troubleshooting

### "Model not trained — run train.py first" banner

The backend cannot find the trained model file at the path shown in the banner, so **Analyze** is
greyed out.

1. Train the model (section 1.4) and wait for "Saved weights to: …".
2. Stop the backend window with **Ctrl + C** and start it again (section 2).
3. Refresh the browser page. The banner disappears and the header shows "Model ready".

If training finished but the banner remains, check that the file named in the banner exists.

### Webcam access denied or no webcam

You see *"Webcam unavailable: …. You can still upload an image."*

- **"access was denied"**: click the camera icon (or padlock) at the left of the address bar, set
  Camera to **Allow**, and reload the page. Also check Windows **Settings → Privacy & security →
  Camera** and make sure camera access is on for your browser.
- **"no webcam was found"**: plug in or enable the camera.
- **"being used by another app"**: close Teams, Zoom, the Camera app, or other programs using it.

You can always use **Upload image** instead.

### "Cannot reach backend at http://127.0.0.1:8000"

The browser cannot talk to the backend (the header shows a red "Backend offline").

1. Check that the backend PowerShell window (Window 1) is still open and shows
   `Uvicorn running on http://127.0.0.1:8000`.
2. If it was closed or shows an error, start it again (section 2).
3. Refresh the page (the app also re-checks when you click back into the browser window).
4. If it says the port is already in use, another copy is running; close the other window or restart the computer.

### "Unsupported file. Please choose a JPEG, PNG, or BMP image."

The file is not one of the supported types. Convert it (for example open it in Paint and use
**Save as → PNG**) and upload it again. iPhone HEIC photos must be converted first.
If the backend says *"Invalid image: could not decode the uploaded file"*, the file is damaged or
mislabeled; re-save it as PNG.

### "No module named 'ultralytics'" (or 'fastapi', 'cv2', 'torch')

The script was started with your computer's main Python instead of the project's own Python,
which is where the libraries were installed. This often happens with the editor's **Run ▷** button.

Run it from PowerShell instead:

```powershell
cd "$env:USERPROFILE\OneDrive\Documents\New folder\backend"
.\.venv\Scripts\Activate.ps1
python train.py
```

Make sure the line starts with **(.venv)** before you type `python`. In the editor, you can also pick
the right Python: press **Ctrl + Shift + P**, choose **Python: Select Interpreter**, and pick
`backend\.venv\Scripts\python.exe`.

### Training is very slow

Training on a regular processor (CPU) is slow; 50 epochs can take many hours.

- Use fewer rounds: `python train.py --epochs 10 --imgsz 416 --batch 8`
- For a quick demo: `python train.py --epochs 1`
- Look at the line `Training hardware: ...` that appears when training starts. If it says **CPU**
  but you have Intel Arc or NVIDIA graphics, you installed the CPU version of PyTorch. Reinstall it
  with the matching line in section 1.3, then check:
  `python -c "import torch; print('nvidia', torch.cuda.is_available(), '| intel', torch.xpu.is_available())"`.
  One of them should print `True`. If both say `False`, update your graphics driver and restart.
- To force the Intel graphics chip: `python train.py --device xpu`.
- If you see *"Intel GPU (XPU) self-test failed … using the CPU instead"*, your PyTorch version
  gives wrong answers on your Intel chip. Reinstall the 2.12.1 version from section 1.3.
- Intel Arc graphics built into the processor speed training up by roughly 1.4×, not 10×. That is
  normal: for this small model, loading the photos takes about as long as the math.
- **NPU ("Intel AI Boost", "Ryzen AI") cannot be used for training.** NPUs only run models that
  are already trained, and PyTorch training on Windows does not support them. The GPU is the fastest
  option for training.
- While training on the Intel GPU, Task Manager may show low "3D" usage. Switch one of the GPU
  graphs to **Compute** to see the real activity.
- If you see "out of memory", lower the batch: `--batch 4`.
- Plug the laptop into power and keep it from going to sleep.

### Errors caused by OneDrive ("Access is denied", "file is being used by another process", "PermissionError")

OneDrive locks files while syncing them.

1. Pause OneDrive (right-click the cloud icon → **Pause syncing**) and run the command again.
2. Keep large folders out of OneDrive. For the training photos, use a folder outside OneDrive:

   ```powershell
   python train.py --datasets-dir C:\crackbot-data\datasets
   ```

3. If `pip install` or `npm install` failed halfway, delete `backend\.venv` or
   `frontend\node_modules` and run the setup step again with OneDrive paused.
4. For the smoothest experience, move the whole project folder to a place outside OneDrive, such as
   `C:\CrackBot`, and use that path in the commands above.
