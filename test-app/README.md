# test-app

> Built with [Gene](https://github.com/gene-framework/gene) 🧬

## Development

```bash
# Start everything at once
gene dev

# Or run manually:
# Terminal 1: Python backend
cd backend && python -m uvicorn app:app --reload --port 18764

# Terminal 2: React frontend
cd frontend && npm run dev

# Terminal 3: Electron
GENE_DEV=true npx electron .
```

## Build & Package

```bash
gene build     # Build Python (PyInstaller) + React (Vite)
gene package   # Create installer (.exe / .dmg / .AppImage)
```

## Project Structure

- `electron/` — Electron main process
- `frontend/` — React + Tailwind (Vite)
- `backend/` — Python FastAPI server
- `gene.config.json` — Gene configuration
