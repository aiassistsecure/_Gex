# `_Gex` Backend Engine

The core AI code surgery engine for **`_Gex`**. Built with FastAPI, this backend orchestrates the entire lifecycle of an AI code modification: repository scanning, LLM inference, surgical block extraction, safe sandboxing, and diff computation.

## 🧬 Architecture

The backend consists of several key subsystems located in the `gex/` module:

- **`scanner.py`**: Rapidly crawls your target repository, filters out binary/hidden files, strings together line-numbered source code, and prepares the context window.
- **`runner.py`**: The central orchestrator. It manages the LLM asynchronous calls, builds the system prompts, and coordinates the diffing process.
- **`patch.py`**: The proprietary block-parsing engine. It safely extracts `<<<WRITE>>>` and `<<<PATCH>>>` blocks from raw LLM outputs using an advanced dual-pass iterator to prevent payload corruption and safely ignores hallucinated markdown.
- **`diff.py`**: Computes ultra-precise, structured Git-style hunks comparing the sandbox clone to the live workspace.

## 🛡️ The Sandbox Clone System

To guarantee 100% safety, the `_Gex` backend **never touches your live code** during its initial run.

1. When a run is initiated, the target file/repo is cloned to a temporary `_gex_repos/` directory.
2. The LLM's patches are successfully validated and applied strictly to the sandbox.
3. The patched sandbox is diffed against your actual workspace.
4. The exact hunks are sent to the frontend for human review and manual application.

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Running LLM API endpoint (default configurations target an OpenAI-compatible API endpoint).

### Installation

1. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\Activate.ps1

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure your API endpoint and keys in the `.env` file or directly inside `main.py` if applicable.

### Running the Server

Start the FastAPI backend with Uvicorn:
```bash
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The server will begin accepting Websocket/REST connections from the React frontend.

## 📄 License

This software is provided under the **Interchained Source-Available License**. 
Commercial competitors are prohibited from training or operating competing services using this code. Refer to the root or frontend `LICENSE` file for strict conditions regarding branding, trademarks, and open-source constraints.
