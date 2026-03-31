/**
 * gene package
 * Packages the Gene app into a distributable installer using electron-builder.
 * Expects `gene build` to have been run first.
 */

import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function packageApp(options) {
  console.log(chalk.bold('\n🧬 Gene Packaging\n'));

  const cwd = process.cwd();

  if (!fs.existsSync(path.join(cwd, 'gene.config.json'))) {
    console.error(chalk.red('Not a Gene project directory'));
    return;
  }

  // Check that build artifacts exist
  const backendDist = path.join(cwd, 'backend', 'dist', 'gene-runtime');
  const frontendDist = path.join(cwd, 'frontend', 'dist');

  if (!options.skipBuild) {
    if (!fs.existsSync(backendDist)) {
      console.log(chalk.yellow('  Backend not built — running gene build first...'));
      const { build } = await import('./build.js');
      await build({});
    }

    if (!fs.existsSync(frontendDist)) {
      console.log(chalk.yellow('  Frontend not built — running gene build first...'));
      const { build } = await import('./build.js');
      await build({ pythonOnly: false });
    }
  }

  // Run electron-builder
  const spinner = ora('Packaging with electron-builder...').start();

  try {
    // Determine platform flag
    let platformFlag = '';
    if (options.platform) {
      const platformMap = {
        win: '--win',
        windows: '--win',
        mac: '--mac',
        macos: '--mac',
        darwin: '--mac',
        linux: '--linux',
      };
      platformFlag = platformMap[options.platform.toLowerCase()] || '';
    }

    const cmd = `npx electron-builder ${platformFlag} --config`;
    spinner.text = `Running: ${cmd}`;

    execSync(cmd, {
      cwd,
      stdio: 'pipe',
      env: { ...process.env },
    });

    // Find output
    const distDir = path.join(cwd, 'dist');
    if (fs.existsSync(distDir)) {
      const artifacts = fs.readdirSync(distDir).filter(f =>
        f.endsWith('.exe') || f.endsWith('.dmg') || f.endsWith('.AppImage') ||
        f.endsWith('.deb') || f.endsWith('.msi') || f.endsWith('.zip')
      );

      if (artifacts.length > 0) {
        spinner.succeed('Package created!');
        console.log(chalk.gray('\n  Artifacts:'));
        for (const a of artifacts) {
          const size = (fs.statSync(path.join(distDir, a)).size / (1024 * 1024)).toFixed(1);
          console.log(chalk.white(`    📦 ${a} (${size}MB)`));
        }
      } else {
        spinner.succeed('Packaging complete → dist/');
      }
    } else {
      spinner.succeed('Packaging complete');
    }
  } catch (err) {
    spinner.fail(`Packaging failed: ${err.message}`);
    console.log(chalk.gray('\n  Make sure electron-builder is installed:'));
    console.log(chalk.gray('    npm install --save-dev electron-builder'));
    return;
  }

  console.log(chalk.bold.green('\n✅ App packaged and ready to distribute!\n'));
}
