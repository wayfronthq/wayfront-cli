import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet } from '../lib/api.js';
import { nameToPath, elapsed } from '../lib/files.js';

function writeTemplate(template, dir) {
  const filePath = nameToPath(template.name, dir);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, template.data || '');
  return filePath;
}

export async function runTemplatesPull(name) {
  const dir = './templates';
  const isFirstPull = !existsSync(dir) || !existsSync(`${dir}/.gitignore`);
  const start = Date.now();
  const spinner = ora(name ? `Pulling ${name}…` : 'Pulling templates…').start();

  try {
    if (name) {
      const template = await apiGet(`/api/templates/${name}`);
      const filePath = writeTemplate(template, dir);
      spinner.succeed(`${template.name} → ${filePath} ${elapsed(start)}`);
      return;
    }

    const templates = await apiGet('/api/templates');

    for (const template of templates) {
      writeTemplate(template, dir);
    }

    spinner.succeed(`Pulled ${templates.length} template(s) to ${dir} ${elapsed(start)}`);

    if (isFirstPull) {
      console.log(chalk.dim('\n  Edit templates locally, then push changes with: wayfront templates push'));
    }
  } catch (error) {
    spinner.fail(error.message);
    process.exit(1);
  }
}
