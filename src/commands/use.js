import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.js';

export function registerUse(program) {
  program
    .command('use <workspace>')
    .description('Switch active workspace')
    .action((workspace) => {
      const config = loadConfig();

      if (!config.workspaces?.[workspace]) {
        console.error(`Workspace "${workspace}" not found. Run: wayfront init <workspace>`);
        process.exit(1);
      }

      config.default = workspace;
      saveConfig(config);

      console.log(chalk.green('✓') + ` Active workspace set to "${workspace}"`);
    });
}
