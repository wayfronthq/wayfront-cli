import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiDelete } from '../lib/api.js';
import { confirm } from '../lib/prompt.js';
import { formatName, elapsed } from '../lib/files.js';

export function registerTemplatesReset(program) {
  program
    .command('templates:reset [name]')
    .description('Reset templates to default (or one by name)')
    .action(async (name) => {
      try {
        if (name) {
          const ok = await confirm(`Reset "${name}" to default?`);
          if (!ok) return;

          const start = Date.now();
          const spinner = ora(`Resetting ${name}…`).start();
          await apiDelete(`/api/templates/${name}`);
          spinner.succeed(`Reset ${name} to default ${elapsed(start)}`);
          console.log(chalk.dim(`\n  Run wayfront templates:pull ${name} to update your local copy`));
        } else {
          const spinner = ora('Fetching template list…').start();
          const templates = await apiGet('/api/templates');
          const custom = templates.filter((t) => t.is_modified);

          if (custom.length === 0) {
            spinner.succeed('No modified templates to reset');
            return;
          }

          spinner.stop();
          console.log(`Found ${custom.length} modified template(s):\n`);
          for (const t of custom) {
            console.log(`  ${formatName(t.name)}`);
          }
          console.log();

          const ok = await confirm('Reset all to default?');
          if (!ok) return;

          const start = Date.now();
          const resetSpinner = ora(`Resetting ${custom.length} template(s)…`).start();
          let count = 0;
          for (const t of custom) {
            await apiDelete(`/api/templates/${t.name}`);
            count++;
            resetSpinner.text = `Resetting templates… (${count}/${custom.length})`;
          }

          resetSpinner.succeed(`Reset ${count} template(s) to default ${elapsed(start)}`);
          console.log(chalk.dim('\n  Run wayfront templates:pull to update your local copies'));
        }
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
    });
}
