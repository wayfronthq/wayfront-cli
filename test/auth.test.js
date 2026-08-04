import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runTokenLogin } from '../src/commands/auth.js';
import { loadConfig } from '../src/lib/config.js';

const savedDir = process.env.WAYFRONT_CLI_CONFIG_DIR;

afterEach(() => {
  if (savedDir === undefined) delete process.env.WAYFRONT_CLI_CONFIG_DIR;
  else process.env.WAYFRONT_CLI_CONFIG_DIR = savedDir;
});

describe('runTokenLogin', () => {
  it('saves a token credential and sets the default workspace', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;

    await runTokenLogin('acme', { token: 'wf_abc' });

    const config = loadConfig();
    assert.equal(config.default, 'acme');
    assert.deepEqual(config.workspaces.acme.auth, { type: 'token', token: 'wf_abc' });
    rmSync(dir, { recursive: true, force: true });
  });

  it('records a non-default URL for a custom domain', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;

    await runTokenLogin('https://acme.spp.io', { token: 'wf_abc' });

    const config = loadConfig();
    assert.equal(config.workspaces.acme.url, 'https://acme.spp.io');
    rmSync(dir, { recursive: true, force: true });
  });

  it('rejects an empty token', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;

    await assert.rejects(runTokenLogin('acme', { token: '   ' }), /No token provided/);
    rmSync(dir, { recursive: true, force: true });
  });
});
