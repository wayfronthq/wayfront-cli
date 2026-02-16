import { exec } from 'node:child_process';
import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.js';
import { prompt, confirm } from '../lib/prompt.js';

function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} '${url}'`);
}

export function parseInput(input) {
  if (/^https?:\/\//.test(input)) {
    const parsed = new URL(input);
    const wayfrontMatch = parsed.hostname.match(/^([^.]+)\.wayfront\.com$/);
    if (wayfrontMatch) {
      return { workspace: wayfrontMatch[1], url: null };
    }
    return { workspace: parsed.hostname.split('.')[0], url: `${parsed.protocol}//${parsed.host}` };
  }

  const wayfrontMatch = input.match(/^([^.]+)\.wayfront\.com$/);
  if (wayfrontMatch) {
    return { workspace: wayfrontMatch[1], url: null };
  }

  if (input.includes('.')) {
    return { workspace: input.split('.')[0], url: `https://${input}` };
  }

  return { workspace: input, url: null };
}

export async function runInit(input) {
  const { workspace, url } = input ? parseInput(input) : { workspace: null, url: null };
  const config = loadConfig();
  config.workspaces ??= {};

  let finalWorkspace = workspace;
  let finalUrl = url;
  if (!finalWorkspace) {
    console.log(chalk.dim('  Your Wayfront username, e.g. acme'));
    const answer = await prompt('Workspace: ');
    if (!answer) {
      console.error('No workspace provided.');
      process.exit(1);
    }
    const parsed = parseInput(answer);
    finalWorkspace = parsed.workspace;
    finalUrl = parsed.url;
  }

  const baseUrl = finalUrl || `https://${finalWorkspace}.wayfront.com`;
  const existing = config.workspaces[finalWorkspace];

  if (existing) {
    config.default = finalWorkspace;
    saveConfig(config);
    console.log(chalk.green('✓') + ` Switched to "${finalWorkspace}" (${baseUrl})`);

    const update = await confirm('Update API token?');
    if (!update) return;
  }

  const tokenUrl = `${baseUrl}/settings/templates/api-token`;

  openUrl(tokenUrl);
  console.log(`\nOpening ${chalk.cyan(tokenUrl)}\n`);

  const token = await prompt('Paste your token: ');

  if (!token) {
    console.error('No token provided.');
    process.exit(1);
  }

  config.workspaces[finalWorkspace] = {
    token,
    ...(finalUrl ? { url: finalUrl } : {}),
  };

  config.default = finalWorkspace;
  saveConfig(config);

  console.log(chalk.green('✓') + ` Workspace "${finalWorkspace}" configured (${baseUrl})`);
}

export function registerInit(program) {
  program
    .command('init [workspace]')
    .description('Connect a workspace')
    .action(async (input) => {
      await runInit(input);
    });
}
