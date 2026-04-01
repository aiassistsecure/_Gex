# 🧠 Jenny Architecture & Internals

> **"Understanding the heart of the machine is the first step to mastering it."**

Jenny is not just a build tool; it is a **synchronized orchestration layer** between Node.js, Python, and the Browser. This document explains how the pieces fit together.

---

## 🏗️ 1. The Orchestrator (Node.js)

The core of Jenny's runtime management lives in `core/orchestrator/`.

*   **Process Manager**: Responsible for spawning the Python backend. In development, it runs `python -m uvicorn`. In production, it locates and executes the bundled `jenny.exe` in the `resources/python/` directory.
*   **Health Monitor**: A sidecar process that polls the Python backend's `/health` endpoint. If the backend hangs or crashes, the monitor triggers an automatic restart.
*   **Log Aggregator**: Captures `stdout` and `stderr` from the sub-processes and streams them back to the UI via WebSockets.

---

## 🔌 2. The IPC Bridge (REST + WebSockets)

Communication between the Electron frontend and the Python backend happens over two channels:

1.  **REST API (Port 18764)**: Used for discrete commands like `list_files`, `read_file`, or `apply_patch`.
2.  **WebSockets (Port 18765)**: Used for high-frequency streaming data, such as live terminal output, real-time agent thoughts, and process logs.

---

## ✂️ 3. Agentic Code Surgery

The "magic" of Jenny lies in its **Surgical Engine**. Unlike simple LLM wrappers that overwrite entire files (risking data loss and syntax errors), Jenny uses an **anchor-based patching system**.

### How it works:
1.  **Context Mapping**: The agent reads the target file and identifies unique "anchors" (unique lines of code) surrounding the target area.
2.  **Patch Generation**: The agent produces a diff containing the `targetContent` (to be removed) and `replacementContent` (to be added).
3.  **Surgical Application**: The backend parses the file, locates the exact line range between the anchors, verifies the `targetContent` matches exactly, and performs an in-memory replacement before writing back to disk.

This ensures that even if the file has changed slightly, the patch will either apply perfectly or fail safely—never "hallucinating" file corruption.

---

## 📦 4. The CLI Lifecycle

The Jenny CLI (`cli/bin/jenny.js`) manages the three stages of an app's life:

### `jenny dev`
*   Starts the Vite dev server for the frontend.
*   Starts the Python backend with `--reload` enabled.
*   Opens the Electron shell pointing to `http://localhost:3000`.

### `jenny build`
*   **Frontend**: Runs `vite build` to generate optimized static assets in `frontend/dist/`.
*   **Backend**: Invokes `PyInstaller` to compile the Python backend into a standalone executable in `backend/dist/jenny/`.

### `jenny package`
*   Uses `electron-builder` to wrap the assets and the Python executable into a native installer (`.exe`, `.dmg`, or `.AppImage`).
*   Configures `extraResources` to ensure the Python runtime is correctly mapped to the internal `resources/` folder.

---

## 📂 5. Directory Structure

*   **/_Gex_API**: The Python source code (FastAPI).
*   **/_Gex_UI**: The React source code (Vite).
*   **/cli**: The Node.js CLI source.
*   **/core**: Shared logic for Electron/Node.
*   **/python**: Templates and boilerplate used by `jenny create`.

---

🧬 **Jenny: Built for speed, safety, and agentic power.**
