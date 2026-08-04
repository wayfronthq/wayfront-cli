import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parseWorkspaceInput } from './workspace-input.js';

function getDefaultConfigDir() {
  return join(homedir(), '.config', 'wayfront');
}

export function getConfigDir() {
  return process.env.WAYFRONT_CLI_CONFIG_DIR || getDefaultConfigDir();
}

export function getConfigPath() {
  return join(getConfigDir(), 'config.json');
}

export function normalizeConfig(config = {}) {
  const normalized = {
    default: config.default || null,
    workspaces: { ...(config.workspaces || {}) },
  };

  for (const [workspace, value] of Object.entries(normalized.workspaces)) {
    if (!value || typeof value !== 'object') {
      normalized.workspaces[workspace] = {};
      continue;
    }

    if (!value.auth && value.token) {
      normalized.workspaces[workspace] = {
        ...value,
        auth: {
          type: 'token',
          token: value.token,
        },
      };
      delete normalized.workspaces[workspace].token;
      continue;
    }

    normalized.workspaces[workspace] = {
      ...value,
      auth: value.auth || null,
    };
  }

  return normalized;
}

export function loadConfig() {
  try {
    return normalizeConfig(JSON.parse(readFileSync(getConfigPath(), 'utf8')));
  } catch {
    return normalizeConfig();
  }
}

export function saveConfig(config) {
  // The config file holds access and refresh tokens, so keep it owner-only.
  mkdirSync(getConfigDir(), { recursive: true, mode: 0o700 });
  const path = getConfigPath();
  writeFileSync(path, JSON.stringify(normalizeConfig(config), null, 2) + '\n', { mode: 0o600 });

  // writeFileSync's mode only applies when it creates the file; tighten an existing
  // one too. Best-effort — Windows uses a different permission model.
  try {
    chmodSync(path, 0o600);
  } catch {
    // ignore
  }
}

export function getWorkspaceConfig(config = loadConfig(), workspaceName = null) {
  const workspace = workspaceName || config.default;

  if (!workspace) {
    throw new Error('No active workspace. Run: wayfront auth login <workspace>');
  }

  const ws = config.workspaces?.[workspace];
  if (!ws) {
    throw new Error(`Workspace "${workspace}" not found. Run: wayfront auth login ${workspace}`);
  }

  return {
    workspace,
    url: ws.url || `https://${workspace}.wayfront.com`,
    auth: ws.auth,
    ...ws,
  };
}

export function getApiBasePath(workspaceConfig) {
  return workspaceConfig?.auth?.type === 'oauth' ? '/oauth-api' : '/api';
}

/**
 * Non-interactive auth for CI: when WAYFRONT_TOKEN is set, use it as a token
 * credential without reading or writing the config file. The workspace comes from
 * WAYFRONT_WORKSPACE (a name, domain, or URL) or the configured default.
 */
export function getEnvTokenCredentials() {
  const token = process.env.WAYFRONT_TOKEN;
  if (!token) {
    return null;
  }

  const target = process.env.WAYFRONT_WORKSPACE || loadConfig().default;
  if (!target) {
    throw new Error('WAYFRONT_TOKEN is set but no workspace is selected. Set WAYFRONT_WORKSPACE to a workspace name or URL.');
  }

  const parsed = parseWorkspaceInput(target);
  return {
    workspace: parsed.workspace,
    url: parsed.url || `https://${parsed.workspace}.wayfront.com`,
    auth: { type: 'token', token },
  };
}

export function getCredentials() {
  const envCredentials = getEnvTokenCredentials();
  if (envCredentials) {
    return envCredentials;
  }

  const workspaceConfig = getWorkspaceConfig();

  if (!workspaceConfig.auth) {
    throw new Error(`No auth configured for workspace "${workspaceConfig.workspace}". Run: wayfront auth login ${workspaceConfig.workspace}`);
  }

  if (workspaceConfig.auth.type === 'token' && !workspaceConfig.auth.token) {
    throw new Error(`No token set for workspace "${workspaceConfig.workspace}". Run: wayfront auth login ${workspaceConfig.workspace}`);
  }

  if (workspaceConfig.auth.type === 'oauth' && !workspaceConfig.auth.accessToken) {
    throw new Error(`No OAuth session for workspace "${workspaceConfig.workspace}". Run: wayfront auth login ${workspaceConfig.workspace}`);
  }

  return workspaceConfig;
}
