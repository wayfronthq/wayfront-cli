import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  browserCommandFor,
  buildAuthorizationUrl,
  DEFAULT_OAUTH_SCOPE,
  discoverOAuthMetadata,
  openUrl,
  startCallbackServer,
  validateOAuthMetadata,
} from '../src/lib/oauth.js';

// A realistic authorization URL: `&` between params is what cmd.exe used to treat
// as a command separator, and the base64url state/challenge carry `-` and `_`.
const AUTHORIZATION_URL = buildAuthorizationUrl({
  metadata: { authorization_endpoint: 'https://acme.wayfront.com/oauth/authorize' },
  clientId: 'client-123',
  redirectUri: 'http://127.0.0.1:9000/callback',
  state: 'c3RhdGU-_123',
  codeChallenge: 'Y2hhbGxlbmdl-_123',
});

function metadataFor(origin, overrides = {}) {
  return {
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    ...overrides,
  };
}

describe('oauth scopes', () => {
  it('uses the cli scope for authorization urls by default', () => {
    const authorizationUrl = buildAuthorizationUrl({
      metadata: {
        authorization_endpoint: 'https://acme.wayfront.com/oauth/authorize',
      },
      clientId: 'client-123',
      redirectUri: 'http://127.0.0.1:9000/callback',
      state: 'state-123',
      codeChallenge: 'challenge-123',
    });

    const url = new URL(authorizationUrl);

    assert.equal(DEFAULT_OAUTH_SCOPE, 'cli');
    assert.equal(url.searchParams.get('scope'), 'cli');
  });
});

