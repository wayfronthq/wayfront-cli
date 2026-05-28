#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './lib/config.js';
import { registerAuth } from './commands/auth.js';
import { registerWorkspace } from './commands/workspace.js';
import { registerApi } from './commands/api.js';
import { registerResources } from './commands/resources.js';
import { registerTemplates } from './commands/templates.js';

const program = new Command();

program
  .name('wayfront')
  .description('CLI for the Wayfront API and templates')
  .version('0.1.2')
  .action(() => {
    const config = loadConfig();
    const workspaceName = config.default;
    const ws = workspaceName && config.workspaces?.[workspaceName];

    if (!ws) {
      console.log(`No active workspace. Run ${chalk.cyan('wayfront auth login <workspace>')} to connect one.\n`);
      program.outputHelp();
      return;
    }

    const url = ws.url || `https://${workspaceName}.wayfront.com`;
    const greetings = ['Ready', 'All set', 'Connected', 'Good to go'];
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    console.log(`${chalk.green('✓')} ${greeting} — ${chalk.bold(workspaceName)} ${chalk.dim(`(${url})`)}\n`);
    program.outputHelp();
  });

registerAuth(program);
registerWorkspace(program);
registerTemplates(program);
registerResources(program);
registerApi(program);

program.parse();
