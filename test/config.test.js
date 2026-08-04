import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  normalizeConfig,
  getWorkspaceConfig,
  getApiBasePath,
  getEnvTokenCredentials,
  getCredentials,
  saveConfig,
} from '../src/lib/config.js';

describe('normalizeConfig', () => {
  it('migrates legacy token workspaces to auth objects', () => {
    const normalized = normalizeConfig({
      default: 'acme',
      workspaces: {
        acme: { token: 'wf_tpl_123' },
      },
    });

    assert.deepEqual(normalized.workspaces.acme.auth, {
      type: 'token',
      token: 'wf_tpl_123',
    });
  });

  it('preserves oauth workspaces', () => {
    const normalized = normalizeConfig({
      default: 'acme',
      workspaces: {
        acme: {
          auth: {
            type: 'oauth',
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        },
      },
    });

    assert.equal(normalized.workspaces.acme.auth.type, 'oauth');
    assert.equal(normalized.workspaces.acme.auth.accessToken, 'access');
  });
});

describe('workspace config helpers', () => {
  it('returns token workspace config', () => {
    const workspace = getWorkspaceConfig(normalizeConfig({
      default: 'acme',
      workspaces: {
        acme: { token: 'wf_tpl_123' },
      },
    }));

    assert.equal(workspace.workspace, 'acme');
    assert.equal(workspace.auth.type, 'token');
    assert.equal(getApiBasePath(workspace), '/api');
  });

  it('returns oauth workspace config with oauth api base path', () => {
    const workspace = getWorkspaceConfig(normalizeConfig({
      default: 'acme',
      workspaces: {
        acme: {
          auth: {
            type: 'oauth',
            accessToken: 'access',
            refreshToken: 'refresh',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        },
      },
    }));

    assert.equal(workspace.workspace, 'acme');
    assert.equal(workspace.auth.type, 'oauth');
    assert.equal(getApiBasePath(workspace), '/oauth-api');
  });
});
describe('getEnvTokenCredentials', () => {
  const saved = { token: process.env.WAYFRONT_TOKEN, ws: process.env.WAYFRONT_WORKSPACE, dir: process.env.WAYFRONT_CLI_CONFIG_DIR };

  afterEach(() => {
    for (const [k, v] of [['WAYFRONT_TOKEN', saved.token], ['WAYFRONT_WORKSPACE', saved.ws], ['WAYFRONT_CLI_CONFIG_DIR', saved.dir]]) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('returns null when WAYFRONT_TOKEN is unset', () => {
    delete process.env.WAYFRONT_TOKEN;
    assert.equal(getEnvTokenCredentials(), null);
  });

  it('builds a token credential from WAYFRONT_TOKEN + WAYFRONT_WORKSPACE', () => {
    process.env.WAYFRONT_TOKEN = 'wf_ci';
    process.env.WAYFRONT_WORKSPACE = 'acme';

    assert.deepEqual(getEnvTokenCredentials(), {
      workspace: 'acme',
      url: 'https://acme.wayfront.com',
      auth: { type: 'token', token: 'wf_ci' },
    });
  });

  it('accepts a full URL as the workspace', () => {
    process.env.WAYFRONT_TOKEN = 'wf_ci';
    process.env.WAYFRONT_WORKSPACE = 'https://acme.spp.io';

    const creds = getEnvTokenCredentials();
    assert.equal(creds.workspace, 'acme');
    assert.equal(creds.url, 'https://acme.spp.io');
  });

  it('throws when a token is set but no workspace can be resolved', () => {
    process.env.WAYFRONT_TOKEN = 'wf_ci';
    delete process.env.WAYFRONT_WORKSPACE;
    process.env.WAYFRONT_CLI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));

    assert.throws(() => getEnvTokenCredentials(), /no workspace is selected/);
  });

  it('getCredentials prefers the env token over saved config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;
    saveConfig({ default: 'saved', workspaces: { saved: { url: 'https://saved.wayfront.com', auth: { type: 'token', token: 'saved-token' } } } });

    process.env.WAYFRONT_TOKEN = 'wf_ci';
    process.env.WAYFRONT_WORKSPACE = 'acme';

    assert.equal(getCredentials().auth.token, 'wf_ci');
    rmSync(dir, { recursive: true, force: true });
  });
});
