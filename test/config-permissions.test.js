import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveConfig, getConfigPath } from '../src/lib/config.js';

const saved = process.env.WAYFRONT_CLI_CONFIG_DIR;

afterEach(() => {
  if (saved === undefined) delete process.env.WAYFRONT_CLI_CONFIG_DIR;
  else process.env.WAYFRONT_CLI_CONFIG_DIR = saved;
});

describe('saveConfig permissions', () => {
  it('writes the token file owner-only (0600) on POSIX', { skip: process.platform === 'win32' }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;

    saveConfig({ default: 'acme', workspaces: { acme: { auth: { type: 'token', token: 'secret' } } } });

    assert.equal(statSync(getConfigPath()).mode & 0o777, 0o600);
    rmSync(dir, { recursive: true, force: true });
  });

  it('tightens an already-existing, world-readable config on POSIX', { skip: process.platform === 'win32' }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = dir;

    saveConfig({ default: 'a', workspaces: { a: { auth: { type: 'token', token: '1' } } } });
    // A second save (file already exists) must still end up 0600.
    saveConfig({ default: 'a', workspaces: { a: { auth: { type: 'token', token: '2' } } } });

    assert.equal(statSync(getConfigPath()).mode & 0o777, 0o600);
    rmSync(dir, { recursive: true, force: true });
  });
});
