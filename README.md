# `_Gex` Code Surgery UI

The official frontend for **`_Gex`** — an AI-native surgical code modification environment. Built with React and Vite, this UI integrates the Monaco Editor to provide a "Microsoft IDE x Bloomberg Terminal" experience for reviewing, generating, and applying high-density LLM code patches.

## 🧬 Philosophy

AI should not blindly write code.

AI should propose.
Humans should control.

## ⚡ Features

- **Circuit Diff Viewer**: Real-time, side-by-side visualization of AI-generated surgical code patches using Monaco's diff editor.
- **Run Engine Dashboard**: Live streaming of the `_Gex` backend patcher, showing applied blocks, parser strategies, and surgical hunks in real-time.
- **Dark-Mode Native**: A premium, terminal-inspired aesthetic with holographic accents and clean typography (Inter/JetBrains Mono).
- **Safe Sandboxing**: View what patches the LLM applied to your repository clone before ever modifying your live workspace files.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Ensure the `_Gex` backend (FastAPI) is running on `http://localhost:8000`.

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser and navigate to the local server URL provided by Vite (typically `http://localhost:5173`).

## 🛠️ Architecture

- **Framework**: React 18 + Vite
- **Code Highlights**: `@monaco-editor/react` for robust syntax highlighting and diff comparisons.
- **State Management**: Zustand simplifies the sharing of `FileResult` runs and system health checks across the application.
- **Styling**: Pure CSS with CSS modules and a global `index.css` design system.

## 📄 License

This software is provided under a custom MIT License with Commercial Restrictions.

This project is source-available under a permissive MIT-style license with
additional protections for branding and commercial competition.

The names "Gex", "_Gex", "AiAssist Secure", and "Interchained" are reserved to Interchained LLC. You may not use this software to build or operate a directly competing AI code modification platform as a commercial product without explicit written permission.

See the [LICENSE](./LICENSE) file for complete details and attribution requirements.

For commercial use or backend access:
dev@interchained.org