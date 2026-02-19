import chalk from 'chalk';
import { loadConfig, saveConfig } from '../lib/config.js';

export function runWorkspaceUse(workspace) {
  const config = loadConfig();

  if (!config.workspaces?.[workspace]) {
    throw new Error(`Workspace "${workspace}" not found. Run: wayfront auth login ${workspace}`);
  }

  config.default = workspace;
  saveConfig(config);

  console.log(chalk.green('✓') + ` Active workspace set to "${workspace}"`);
}

export function runWorkspaceList() {
  const config = loadConfig();
  const names = Object.keys(config.workspaces || {});

  if (names.length === 0) {
    console.log('No workspaces configured. Run: wayfront auth login <workspace>');
    return;
  }

  for (const workspace of names.sort()) {
    const ws = config.workspaces[workspace];
    const marker = workspace === config.default ? '*' : ' ';
    const url = ws.url || `https://${workspace}.wayfront.com`;
    const auth = ws.auth?.type || 'none';
    console.log(`${marker} ${workspace}  ${url}  (${auth})`);
  }
}

export function registerWorkspace(program) {
  const workspace = program
    .command('workspace')
    .description('Manage configured workspaces');

  workspace
    .command('use <workspace>')
    .description('Switch the active workspace')
    .action((name) => {
      try {
        runWorkspaceUse(name);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });

  workspace
    .command('list')
    .description('List configured workspaces')
    .action(() => {
      runWorkspaceList();
    });
}
