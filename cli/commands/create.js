/**
 * gene create <name>
 * Scaffolds a new Gene desktop application.
 */

import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function create(name, options) {
  console.log(chalk.bold(`\n🧬 Creating Gene app: ${chalk.cyan(name)}\n`));

  // Resolve target directory
  const targetDir = path.resolve(options.dir || `./${name}`);

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${targetDir} is not empty. Overwrite?`,
      default: false,
    }]);
    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
  }

  // Template selection
  const template = options.template || 'default';
  const templateDir = path.resolve(__dirname, '..', '..', 'python', 'gene', 'templates', 'builtin', template);

  if (!fs.existsSync(templateDir)) {
    console.error(chalk.red(`Template not found: ${template}`));
    console.log(chalk.gray(`Available templates are in: python/gene/templates/builtin/`));
    return;
  }

  // Scaffold
  const spinner = ora('Scaffolding project...').start();

  try {
    fs.mkdirpSync(targetDir);

    // Copy template files
    const files = getAllFiles(templateDir);
    let fileCount = 0;

    for (const srcFile of files) {
      if (path.basename(srcFile) === 'template.json') continue;

      const relPath = path.relative(templateDir, srcFile);
      const dstPath = path.join(targetDir, relPath);

      fs.mkdirpSync(path.dirname(dstPath));

      // Apply Jinja-style variable substitution
      try {
        let content = fs.readFileSync(srcFile, 'utf-8');
        content = applyVariables(content, {
          project_name: name,
          project_name_slug: name.toLowerCase().replace(/\s+/g, '-').replace(/_/g, '-'),
          project_name_snake: name.toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_'),
          project_name_pascal: name.replace(/[-_\s]+(.)?/g, (_, c) => (c || '').toUpperCase()),
          gene_version: '1.0.0',
        });
        fs.writeFileSync(dstPath, content, 'utf-8');
      } catch {
        // Binary file — copy directly
        fs.copyFileSync(srcFile, dstPath);
      }

      fileCount++;
    }

    spinner.succeed(`Scaffolded ${fileCount} files`);
  } catch (err) {
    spinner.fail(`Scaffold failed: ${err.message}`);
    return;
  }

  // Install Python dependencies
  const spinner2 = ora('Installing Python dependencies...').start();
  try {
    if (!options.noInstall) {
      execSync('pip install -r requirements.txt', {
        cwd: path.join(targetDir, 'backend'),
        stdio: 'pipe',
      });
      spinner2.succeed('Python dependencies installed');
    } else {
      spinner2.info('Skipped Python install (--no-install)');
    }
  } catch (err) {
    spinner2.warn('Python install failed — run manually: cd backend && pip install -r requirements.txt');
  }

  // Install Node dependencies
  const spinner3 = ora('Installing Node dependencies...').start();
  try {
    if (!options.noInstall) {
      execSync('npm install', { cwd: targetDir, stdio: 'pipe' });
      execSync('npm install', { cwd: path.join(targetDir, 'frontend'), stdio: 'pipe' });
      spinner3.succeed('Node dependencies installed');
    } else {
      spinner3.info('Skipped Node install (--no-install)');
    }
  } catch (err) {
    spinner3.warn('Node install failed — run manually: npm install');
  }

  // Git init
  if (options.git !== false) {
    try {
      execSync('git init', { cwd: targetDir, stdio: 'pipe' });
      fs.writeFileSync(
        path.join(targetDir, '.gitignore'),
        'node_modules/\n__pycache__/\n*.pyc\ndist/\nbuild/\n.gene/\n.venv/\nvenv/\n*.egg-info/\n.env\n',
      );
    } catch {}
  }

  // Done!
  console.log(chalk.bold.green(`\n✅ Gene app "${name}" created successfully!\n`));
  console.log(chalk.gray('  Get started:\n'));
  console.log(chalk.white(`    cd ${name}`));
  console.log(chalk.white('    gene dev'));
  console.log();
  console.log(chalk.gray('  Or manually:\n'));
  console.log(chalk.white('    # Terminal 1: Python backend'));
  console.log(chalk.white('    cd backend && python -m uvicorn app:app --reload --port 18764'));
  console.log();
  console.log(chalk.white('    # Terminal 2: React frontend'));
  console.log(chalk.white('    cd frontend && npm run dev'));
  console.log();
  console.log(chalk.white('    # Terminal 3: Electron shell'));
  console.log(chalk.white('    GENE_DEV=true npx electron .'));
  console.log();
}

function getAllFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...getAllFiles(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

function applyVariables(content, vars) {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    // Replace {{ key }} and {{key}} patterns (Jinja2 style)
    result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), value);
  }
  return result;
}
