# {{ project_name }}

> Built with [Jenny](https://github.com/jenny-framework/jenny) 🧬

## Development

```bash
# Start everything at once
jenny dev

# Or run manually:
# Terminal 1: Python backend
cd backend && python -m uvicorn app:app --reload --port 18764

# Terminal 2: React frontend
cd frontend && npm run dev

# Terminal 3: Electron
JENNY_DEV=true npx electron .
```

## Build & Package

```bash
jenny build     # Build Python (PyInstaller) + React (Vite)
jenny package   # Create installer (.exe / .dmg / .AppImage)
```

## Project Structure

- `electron/` — Electron main process
- `frontend/` — React + Tailwind (Vite)
- `backend/` — Python FastAPI server
- `jenny.config.json` — Jenny configuration
