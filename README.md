# 🧬 Gene — The Python Desktop App Generator

> **Electron, but Python-native and agent-powered.**

Build desktop applications using Python as the brain, Electron as the shell, and AI agents for intelligent code generation. Ship cross-platform binaries with a bundled Python runtime — no user install required.

---

## ✨ Features

- **🐍 Python-first** — FastAPI backend as your app's intelligence layer
- **⚛️ React + Tailwind** — Modern, beautiful frontend out of the box
- **⚡ Electron shell** — Native desktop window with system integrations
- **🤖 AI Agents** — Code generation and surgical patching via [AiAssist.net](https://aiassist.net)
- **📦 Self-contained** — Ships with bundled Python runtime (PyInstaller)
- **🔌 Plugin system** — Extend with custom Python tools
- **🛠️ CLI** — `gene create`, `gene dev`, `gene build`, `gene package`
- **🔄 Hot reload** — Dev mode with auto-restart for both frontend and backend
- **🌍 Cross-platform** — Windows, macOS, Linux via GitHub Actions CI/CD

---

## 🚀 Quick Start

```bash
# Install Gene CLI
npm install -g gene-python-desktop-generator

# Create a new app
gene create my-app

# Start developing
cd my-app
gene dev
```

### What happens when you run `gene dev`:

1. 🐍 Python backend starts (FastAPI + hot reload)
2. ⚛️ React dev server starts (Vite + HMR)  
3. ⚡ Electron window opens and connects

---

## 📁 Project Structure

A Gene app has three layers:

```
my-app/
├── electron/           # Electron main process
│   ├── main.js         # Window + IPC + Python lifecycle
│   └── preload.js      # Secure contextBridge
├── frontend/           # React + Tailwind (Vite)
│   ├── src/
│   │   ├── App.jsx     # Your React app
│   │   └── index.css   # Tailwind + custom styles
│   ├── package.json
│   └── vite.config.js
├── backend/            # Python FastAPI
│   ├── app.py          # FastAPI application
│   ├── routes.py       # Your API endpoints
│   └── requirements.txt
├── gene.config.json    # Gene configuration
└── package.json        # Electron + build config
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Shell                        │
│  ┌──────────────┐    IPC    ┌──────────────────────┐   │
│  │   Renderer   │◄────────►│    Main Process       │   │
│  │  (React UI)  │          │  (Window + Lifecycle)  │   │
│  └──────┬───────┘          └──────────┬─────────────┘   │
│         │                             │                  │
│         │  WebSocket                  │  spawn/manage    │
│         │                             │                  │
│  ┌──────▼─────────────────────────────▼─────────────┐   │
│  │              Python Runtime (FastAPI)              │   │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────────────┐  │   │
│  │  │ Routes  │ │  Agents  │ │  Plugin System   │  │   │
│  │  └─────────┘ └──────────┘ └──────────────────┘  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Communication:**
- Renderer ↔ Python: **WebSocket** (real-time) + **HTTP REST** (CRUD)
- Renderer ↔ Main: **IPC** via secure contextBridge
- Main → Python: **child_process.spawn** with health monitoring

---

## 🤖 AI Agents (Optional)

Gene includes an agent system powered by [AiAssist.net](https://aiassist.net):

```bash
# Set your AiAssist API key
export GENE_AIASSIST_API_KEY=aai_your_key_here
```

### Available agents:

| Agent | Purpose | Needs AI? |
|-------|---------|-----------|
| **Analyzer** | Scan project structure, detect frameworks | No |
| **Generator** | Generate code from natural language | Yes |
| **Patcher** | Surgical code edits (Gex-style) | Yes |

The AI is 100% optional — your app works perfectly without it.

---

## 📦 Building & Packaging

```bash
# Build for production
gene build
# → Bundles Python with PyInstaller
# → Builds React with Vite

# Package into installer
gene package
# → Creates .exe (Windows), .dmg (macOS), .AppImage (Linux)
```

The packaged app includes a **complete Python runtime** — end users don't need Python installed.

---

## 🔌 Plugins

Create a plugin in `plugins/my-plugin/`:

```python
# plugins/my-plugin/main.py
from gene.plugins.base import PluginBase

class MyPlugin(PluginBase):
    async def execute(self, params):
        return {"result": "Hello from plugin!"}
```

```json
// plugins/my-plugin/plugin.json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "entry": "main.py"
}
```

---

## ⚙️ Configuration

`gene.config.json`:

```json
{
  "appName": "My App",
  "python": {
    "port": 18764,
    "wsPort": 18765
  },
  "electron": {
    "width": 1280,
    "height": 800,
    "devPort": 3000
  },
  "aiassist": {
    "apiKey": "",
    "provider": ""
  },
  "telemetry": false
}
```

Environment variables (override config):

| Variable | Description |
|----------|-------------|
| `GENE_PORT` | Python API port |
| `GENE_WS_PORT` | WebSocket port |
| `GENE_AIASSIST_API_KEY` | AiAssist.net API key |
| `GENE_AIASSIST_PROVIDER` | Default LLM provider |
| `GENE_DEBUG` | Enable debug mode |

---

## 🛠️ CLI Reference

| Command | Description |
|---------|-------------|
| `gene create <name>` | Scaffold new app |
| `gene dev` | Start dev mode |
| `gene build` | Build for production |
| `gene package` | Package into installer |
| `gene info` | Show environment info |

---

## 📄 License

MIT

---

Built with 🧬 by the Gene community • Powered by [AiAssist.net](https://aiassist.net)
