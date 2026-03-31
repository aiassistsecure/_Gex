/**
 * gene dev
 * Starts Gene in development mode with 4 processes:
 *   1. YOUR APP's Python backend (uvicorn --reload on :18764)
 *   2. YOUR APP's React frontend (vite on :3000)
 *   3. GEX IDE API (uvicorn --reload on :8000) — Code surgery engine
 *   4. GEX IDE UI (vite on :5173) — Development environment
 *   5. Electron window (optional, loads Gex IDE on :5173)
 *
 * The Gex IDE auto-loads your project directory and the Preview
 * panel connects to your app running at :3000.
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve the Gene framework root (where _Gex_API and _Gex_UI live)
const GENE_ROOT = path.resolve(__dirname, '..', '..');

export async function dev(options) {
  console.log(chalk.bold('\n  Gene Dev Mode\n'));

  const cwd = process.cwd();

  // Verify we're in a Gene project
  if (!fs.existsSync(path.join(cwd, 'gene.config.json'))) {
    console.error(chalk.red('  Not a Gene project (gene.config.json not found)'));
    console.log(chalk.gray('  Run `gene create <name>` first, then cd into it.\n'));
    return;
  }

  const config = JSON.parse(fs.readFileSync(path.join(cwd, 'gene.config.json'), 'utf-8'));
  const appPort = options.port || config.python?.port || 18764;
  const appDevPort = config.electron?.devPort || 3000;
  const gexApiPort = 8000;
  const gexUiPort = 5173;

  const processes = [];

  // ── 1. YOUR APP's Python Backend ──
  const backendDir = path.join(cwd, 'backend');
  if (fs.existsSync(backendDir)) {
    console.log(chalk.blue(`  [app:py]   Starting Python backend on :${appPort}`));
    const pyProc = spawn('python', [
      '-m', 'uvicorn', 'app:app',
      '--host', '127.0.0.1',
      '--port', String(appPort),
      '--reload',
    ], {
      cwd: backendDir,
      stdio: 'pipe',
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      shell: true,
    });
    prefixOutput(pyProc, 'app:py', chalk.blue);
    processes.push(pyProc);
  }

  // ── 2. YOUR APP's React Frontend ──
  if (options.frontend !== false) {
    const frontendDir = path.join(cwd, 'frontend');
    if (fs.existsSync(frontendDir)) {
      console.log(chalk.magenta(`  [app:ui]   Starting React dev server on :${appDevPort}`));
      const feProc = spawn('npx', ['vite', '--port', String(appDevPort)], {
        cwd: frontendDir,
        stdio: 'pipe',
        shell: true,
      });
      prefixOutput(feProc, 'app:ui', chalk.magenta);
      processes.push(feProc);
    }
  }

  // ── 3. GEX IDE API (Code Surgery Engine) ──
  const gexApiDir = path.join(GENE_ROOT, '_Gex_API');
  if (fs.existsSync(gexApiDir)) {
    console.log(chalk.cyan(`  [gex:api]  Starting Gex engine on :${gexApiPort}`));
    const gexApiProc = spawn('python', [
      '-m', 'uvicorn', 'main:app',
      '--host', '127.0.0.1',
      '--port', String(gexApiPort),
      '--reload',
    ], {
      cwd: gexApiDir,
      stdio: 'pipe',
      env: { ...process.env, PYTHONUNBUFFERED: '1', GENE_WORKSPACE: cwd },
      shell: true,
    });
    prefixOutput(gexApiProc, 'gex:api', chalk.cyan);
    processes.push(gexApiProc);
  } else {
    console.log(chalk.yellow('  [gex:api]  Gex API not found — AI features disabled'));
  }

  // ── 4. GEX IDE UI (Development Environment) ──
  const gexUiDir = path.join(GENE_ROOT, '_Gex_UI');
  if (fs.existsSync(gexUiDir)) {
    console.log(chalk.hex('#ff8c42')(`  [gex:ui]   Starting Gex IDE on :${gexUiPort}`));
    const gexUiProc = spawn('npx', ['vite', '--port', String(gexUiPort)], {
      cwd: gexUiDir,
      stdio: 'pipe',
      shell: true,
    });
    prefixOutput(gexUiProc, 'gex:ui', chalk.hex('#ff8c42'));
    processes.push(gexUiProc);
  } else {
    console.log(chalk.yellow('  [gex:ui]   Gex UI not found — IDE not started'));
  }

  // ── 5. Electron Window (optional, loads Gex IDE) ──
  if (options.electron !== false) {
    console.log(chalk.gray('  [electron] Waiting for services...'));

    // Wait for app backend first
    const appReady = await waitForHealth(appPort, 30);
    if (appReady) {
      console.log(chalk.green(`  [electron] App backend ready`));
    }

    // Wait for Gex IDE
    const gexReady = await waitForPort(gexUiPort, 15);
    if (gexReady) {
      console.log(chalk.green(`  [electron] Gex IDE ready — launching Electron`));

      // Electron loads Gex IDE, which has the preview iframe pointing to the app
      const electronProc = spawn('npx', ['electron', '.'], {
        cwd,
        stdio: 'pipe',
        env: {
          ...process.env,
          GENE_DEV: 'true',
          GENE_DEV_URL: `http://localhost:${gexUiPort}`, // Electron loads Gex IDE
          GENE_APP_URL: `http://localhost:${appDevPort}`, // Preview connects to app
        },
        shell: true,
      });
      prefixOutput(electronProc, 'electron', chalk.gray);
      processes.push(electronProc);
    } else {
      console.log(chalk.yellow('  [electron] Gex IDE not ready — Electron not launched'));
    }
  }

  // Print summary
  console.log(chalk.bold('\n  All services started:\n'));
  console.log(chalk.blue(  `    Your App:     http://localhost:${appDevPort}`));
  console.log(chalk.blue(  `    App Backend:  http://localhost:${appPort}`));
  console.log(chalk.cyan(  `    Gex Engine:   http://localhost:${gexApiPort}`));
  console.log(chalk.hex('#ff8c42')(`    Gex IDE:      http://localhost:${gexUiPort}`));
  console.log(chalk.gray( '\n    Press Ctrl+C to stop all\n'));

  // Cleanup on exit
  const cleanup = () => {
    console.log(chalk.gray('\n  Shutting down...'));
    for (const p of processes) {
      try { p.kill('SIGTERM'); } catch {}
    }
    setTimeout(() => process.exit(0), 1500);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

// ── Helpers ──

function prefixOutput(proc, label, colorFn) {
  const tag = colorFn(`  [${label}]`);
  proc.stdout?.on('data', (d) => {
    for (const line of d.toString().split('\n').filter(Boolean)) {
      console.log(`${tag} ${line}`);
    }
  });
  proc.stderr?.on('data', (d) => {
    for (const line of d.toString().split('\n').filter(Boolean)) {
      if (!line.includes('WARN') && !line.includes('ExperimentalWarning')) {
        console.log(`${tag} ${line}`);
      }
    }
  });
  proc.on('close', (code) => {
    if (code && code !== 0) {
      console.log(colorFn(`  [${label}] exited (${code})`));
    }
  });
}

async function waitForHealth(port, maxRetries = 30) {
  const http = await import('http');
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
          if (res.statusCode === 200) resolve();
          else reject();
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

async function waitForPort(port, maxRetries = 15) {
  const http = await import('http');
  for (let i = 0; i < maxRetries; i++) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          resolve();
        });
        req.on('error', reject);
        req.setTimeout(1000, () => { req.destroy(); reject(); });
      });
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  return false;
}
