import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repoRoot = new URL('..', import.meta.url);

function runCli(args = [], env = {}) {
  return spawnSync(process.execPath, ['src/index.js', ...args], {
    cwd: repoRoot,
    env: { ...process.env, WAYFRONT_SKIP_UPDATE_CHECK: '1', ...env },
    encoding: 'utf8',
  });
}

describe('cli help', () => {
  it('shows resource-first command groups', () => {
    const result = runCli(['--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /auth/);
    assert.match(result.stdout, /workspace/);
    assert.match(result.stdout, /templates/);
    assert.match(result.stdout, /orders/);
    assert.match(result.stdout, /tickets/);
    assert.match(result.stdout, /invoices/);
    assert.match(result.stdout, /api/);
  });

  it('shows auth subcommands', () => {
    const result = runCli(['auth', '--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /login \[workspace\]/);
    assert.match(result.stdout, /status/);
    assert.match(result.stdout, /logout \[workspace\]/);
  });

  it('shows template subcommands', () => {
    const result = runCli(['templates', '--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pull \[name\]/);
    assert.match(result.stdout, /push \[name\]/);
    assert.match(result.stdout, /reset \[name\]/);
  });

  it('shows order resource subcommands', () => {
    const result = runCli(['orders', '--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /list/);
    assert.match(result.stdout, /create/);
    assert.match(result.stdout, /get .*<order>/);
    assert.match(result.stdout, /update .*<order>/);
    assert.match(result.stdout, /delete .*<order>/);
  });

  it('shows invoice special actions', () => {
    const result = runCli(['invoices', '--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /charge .*<invoice>/);
    assert.match(result.stdout, /mark-paid .*<invoice>/);
  });

  it('shows raw api escape hatch subcommands', () => {
    const result = runCli(['api', '--help']);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /list \[tag\]/);
    assert.match(result.stdout, /call .*<operationId>/);
  });
});

describe('cli startup', () => {
  it('shows a startup panel with the skills repo when no workspace is active', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    const result = runCli([], { WAYFRONT_CLI_CONFIG_DIR: configDir });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Wayfront CLI v\d+\.\d+\.\d+/);
    assert.match(result.stdout, /not connected - run wayfront auth login <workspace>/);
    assert.match(result.stdout, /download the Wayfront Skills from GitHub/);
    assert.match(result.stdout, /https:\/\/github\.com\/wayfronthq\/wayfront-skills/);
    assert.match(result.stdout, /Usage:/);
  });

  it('shows the active workspace in the startup panel', () => {
    const configDir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    writeFileSync(join(configDir, 'config.json'), JSON.stringify({
      default: 'acme',
      workspaces: {
        acme: {
          url: 'https://acme.wayfront.com',
          auth: { type: 'oauth', accessToken: 'access' },
        },
      },
    }));

    const result = runCli([], { WAYFRONT_CLI_CONFIG_DIR: configDir });

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Workspace: connected to acme \(https:\/\/acme\.wayfront\.com\)/);
    assert.match(result.stdout, /https:\/\/github\.com\/wayfronthq\/wayfront-skills/);
  });
});
