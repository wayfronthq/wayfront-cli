import chalk from 'chalk';
import ora from 'ora';
import { apiGet, apiDelete } from '../lib/api.js';
import { confirm } from '../lib/prompt.js';
import { formatName, elapsed } from '../lib/files.js';

export async function runTemplatesReset(name) {
  try {
    if (name) {
      const ok = await confirm(`Reset "${name}" to default?`);
      if (!ok) return;

      const start = Date.now();
      const spinner = ora(`Resetting ${name}…`).start();
      await apiDelete(`/api/templates/${name}`);
      spinner.succeed(`Reset ${name} to default ${elapsed(start)}`);
      console.log(chalk.dim(`\n  Run wayfront templates pull ${name} to update your local copy`));
      return;
    }

    const spinner = ora('Fetching template list…').start();
    const templates = await apiGet('/api/templates');
    const custom = templates.filter((template) => template.is_modified);

    if (custom.length === 0) {
      spinner.succeed('No modified templates to reset');
      return;
    }

    spinner.stop();
    console.log(`Found ${custom.length} modified template(s):\n`);
    for (const template of custom) {
      console.log(`  ${formatName(template.name)}`);
    }
    console.log();

    const ok = await confirm('Reset all to default?');
    if (!ok) return;

    const start = Date.now();
    const resetSpinner = ora(`Resetting ${custom.length} template(s)…`).start();
    let count = 0;
    for (const template of custom) {
      await apiDelete(`/api/templates/${template.name}`);
      count++;
      resetSpinner.text = `Resetting templates… (${count}/${custom.length})`;
    }

    resetSpinner.succeed(`Reset ${count} template(s) to default ${elapsed(start)}`);
    console.log(chalk.dim('\n  Run wayfront templates pull to update your local copies'));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
