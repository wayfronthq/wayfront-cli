import { readFileSync } from 'node:fs';
import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiPost, apiPut, ApiError } from '../lib/api.js';
import { nameToPath, pathToName, findTemplateFiles, formatName, elapsed } from '../lib/files.js';

export function registerTemplatesPush(program) {
  program
    .command('templates:push [name]')
    .description('Push templates to the API (or one by name)')
    .action(async (name) => {
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

          // Try updating first; if it doesn't exist yet, create it
          try {
            await apiPut(`/api/templates/${name}`, { data: content });
          } catch (err) {
            if (err instanceof ApiError && err.status === 404) {
              await apiPost('/api/templates', { name, data: content });
            } else {
              throw err;
            }
          }
          spinner.succeed(`Pushed ${name} ${elapsed(start)}`);
        } else {
          const files = findTemplateFiles(dir);

          if (files.length === 0) {
            console.log(`No .twig files found in ${dir}`);
            return;
          }

          const start = Date.now();
          const spinner = ora('Comparing templates…').start();

          // Fetch remote state to diff against
          const remote = await apiGet('/api/templates');
          const remoteByName = {};
          for (const t of remote) {
            remoteByName[t.name] = t.data || '';
          }

          // Find changed and new templates
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

          for (const t of changed) {
            try {
              if (t.isNew) {
                await apiPost('/api/templates', { name: t.name, data: t.content });
              } else {
                await apiPut(`/api/templates/${t.name}`, { data: t.content });
              }
              count++;
            } catch (err) {
              errors.push({ name: t.name, message: err.message });
            }
            spinner.text = `Pushing templates… (${count + errors.length}/${changed.length})`;
          }

          if (errors.length === 0) {
            spinner.succeed(`Pushed ${count}, ${unchanged} unchanged ${elapsed(start)}`);
            for (const t of changed) {
              console.log(`  ${formatName(t.name)}`);
            }
          } else {
            spinner.warn(`Pushed ${count} template(s), ${errors.length} failed`);
            for (const e of errors) {
              console.error(`  ✗ ${e.name}: ${e.message}`);
            }
            process.exit(1);
          }
        }
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
