import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const configDir = join(homedir(), '.config', 'wayfront');
const configPath = join(configDir, 'config.json');

export function loadConfig() {
  try {
    return JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    return { default: null, workspaces: {} };
  }
}

export function saveConfig(config) {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}

export function getCredentials() {
  const config = loadConfig();

  if (!config.default) {
    throw new Error('No active workspace. Run: wayfront init <workspace>');
  }

  const ws = config.workspaces[config.default];
  if (!ws) {
    throw new Error(`Workspace "${config.default}" not found. Run: wayfront init <workspace>`);
  }
  if (!ws.token) {
    throw new Error(`No token set for workspace "${config.default}". Run: wayfront init ${config.default}`);
  }

  return {
    workspace: config.default,
    url: ws.url || `https://${config.default}.wayfront.com`,
    token: ws.token,
  };
}
