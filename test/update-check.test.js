import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildUpdateNotice, compareVersions, getUpdateNotice } from '../src/lib/update-check.js';

async function withConfigDir(fn) {
  const previous = process.env.WAYFRONT_CLI_CONFIG_DIR;
  process.env.WAYFRONT_CLI_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));

  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env.WAYFRONT_CLI_CONFIG_DIR;
    } else {
      process.env.WAYFRONT_CLI_CONFIG_DIR = previous;
    }
  }
}

describe('compareVersions', () => {
  it('orders semantic versions', () => {
    assert.equal(compareVersions('0.2.2', '0.2.3'), -1);
    assert.equal(compareVersions('0.10.0', '0.2.9'), 1);
    assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  });
});

describe('buildUpdateNotice', () => {
  it('only prompts when latest is newer', () => {
    assert.equal(buildUpdateNotice('0.2.2', '0.2.2'), null);
    assert.equal(buildUpdateNotice('0.2.3', '0.2.2'), null);
    assert.match(
      buildUpdateNotice('0.2.2', '0.2.3'),
      /Update available: wayfront 0\.2\.2 -> 0\.2\.3/,
    );
  });
});

describe('getUpdateNotice', () => {
  it('fetches latest version and caches it', async () => withConfigDir(async () => {
    let fetchCount = 0;
    const now = () => 1000;
    const fetchImpl = async () => {
      fetchCount += 1;
      return {
        ok: true,
        async json() {
          return { version: '0.2.3' };
        },
      };
    };

    const first = await getUpdateNotice({ currentVersion: '0.2.2', fetchImpl, now });
    const second = await getUpdateNotice({
      currentVersion: '0.2.2',
      fetchImpl: async () => {
        throw new Error('cache should be used');
      },
      now,
    });

    assert.match(first, /0\.2\.2 -> 0\.2\.3/);
    assert.match(second, /0\.2\.2 -> 0\.2\.3/);
    assert.equal(fetchCount, 1);
  }));

  it('does not prompt when update checks are disabled', async () => withConfigDir(async () => {
    const notice = await getUpdateNotice({
      currentVersion: '0.2.2',
      env: { WAYFRONT_SKIP_UPDATE_CHECK: '1' },
      fetchImpl: async () => {
        throw new Error('fetch should be skipped');
      },
    });

    assert.equal(notice, null);
  }));
});
