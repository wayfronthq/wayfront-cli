#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig } from './lib/config.js';
import { registerInit, runInit } from './commands/init.js';
import { registerUse } from './commands/use.js';
import { registerTemplatesPull } from './commands/templates-pull.js';
import { registerTemplatesPush } from './commands/templates-push.js';
import { registerTemplatesReset } from './commands/templates-reset.js';

const program = new Command();

program
  .name('wayfront')
  .description('CLI for managing Wayfront templates')
  .version('0.1.1')
  .action(async () => {
    const config = loadConfig();
    const ws = config.default && config.workspaces?.[config.default];

    if (!ws) {
      console.log(`Welcome to the frontier. Let's connect your Wayfront workspace.\n`);
      await runInit();
      console.log();
    } else {
      const url = ws.url || `https://${config.default}.wayfront.com`;
      const greetings = ['Ready', 'All set', 'Connected', 'Good to go'];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      console.log(`${chalk.green('✓')} ${greeting} — ${chalk.bold(config.default)} ${chalk.dim(`(${url})`)}\n`);
    }

    program.outputHelp();
  });

registerInit(program);
registerUse(program);
registerTemplatesPull(program);
registerTemplatesPush(program);
registerTemplatesReset(program);

program.parse();
