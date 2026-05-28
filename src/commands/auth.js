import chalk from 'chalk';
import { loadConfig, saveConfig, getWorkspaceConfig } from '../lib/config.js';
import { runOauthFlow } from '../lib/oauth.js';
import { promptForWorkspaceInput, parseWorkspaceInput } from '../lib/workspace-input.js';

async function resolveWorkspaceTarget(workspaceInput = null) {
  const config = loadConfig();
  config.workspaces ??= {};

  if (!workspaceInput) {
    if (config.default && config.workspaces?.[config.default]) {
      return {
        config,
        workspace: config.default,
        url: config.workspaces[config.default].url || `https://${config.default}.wayfront.com`,
        existing: config.workspaces[config.default],
      };
    }

    const parsed = await promptForWorkspaceInput();
    return {
      config,
      workspace: parsed.workspace,
      url: parsed.url || `https://${parsed.workspace}.wayfront.com`,
      existing: config.workspaces[parsed.workspace],
    };
  }

  const parsed = parseWorkspaceInput(workspaceInput);
  return {
    config,
    workspace: parsed.workspace,
    url: parsed.url || `https://${parsed.workspace}.wayfront.com`,
    existing: config.workspaces[parsed.workspace],
  };
}

export async function runLogin(workspaceInput = null) {
  const target = await resolveWorkspaceTarget(workspaceInput);
  const auth = await runOauthFlow(target.url);

  target.config.workspaces[target.workspace] = {
    ...target.existing,
    ...(target.url !== `https://${target.workspace}.wayfront.com` ? { url: target.url } : {}),
    auth,
  };
  target.config.default = target.workspace;
  saveConfig(target.config);

  console.log(chalk.green('✓') + ` Signed in to "${target.workspace}" with OAuth`);
}

export function runStatus() {
  const config = loadConfig();
  const workspace = getWorkspaceConfig(config);
  const authType = workspace.auth?.type || 'none';

  console.log(`Workspace: ${workspace.workspace}`);
  console.log(`URL: ${workspace.url}`);
  console.log(`Auth: ${authType}`);
}

export function runLogout(workspaceName = null) {
  const config = loadConfig();
  const workspace = getWorkspaceConfig(config, workspaceName);

  config.workspaces[workspace.workspace] = {
    ...config.workspaces[workspace.workspace],
    auth: null,
  };
  saveConfig(config);

  console.log(chalk.green('✓') + ` Signed out of "${workspace.workspace}"`);
}

export function registerAuth(program) {
  const auth = program
    .command('auth')
    .description('Authenticate and inspect your Wayfront session');

  auth
    .command('login [workspace]')
    .description('Sign in with your browser using OAuth')
    .action(async (workspace) => {
      try {
        await runLogin(workspace);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });

  auth
    .command('status')
    .description('Show the active workspace and auth status')
    .action(() => {
      try {
        runStatus();
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });

  auth
    .command('logout [workspace]')
    .description('Remove the saved auth session for a workspace')
    .action((workspace) => {
      try {
        runLogout(workspace);
      } catch (error) {
        console.error(error.message);
        process.exit(1);
      }
    });
}
