import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig, getWorkspaceConfig, getApiBasePath } from '../src/lib/config.js';

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