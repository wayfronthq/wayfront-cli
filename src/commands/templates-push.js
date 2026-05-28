import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost, apiPut, ApiError } from '../lib/api.js';
import { nameToPath, pathToName, findTemplateFiles, formatName, elapsed } from '../lib/files.js';

export async function runTemplatesPush(name) {
  const dir = './templates';

  try {
    if (name) {
      const filePath = nameToPath(name, dir);
      const start = Date.now();
      const spinner = ora(`Pushing ${name}…`).start();

      let content;
      try {
        content = readFileSync(filePath, 'utf8');
      } catch {
        spinner.fail(`File not found: ${filePath}`);
        process.exit(1);
      }

      try {
        await apiPut(`/api/templates/${name}`, { data: content });
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          await apiPost('/api/templates', { name, data: content });
        } else {
          throw error;
        }
      }
      spinner.succeed(`Pushed ${name} ${elapsed(start)}`);
      return;
    }

    const files = findTemplateFiles(dir);

    if (files.length === 0) {
      console.log(`No .twig files found in ${dir}`);
      return;
    }

    const start = Date.now();
    const spinner = ora('Comparing templates…').start();
    const remote = await apiGet('/api/templates');
    const remoteByName = {};
    for (const template of remote) {
      remoteByName[template.name] = template.data || '';
    }

    const changed = [];
    for (const filePath of files) {
      const templateName = pathToName(filePath, dir);
      const local = readFileSync(filePath, 'utf8');
      const isNew = !(templateName in remoteByName);
      if (isNew || local !== remoteByName[templateName]) {
        changed.push({ name: templateName, content: local, isNew });
      }
    }

    const unchanged = files.length - changed.length;

    if (changed.length === 0) {
      spinner.succeed(`Everything's in sync — ${chalk.dim(`${unchanged} template(s) unchanged`)} ${elapsed(start)}`);
      return;
    }

    spinner.text = `Pushing ${changed.length} changed template(s)…`;
    let count = 0;
    const errors = [];

    for (const template of changed) {
      try {
        if (template.isNew) {
          await apiPost('/api/templates', { name: template.name, data: template.content });
        } else {
          await apiPut(`/api/templates/${template.name}`, { data: template.content });
        }
        count++;
      } catch (error) {
        errors.push({ name: template.name, message: error.message });
      }
      spinner.text = `Pushing templates… (${count + errors.length}/${changed.length})`;
    }

    if (errors.length === 0) {
      spinner.succeed(`Pushed ${count}, ${unchanged} unchanged ${elapsed(start)}`);
      for (const template of changed) {
        console.log(`  ${formatName(template.name)}`);
      }
      return;
    }

    spinner.warn(`Pushed ${count} template(s), ${errors.length} failed`);
    for (const error of errors) {
      console.error(`  ✗ ${error.name}: ${error.message}`);
    }
    process.exit(1);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
