/**
 * Gene Process Manager
 * Spawns, monitors, and manages the Python runtime process.
 * Handles crash recovery with exponential backoff.
 */

const { spawn } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

class ProcessManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.process = null;
    this.status = 'stopped'; // stopped, starting, running, crashed
    this.startTime = null;
    this.restartCount = 0;
    this.maxRestarts = 5;
    this.baseDelay = 1000;
    this._intentionalStop = false;
  }

  start() {
    if (this.process && this.status === 'running') {
      console.log('[ProcessManager] Already running');
      return;
    }

    this.status = 'starting';
    this._intentionalStop = false;

    const { isDev, pythonPath, pythonPort, wsPort, backendDir, workspaceDir } = this.options;

    let cmd, args, cwd;

    if (isDev) {
      cmd = pythonPath || 'python';
      args = [
        '-m', 'uvicorn', 'app:app',
        '--host', '127.0.0.1',
        '--port', String(pythonPort),
        '--reload',
      ];
      cwd = backendDir || path.join(workspaceDir, 'backend');
    } else {
      // Production: use bundled PyInstaller executable
      const exeName = process.platform === 'win32' ? 'gene-runtime.exe' : 'gene-runtime';
      cmd = path.join(process.resourcesPath || '.', 'python', exeName);
      args = ['--port', String(pythonPort)];
      cwd = workspaceDir;
    }

    console.log(`[ProcessManager] Spawning: ${cmd} ${args.join(' ')}`);
    console.log(`[ProcessManager] CWD: ${cwd}`);

    try {
      this.process = spawn(cmd, args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          GENE_PORT: String(pythonPort),
          GENE_WS_PORT: String(wsPort),
          GENE_WORKSPACE_DIR: workspaceDir,
          PYTHONUNBUFFERED: '1',
        },
        windowsHide: true,
      });
    } catch (err) {
      console.error(`[ProcessManager] Failed to spawn: ${err.message}`);
      this.status = 'crashed';
      this.emit('crashed', -1);
      return;
    }

    this.startTime = Date.now();
    this.status = 'running';
    this.emit('started');

    this.process.stdout.on('data', (data) => {
      this.emit('stdout', data.toString().trim());
    });

    this.process.stderr.on('data', (data) => {
      this.emit('stderr', data.toString().trim());
    });

    this.process.on('close', (code) => {
      this.process = null;
      if (this._intentionalStop) {
        this.status = 'stopped';
        this.emit('stopped', code);
      } else {
        this.status = 'crashed';
        this.emit('crashed', code);
        this._handleCrash();
      }
    });

    this.process.on('error', (err) => {
      console.error(`[ProcessManager] Process error: ${err.message}`);
      this.status = 'crashed';
      this.emit('crashed', -1);
    });
  }

  stop() {
    if (!this.process) return;
    this._intentionalStop = true;

    console.log('[ProcessManager] Stopping Python...');

    // Graceful: SIGTERM → wait 3s → SIGKILL
    this.process.kill('SIGTERM');

    setTimeout(() => {
      if (this.process && !this.process.killed) {
        console.log('[ProcessManager] Force killing Python...');
        this.process.kill('SIGKILL');
      }
    }, 3000);
  }

  restart() {
    this.stop();
    setTimeout(() => this.start(), 500);
  }

  _handleCrash() {
    if (this.restartCount >= this.maxRestarts) {
      console.error(`[ProcessManager] Max restarts (${this.maxRestarts}) reached. Giving up.`);
      return;
    }

    this.restartCount++;
    const delay = this.baseDelay * Math.pow(2, this.restartCount - 1);
    console.log(`[ProcessManager] Restart attempt ${this.restartCount}/${this.maxRestarts} in ${delay}ms`);

    setTimeout(() => this.start(), delay);
  }

  getStatus() {
    return this.status;
  }

  getUptime() {
    if (!this.startTime || this.status !== 'running') return 0;
    return Date.now() - this.startTime;
  }
}

module.exports = ProcessManager;
