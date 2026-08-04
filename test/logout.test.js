import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runLogout } from '../src/commands/auth.js';
import { loadConfig, saveConfig } from '../src/lib/config.js';

const savedDir = process.env.WAYFRONT_CLI_CONFIG_DIR;
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  if (savedDir === undefined) delete process.env.WAYFRONT_CLI_CONFIG_DIR;
  else process.env.WAYFRONT_CLI_CONFIG_DIR = savedDir;
});

function seedOauthWorkspace(auth) {
  const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
  process.env.WAYFRONT_CLI_CONFIG_DIR = dir;
  saveConfig({ default: 'acme', workspaces: { acme: { url: 'https://acme.wayfront.com', auth } } });
  return dir;
}

describe('runLogout', () => {
  it('best-effort revokes the token then clears local auth', async () => {
    let revokeUrl;
    global.fetch = async (url) => { revokeUrl = url; return { ok: true }; };
    const dir = seedOauthWorkspace({
      type: 'oauth', accessToken: 'a', refreshToken: 'r', clientId: 'c',
      revocationEndpoint: 'https://acme.wayfront.com/oauth/revoke',
    });

    await runLogout('acme');

    assert.equal(revokeUrl, 'https://acme.wayfront.com/oauth/revoke');
    assert.equal(loadConfig().workspaces.acme.auth, null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('still clears local auth when revocation fails', async () => {
    global.fetch = async () => { throw new Error('offline'); };
    const dir = seedOauthWorkspace({
      type: 'oauth', accessToken: 'a', refreshToken: 'r', clientId: 'c',
      revocationEndpoint: 'https://acme.wayfront.com/oauth/revoke',
    });

    await runLogout('acme');

    assert.equal(loadConfig().workspaces.acme.auth, null);
    rmSync(dir, { recursive: true, force: true });
  });

  it('does not attempt revocation for token auth', async () => {
    let called = false;
    global.fetch = async () => { called = true; return { ok: true }; };
    const dir = seedOauthWorkspace({ type: 'token', token: 't' });

    await runLogout('acme');

    assert.equal(called, false);
    assert.equal(loadConfig().workspaces.acme.auth, null);
    rmSync(dir, { recursive: true, force: true });
  });
});
