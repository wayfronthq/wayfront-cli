import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const repoRoot = new URL('..', import.meta.url);

function runCli(...args) {
  return spawnSync(process.execPath, ['src/index.js', ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
}

describe('cli help', () => {
  it('shows resource-first command groups', () => {
    const result = runCli('--help');

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
    const result = runCli('auth', '--help');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /login \[workspace\]/);
    assert.match(result.stdout, /status/);
    assert.match(result.stdout, /logout \[workspace\]/);
  });

  it('shows template subcommands', () => {
    const result = runCli('templates', '--help');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /pull \[name\]/);
    assert.match(result.stdout, /push \[name\]/);
    assert.match(result.stdout, /reset \[name\]/);
  });

  it('shows order resource subcommands', () => {
    const result = runCli('orders', '--help');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /list/);
    assert.match(result.stdout, /create/);
    assert.match(result.stdout, /get .*<order>/);
    assert.match(result.stdout, /update .*<order>/);
    assert.match(result.stdout, /delete .*<order>/);
  });

  it('shows invoice special actions', () => {
    const result = runCli('invoices', '--help');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /charge .*<invoice>/);
    assert.match(result.stdout, /mark-paid .*<invoice>/);
  });

  it('shows raw api escape hatch subcommands', () => {
    const result = runCli('api', '--help');

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /list \[tag\]/);
    assert.match(result.stdout, /call .*<operationId>/);
  });
});