describe('browserCommandFor', () => {
  const originalSystemRoot = process.env.SystemRoot;

  afterEach(() => {
    if (originalSystemRoot === undefined) {
      delete process.env.SystemRoot;
    } else {
      process.env.SystemRoot = originalSystemRoot;
    }
  });

  it('uses PowerShell Start-Process from SystemRoot on windows', () => {
    process.env.SystemRoot = 'D:\\Windows';
    const { command, args } = browserCommandFor('win32', AUTHORIZATION_URL);

    assert.equal(command, 'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
    assert.deepEqual(args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command']);
    // URL embedded as a single-quoted PowerShell literal (query intact).
    assert.equal(args[3], `Start-Process '${AUTHORIZATION_URL}'`);
    assert.ok(args[3].includes('&code_challenge='));
  });

  it('falls back to C:\\Windows when SystemRoot is unset', () => {
    delete process.env.SystemRoot;

    assert.equal(
      browserCommandFor('win32', AUTHORIZATION_URL).command,
      'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
    );
  });

  it('escapes single quotes so a hostile url cannot break out of the string', () => {
    // The only character that can escape a PowerShell single-quoted string is a
    // single quote, closed by doubling it. Everything else ($ ; & ...) is literal.
    const hostile = "https://acme.wayfront.com/x'; Start-Process calc; '";
    const command = browserCommandFor('win32', hostile).args[3];

    assert.equal(command, `Start-Process 'https://acme.wayfront.com/x''; Start-Process calc; '''`);
  });

  it('uses open on macos', () => {
    assert.deepEqual(browserCommandFor('darwin', AUTHORIZATION_URL), {
      command: 'open',
      args: [AUTHORIZATION_URL],
    });
  });

  it('uses xdg-open on linux and other platforms', () => {
    assert.deepEqual(browserCommandFor('linux', AUTHORIZATION_URL), {
      command: 'xdg-open',
      args: [AUTHORIZATION_URL],
    });
    assert.equal(browserCommandFor('freebsd', AUTHORIZATION_URL).command, 'xdg-open');
  });

  it('passes the whole url as a single argument on unix platforms', () => {
    // The Windows bug was the URL being split at its first `&`; on unix the URL is
    // a single argv element, so assert the query survives intact.
    for (const platform of ['darwin', 'linux']) {
      const { args } = browserCommandFor(platform, AUTHORIZATION_URL);

      assert.equal(args.length, 1);
      assert.equal(args[0], AUTHORIZATION_URL);
      assert.ok(args[0].includes('&code_challenge='));
      assert.equal(new URL(args[0]).searchParams.get('code_challenge'), 'Y2hhbGxlbmdl-_123');
    }
  });

  it('keeps shell metacharacters in the url untouched on unix', () => {
    const hostile = "https://acme.wayfront.com/oauth/authorize?a=1&b='; id;'&c=%3Bwhoami";

    assert.equal(browserCommandFor('darwin', hostile).args[0], hostile);
    assert.equal(browserCommandFor('linux', hostile).args[0], hostile);
  });
});

describe('openUrl', () => {
  it('refuses to launch a non-http(s) url', () => {
    // `open`/explorer will hand any scheme to its registered handler, so a
    // hostile workspace must not be able to reach one.
    assert.throws(() => openUrl('file:///etc/passwd'), /non-HTTP authorization URL/);
    assert.throws(() => openUrl('javascript:alert(1)'), /non-HTTP authorization URL/);
  });

  it('refuses to launch an unparseable url', () => {
    assert.throws(() => openUrl('not a url'), /unparseable authorization URL/);
  });
});

describe('validateOAuthMetadata', () => {
  const origin = 'https://acme.wayfront.com';

  it('accepts endpoints served from the workspace origin', () => {
    const metadata = metadataFor(origin);

    assert.equal(validateOAuthMetadata(metadata, origin), metadata);
  });

  it('accepts metadata without the optional registration endpoint', () => {
    const metadata = metadataFor(origin, { registration_endpoint: undefined });

    assert.doesNotThrow(() => validateOAuthMetadata(metadata, origin));
  });

  it('ignores path and trailing slash on the issuer', () => {
    assert.doesNotThrow(() => validateOAuthMetadata(metadataFor(origin), `${origin}/`));
  });

  it('rejects a missing required endpoint', () => {
    for (const field of ['authorization_endpoint', 'token_endpoint']) {
      const metadata = metadataFor(origin, { [field]: undefined });

      assert.throws(() => validateOAuthMetadata(metadata, origin), new RegExp(`missing ${field}`));
    }
  });

  it('rejects non-http(s) endpoints', () => {
    for (const field of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
      const metadata = metadataFor(origin, { [field]: 'file:///etc/passwd' });

      assert.throws(() => validateOAuthMetadata(metadata, origin), /non-HTTP/);
    }
  });

  it('rejects unparseable endpoints', () => {
    const metadata = metadataFor(origin, { token_endpoint: 'not a url' });

    assert.throws(() => validateOAuthMetadata(metadata, origin), /unparseable token_endpoint/);
  });

  it('rejects endpoints pointing away from the workspace origin', () => {
    // The SSRF case: a valid https URL is not enough, since the authorization
    // code and PKCE verifier are POSTed to token_endpoint.
    const cases = [
      'https://evil.example/oauth/token',
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:8200/v1/secret',
      'https://acme.wayfront.com:8443/oauth/token',
    ];

    for (const endpoint of cases) {
      const metadata = metadataFor(origin, { token_endpoint: endpoint });

      assert.throws(
        () => validateOAuthMetadata(metadata, origin),
        /points token_endpoint at .* not the workspace origin/,
      );
    }
  });

  it('checks every endpoint, not just the authorization endpoint', () => {
    for (const field of ['authorization_endpoint', 'token_endpoint', 'registration_endpoint']) {
      const metadata = metadataFor(origin, { [field]: 'https://evil.example/x' });

      assert.throws(() => validateOAuthMetadata(metadata, origin), new RegExp(`points ${field} at`));
    }
  });
});

describe('callback server', () => {
  const STATE = 'state-abc';

  function get(port, path) {
    return fetch(`http://127.0.0.1:${port}${path}`, { headers: { Connection: 'close' } });
  }

  it('completes the flow when the browser hits the callback', async () => {
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 5000 });
    const pending = callback.waitForCode();
    const response = await get(callback.port, `/callback?code=the-code&state=${STATE}`);

    assert.equal(response.status, 200);
    // The response body must arrive intact — the shutdown must not sever the
    // socket before the success page flushes.
    assert.match(await response.text(), /Wayfront CLI connected/);
    assert.equal(await pending, 'the-code');
  });

  it('ignores strays that arrive before the callback is awaited', async () => {
    // The server starts listening before the OAuth client is registered. A stray
    // request in that window must not tear it down, or the real callback later
    // lands on a closed server and the login hangs until the timeout.
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 5000 });

    assert.equal((await get(callback.port, '/')).status, 404);

    const pending = callback.waitForCode();

    assert.equal((await get(callback.port, `/callback?code=late&state=${STATE}`)).status, 200);
    assert.equal(await pending, 'late');
  });

  it('ignores non-callback paths while waiting', async () => {
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 5000 });
    const pending = callback.waitForCode();

    assert.equal((await get(callback.port, '/favicon.ico')).status, 404);
    assert.equal((await get(callback.port, `/callback?code=ok&state=${STATE}`)).status, 200);
    assert.equal(await pending, 'ok');
  });

  it('rejects when the returned state does not match', async () => {
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 5000 });
    // Assert first so the rejection handler is attached before the request
    // triggers it, otherwise the rejection surfaces as unhandled.
    const rejected = assert.rejects(callback.waitForCode(), /state mismatch/i);

    assert.equal((await get(callback.port, '/callback?code=x&state=wrong')).status, 400);
    await rejected;
  });

  it('rejects when the workspace returns an error', async () => {
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 5000 });
    const rejected = assert.rejects(callback.waitForCode(), /access_denied/);

    assert.equal((await get(callback.port, '/callback?error=access_denied')).status, 400);
    await rejected;
  });

  it('times out with a message naming the command to re-run', async () => {
    const callback = await startCallbackServer({ state: STATE, timeoutMs: 50 });

    await assert.rejects(callback.waitForCode(), /Timed out waiting for OAuth callback.*wayfront auth login/s);
  });
});

describe('discoverOAuthMetadata', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function fakeResponse({ url, body }) {
    return { ok: true, url, json: async () => body };
  }

  it('validates metadata against the requested origin', async () => {
    const origin = 'https://acme.wayfront.com';
    global.fetch = async () => fakeResponse({ url: `${origin}/.well-known/oauth-authorization-server`, body: metadataFor(origin) });

    const metadata = await discoverOAuthMetadata(origin);

    assert.equal(metadata.token_endpoint, `${origin}/oauth/token`);
  });

  it('rejects a cross-origin discovery redirect even if the metadata is self-consistent', async () => {
    // fetch follows the redirect; the attacker's document validates against the
    // attacker's own origin, so anchoring to response.url would pass. Anchoring to
    // the requested origin must catch it.
    const evil = 'https://evil.example';
    global.fetch = async () => fakeResponse({
      url: `${evil}/.well-known/oauth-authorization-server`,
      body: metadataFor(evil),
    });

    await assert.rejects(
      discoverOAuthMetadata('https://acme.wayfront.com'),
      /redirected to https:\/\/evil\.example/,
    );
  });
});
