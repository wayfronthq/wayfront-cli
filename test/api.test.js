import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apiGet, isLocal } from '../src/lib/api.js';
import { loadConfig, saveConfig } from '../src/lib/config.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    async json() {
      return body;
    },
  };
}

const originalFetch = global.fetch;
const originalConfigDir = process.env.WAYFRONT_CLI_CONFIG_DIR;

afterEach(() => {
  global.fetch = originalFetch;

  if (originalConfigDir === undefined) {
    delete process.env.WAYFRONT_CLI_CONFIG_DIR;
    return;
  }

  process.env.WAYFRONT_CLI_CONFIG_DIR = originalConfigDir;
});

describe('isLocal', () => {
  it('.test domain', () => {
    assert.equal(isLocal('https://app.spp.test'), true);
  });

  it('.local domain', () => {
    assert.equal(isLocal('https://app.local'), true);
  });

  it('localhost', () => {
    assert.equal(isLocal('http://localhost:8000'), true);
  });

  it('production wayfront.com', () => {
    assert.equal(isLocal('https://acme.wayfront.com'), false);
  });

  it('custom production domain', () => {
    assert.equal(isLocal('https://app.example.com'), false);
  });
});

describe('apiRequest oauth refresh handling', () => {
  it('persists rotated refresh tokens before calling the oauth api routes', async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
    process.env.WAYFRONT_CLI_CONFIG_DIR = configDir;

    saveConfig({
      default: 'acme',
      workspaces: {
        acme: {
          url: 'https://acme.wayfront.com',
          auth: {
            type: 'oauth',
            accessToken: 'old-access-token',
            refreshToken: 'old-refresh-token',
            expiresAt: '2000-01-01T00:00:00.000Z',
            tokenEndpoint: 'https://acme.wayfront.com/oauth/token',
          },
        },
      },
    });

    const fetchCalls = [];

    global.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });

      if (url === 'https://acme.wayfront.com/oauth/token') {
        assert.equal(options.method, 'POST');
        assert.match(options.body.toString(), /grant_type=refresh_token/);
        assert.match(options.body.toString(), /refresh_token=old-refresh-token/);

        return jsonResponse({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
        });
      }

      if (url === 'https://acme.wayfront.com/oauth-api/orders') {
        assert.equal(options.headers.Authorization, 'Bearer new-access-token');
        return jsonResponse([]);
      }

      throw new Error(`Unexpected fetch url: ${url}`);
    };

    const response = await apiGet('/api/orders');
    assert.deepEqual(response, []);
    assert.equal(fetchCalls.length, 2);

    const persisted = loadConfig();
    assert.equal(persisted.workspaces.acme.auth.accessToken, 'new-access-token');
    assert.equal(persisted.workspaces.acme.auth.refreshToken, 'new-refresh-token');

    rmSync(configDir, { recursive: true, force: true });
  });
});

function htmlResponse({ status = 200, url = 'https://acme.wayfront.com/api/orders', redirected = false } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'ERROR',
    url,
    redirected,
    headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'text/html; charset=UTF-8' : null) },
    async json() { throw new SyntaxError("Unexpected token '<', \"<!DOCTYPE \"... is not valid JSON"); },
  };
}

function useTokenWorkspace() {
  const configDir = mkdtempSync(join(tmpdir(), 'wayfront-cli-'));
  process.env.WAYFRONT_CLI_CONFIG_DIR = configDir;
  saveConfig({
    default: 'acme',
    workspaces: { acme: { url: 'https://acme.wayfront.com', auth: { type: 'token', token: 't' } } },
  });
  return () => rmSync(configDir, { recursive: true, force: true });
}

describe('apiRequest non-JSON handling', () => {
  it('reports an expired license instead of a JSON parse error', async () => {
    const cleanup = useTokenWorkspace();
    global.fetch = async () => htmlResponse({ redirected: true, url: 'https://acme.wayfront.com/expired' });

    await assert.rejects(apiGet('/api/orders'), /license is not active/);
    cleanup();
  });

  it('reports a redirect (login/cross-domain bounce) with the destination', async () => {
    const cleanup = useTokenWorkspace();
    global.fetch = async () => htmlResponse({ redirected: true, url: 'https://acme.wayfront.com/login' });

    await assert.rejects(apiGet('/api/orders'), /redirected to https:\/\/acme\.wayfront\.com\/login/);
    cleanup();
  });

  it('reports an HTML body on a 200 instead of crashing on JSON.parse', async () => {
    const cleanup = useTokenWorkspace();
    global.fetch = async () => htmlResponse();

    await assert.rejects(apiGet('/api/orders'), /Expected a JSON response .* "text\/html/);
    cleanup();
  });

  it('reports a non-JSON body that lacks a content-type', async () => {
    const cleanup = useTokenWorkspace();
    global.fetch = async () => ({
      ok: true, status: 200, url: 'https://acme.wayfront.com/api/orders', redirected: false,
      headers: { get: () => null },
      async json() { throw new SyntaxError('boom'); },
    });

    await assert.rejects(apiGet('/api/orders'), /non-JSON response/);
    cleanup();
  });

  it('still returns a valid JSON body', async () => {
    const cleanup = useTokenWorkspace();
    global.fetch = async () => ({
      ok: true, status: 200, url: 'https://acme.wayfront.com/api/orders', redirected: false,
      headers: { get: (h) => (String(h).toLowerCase() === 'content-type' ? 'application/json' : null) },
      async json() { return [{ id: 1 }]; },
    });

    assert.deepEqual(await apiGet('/api/orders'), [{ id: 1 }]);
    cleanup();
  });
});
