#!/usr/bin/env node

/**
 * Gene CLI 🧬
 * The developer command center for Gene desktop apps.
 *
 * Commands:
 *   gene create <name>  — Scaffold a new Gene app
 *   gene dev             — Start dev mode (hot reload)
 *   gene build           — Build for production
 *   gene package         — Package into installer
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('gene')
  .description(
    chalk.bold('🧬 Gene') +
    ' — The Python Desktop App Generator\n' +
    '   Build desktop apps with Python + Electron + AI Agents'
  )
  .version('1.0.0');

// ─── CREATE ─────────────────────────────────────────────────────
program
  .command('create')
  .argument('<name>', 'Project name')
  .option('-t, --template <template>', 'Template to use', 'default')
  .option('-d, --dir <directory>', 'Target directory')
  .option('--no-git', 'Skip git init')
  .option('--no-install', 'Skip dependency installation')
  .description('Scaffold a new Gene desktop application')
  .action(async (name, options) => {
    const { create } = await import('../commands/create.js');
    await create(name, options);
  });

// ─── DEV ────────────────────────────────────────────────────────
program
  .command('dev')
  .option('-p, --port <port>', 'Python backend port', '18764')
  .option('--no-frontend', 'Skip frontend dev server')
  .option('--no-electron', 'Skip Electron window')
  .description('Start development mode with hot reload')
  .action(async (options) => {
    const { dev } = await import('../commands/dev.js');
    await dev(options);
  });

// ─── BUILD ──────────────────────────────────────────────────────
program
  .command('build')
  .option('--python-only', 'Only build Python backend')
  .option('--frontend-only', 'Only build frontend')
  .description('Build for production (bundles Python with PyInstaller)')
  .action(async (options) => {
    const { build } = await import('../commands/build.js');
    await build(options);
  });

// ─── PACKAGE ────────────────────────────────────────────────────
program
  .command('package')
  .option('--platform <platform>', 'Target platform (win, mac, linux)')
  .option('--skip-build', 'Skip build step (use existing build)')
  .description('Package into distributable installer')
  .action(async (options) => {
    const { packageApp } = await import('../commands/package.js');
    await packageApp(options);
  });

// ─── INFO ───────────────────────────────────────────────────────
program
  .command('info')
  .description('Show project info and environment details')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');

    console.log(chalk.bold('\n🧬 Gene Environment\n'));

    // Check for gene.config.json
    const configPath = path.join(process.cwd(), 'gene.config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      console.log(chalk.gray('  Project:'), chalk.white(config.appName || 'Unknown'));
      console.log(chalk.gray('  Python Port:'), chalk.white(config.python?.port || 18764));
      console.log(chalk.gray('  AI Enabled:'), chalk.white(config.aiassist?.apiKey ? 'Yes' : 'No'));
    } else {
      console.log(chalk.yellow('  Not inside a Gene project directory'));
    }

    // Check Python
    const { execSync } = await import('child_process');
    try {
      const pyVer = execSync('python --version', { encoding: 'utf-8' }).trim();
      console.log(chalk.gray('  Python:'), chalk.green(pyVer));
    } catch {
      console.log(chalk.gray('  Python:'), chalk.red('Not found'));
    }

    // Check Node
    console.log(chalk.gray('  Node:'), chalk.green(process.version));
    console.log(chalk.gray('  Platform:'), chalk.white(process.platform));
    console.log();
  });

program.parse();
