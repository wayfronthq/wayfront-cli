#!/usr/bin/env node

import { Command } from 'commander';
import { createRequire } from 'node:module';
import chalk from 'chalk';
import { loadConfig } from './lib/config.js';
import { getUpdateNotice } from './lib/update-check.js';
import { registerAuth } from './commands/auth.js';
import { registerWorkspace } from './commands/workspace.js';
import { registerApi } from './commands/api.js';
import { registerResources } from './commands/resources.js';
import { registerTemplates } from './commands/templates.js';

const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require('../package.json');
const WAYFRONT_SKILLS_URL = 'https://github.com/wayfronthq/wayfront-skills';

function startupPanel(config, version) {
  const workspaceName = config.default;
  const ws = workspaceName && config.workspaces?.[workspaceName];
  const connected = Boolean(ws);
  const url = connected ? ws.url || `https://${workspaceName}.wayfront.com` : null;
  const status = connected
    ? `connected to ${workspaceName} (${url})`
    : 'not connected - run wayfront auth login <workspace>';
  const width = 78;
  const border = chalk.cyan(`+${'-'.repeat(width - 2)}+`);
  const row = (text) => `${chalk.cyan('|')} ${text.padEnd(width - 4)} ${chalk.cyan('|')}`;

  return [
    border,
    row(`Wayfront CLI v${version}`),
    row('API, resources, and templates for your workspace.'),
    row(`Workspace: ${status}`),
    row('Skills: download the Wayfront Skills from GitHub.'),
    row(WAYFRONT_SKILLS_URL),
    border,
    '',
  ].join('\n');
}

const program = new Command();

program
  .name('wayfront')
  .description('CLI for the Wayfront API and templates')
  .version(CLI_VERSION)
  .action(async () => {
    const config = loadConfig();
    const updateNotice = await getUpdateNotice({ currentVersion: CLI_VERSION });

    console.log(startupPanel(config, CLI_VERSION));
    if (updateNotice) {
      console.log(`${chalk.yellow(updateNotice)}\n`);
    }
    program.outputHelp();
  });

registerAuth(program);
registerWorkspace(program);
registerTemplates(program);
registerResources(program);
registerApi(program);

program.parse();
