/**
 * jenny build
 * Builds the Jenny app for production:
 *   1. Bundle Python backend with PyInstaller → standalone executable
 *   2. Build React frontend → static assets
 */

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function build(options) {
  console.log(chalk.bold('\n🧬 Jenny Production Build\n'));

  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'jenny.config.json'))) {
    console.error(chalk.red('Not a Jenny project directory'));
    return;
  }

  // ─── Build Python Backend ──────────────────────────────────────
  if (!options.frontendOnly) {
    const spinner = ora('Building Python backend (PyInstaller)...').start();
    const backendDir = path.join(cwd, 'backend');

    if (!fs.existsSync(backendDir)) {
      spinner.fail('No backend/ directory found');
      return;
    }

    try {
      // Ensure PyInstaller is available
      try {
        execSync('pip show pyinstaller', { stdio: 'pipe' });
      } catch {
        spinner.text = 'Installing PyInstaller...';
        execSync('pip install pyinstaller', { stdio: 'pipe' });
      }

      // Clean old dist to prevent stale exe from previous builds
      const oldDist = path.join(backendDir, 'dist');
      if (fs.existsSync(oldDist)) {
        fs.rmSync(oldDist, { recursive: true, force: true });
      }

      // PyInstaller spec for Jenny apps
      const pyinstallerArgs = [
        'pyinstaller',
        '--onedir',
        '--name', 'jenny',
        '--distpath', path.join(cwd, 'backend', 'dist'),
        '--workpath', path.join(cwd, 'backend', 'build'),
        '--specpath', path.join(cwd, 'backend'),
        // Exclude heavy unused modules for smaller bundle
        '--exclude-module', 'tkinter',
        '--exclude-module', 'matplotlib',
        '--exclude-module', 'scipy',
        '--exclude-module', 'numpy',
        '--exclude-module', 'pandas',
        '--exclude-module', 'PIL',
        '--exclude-module', 'cv2',
        '--exclude-module', 'test',
        '--exclude-module', 'unittest',
        // Hidden imports FastAPI needs
        '--hidden-import', 'uvicorn.logging',
        '--hidden-import', 'uvicorn.loops',
        '--hidden-import', 'uvicorn.loops.auto',
        '--hidden-import', 'uvicorn.protocols',
        '--hidden-import', 'uvicorn.protocols.http',
        '--hidden-import', 'uvicorn.protocols.http.auto',
        '--hidden-import', 'uvicorn.protocols.websockets',
        '--hidden-import', 'uvicorn.protocols.websockets.auto',
        '--hidden-import', 'uvicorn.lifespan',
        '--hidden-import', 'uvicorn.lifespan.on',
        // Entry point
        'app.py',
      ];

      spinner.text = 'Running PyInstaller (this may take a minute)...';
      execSync(pyinstallerArgs.join(' '), {
        cwd: backendDir,
        stdio: 'pipe',
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      });

      // Verify output — fixed canonical path: backend/dist/jenny/jenny[.exe]
      const distDir = path.join(backendDir, 'dist', 'jenny');
      const exeName = process.platform === 'win32' ? 'jenny.exe' : 'jenny';
      const exePath = path.join(distDir, exeName);

      if (fs.existsSync(exePath)) {
        const stats = fs.statSync(exePath);
        const sizeMB = (stats.size / (1024 * 1024)).toFixed(1);
        spinner.succeed(`Python backend built (${sizeMB}MB) → backend/dist/jenny/`);
      } else {
        spinner.warn('PyInstaller ran but jenny.exe not found — check backend/dist/');
      }
    } catch (err) {
      spinner.fail(`PyInstaller build failed: ${err.message}`);
      console.log(chalk.gray('\n  Make sure PyInstaller is installed: pip install pyinstaller'));
      console.log(chalk.gray('  Try running manually: cd backend && pyinstaller --onedir app.py'));
      return;
    }
  }

  // ─── Build Frontend ────────────────────────────────────────────
  if (!options.pythonOnly) {
    const spinner = ora('Building React frontend (Vite)...').start();
    const frontendDir = path.join(cwd, 'frontend');

    if (!fs.existsSync(frontendDir)) {
      spinner.fail('No frontend/ directory found');
      return;
    }

    try {
      // Ensure deps are installed
      if (!fs.existsSync(path.join(frontendDir, 'node_modules'))) {
        spinner.text = 'Installing frontend dependencies...';
        execSync('npm install', { cwd: frontendDir, stdio: 'pipe' });
      }

      spinner.text = 'Building with Vite...';
      execSync('npx vite build', { cwd: frontendDir, stdio: 'pipe' });

      const distDir = path.join(frontendDir, 'dist');
      if (fs.existsSync(distDir)) {
        const files = getAllFiles(distDir);
        const totalSize = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
        spinner.succeed(`Frontend built (${sizeMB}MB, ${files.length} files) → frontend/dist/`);
      } else {
        spinner.succeed('Frontend built → frontend/dist/');
      }
    } catch (err) {
      spinner.fail(`Frontend build failed: ${err.message}`);
      return;
    }
  }

  console.log(chalk.bold.green('\n✅ Build complete!\n'));
  console.log(chalk.gray('  Next step: jenny package'));
  console.log();
}

function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...getAllFiles(full));
    else results.push(full);
  }
  return results;
}
