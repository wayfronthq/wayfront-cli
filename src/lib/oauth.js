import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { win32 as win32Path } from 'node:path';

const require = createRequire(import.meta.url);
const { version: CLI_VERSION } = require('../../package.json');

export const DEFAULT_OAUTH_SCOPE = 'cli';
export const DEFAULT_CALLBACK_TIMEOUT_MS = 300000;
const CALLBACK_PATH = '/callback';
const REQUIRED_ENDPOINTS = ['authorization_endpoint', 'token_endpoint'];
const OPTIONAL_ENDPOINTS = ['registration_endpoint'];

function toBase64Url(buffer) {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function generateCodeVerifier() {
  return toBase64Url(randomBytes(32));
}

export function generateCodeChallenge(verifier) {
  return toBase64Url(createHash('sha256').update(verifier).digest());
}

function parseHttpUrl(value, label) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Workspace returned an unparseable ${label}: ${value}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Refusing to use a non-HTTP ${label} (${parsed.protocol}) returned by the workspace: ${value}`);
  }

  return parsed;
}

/**
 * The OAuth metadata document is fetched from the workspace, so every endpoint in
 * it is remote-controlled input. Requiring each endpoint to share the origin that
 * served the document stops a hostile or misconfigured workspace from pointing the
 * token/registration POSTs — which carry the authorization code and PKCE verifier —
 * at an unrelated host such as a cloud metadata service or a loopback port.
 */
export function validateOAuthMetadata(metadata, issuerOrigin) {
  const expectedOrigin = new URL(issuerOrigin).origin;

  for (const field of [...REQUIRED_ENDPOINTS, ...OPTIONAL_ENDPOINTS]) {
    const value = metadata?.[field];

    if (value === undefined || value === null) {
      if (OPTIONAL_ENDPOINTS.includes(field)) {
        continue;
      }

      throw new Error(`Workspace OAuth metadata is missing ${field}.`);
    }

    const endpoint = parseHttpUrl(value, field);

    if (endpoint.origin !== expectedOrigin) {
      throw new Error(
        `Workspace OAuth metadata points ${field} at ${endpoint.origin}, which is not the workspace origin `
        + `(${expectedOrigin}). Refusing to continue.`,
      );
    }
  }

  return metadata;
}

/**
 * Builds the argv used to hand a URL to the platform's default browser.
 *
 * Returned as a command plus an argument array so the caller can spawn it without
 * a shell: cmd.exe ignores single quotes and treats `&` as a command separator, so
 * any shell-interpolated form truncates OAuth URLs at their first query parameter.
 * `explorer.exe` is preferred on Windows over `rundll32 url.dll,FileProtocolHandler`
 * because endpoint protection commonly blocks the latter as a LOLBin technique.
 */
export function browserCommandFor(platform, url) {
  if (platform === 'win32') {
    return {
      command: win32Path.join(process.env.SystemRoot || 'C:\\Windows', 'explorer.exe'),
      args: [url],
    };
  }

  if (platform === 'darwin') {
    return { command: 'open', args: [url] };
  }

  return { command: 'xdg-open', args: [url] };
}

/**
 * Opens `url` in the default browser, best-effort.
 *
 * Exit codes are deliberately ignored: explorer.exe reports a non-zero status even
 * when it succeeds, and xdg-open returns 0 as soon as it hands off, so neither can
 * confirm a browser actually opened. The URL printed by runOauthFlow is what
 * guarantees the user can complete the login.
 */
export function openUrl(url) {
  parseHttpUrl(url, 'authorization URL');

  const { command, args } = browserCommandFor(process.platform, url);
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });

  child.on('error', () => {
    console.log('Could not open a browser automatically. Copy the URL above into a browser on this machine.');
  });

  child.unref();

  return child;
}

export async function discoverOAuthMetadata(baseUrl) {
  const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Could not discover OAuth metadata for ${baseUrl}`);
  }

  const metadata = await response.json();

  // Validate against the URL that actually served the document rather than the
  // requested one: a workspace reachable on more than one domain may redirect to
  // its canonical host, and the origin that served the metadata is the one whose
  // endpoints we are being asked to trust.
  return validateOAuthMetadata(metadata, response.url || baseUrl);
}

export async function registerOauthClient(metadata, redirectUri, scope = DEFAULT_OAUTH_SCOPE) {
  if (!metadata.registration_endpoint) {
    throw new Error('OAuth registration endpoint not available on this workspace.');
  }

  const response = await fetch(metadata.registration_endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_name: 'Wayfront CLI',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope,
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth client registration failed with status ${response.status}`);
  }

  return response.json();
}

export function buildAuthorizationUrl({ metadata, clientId, redirectUri, state, codeChallenge, scope = DEFAULT_OAUTH_SCOPE }) {
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function exchangeAuthorizationCode({ metadata, clientId, redirectUri, code, verifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });

  const response = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token exchange failed with status ${response.status}`);
  }

  return response.json();
}

export async function refreshAccessToken(auth) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: auth.clientId,
    refresh_token: auth.refreshToken,
  });

  const response = await fetch(auth.tokenEndpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    throw new Error(`OAuth token refresh failed with status ${response.status}`);
  }

  return response.json();
}

function respond(res, status, heading, body) {
  res.writeHead(status, { 'Content-Type': 'text/html' });
  res.end(`<h1>${heading}</h1><p>${body}</p>`);
}

function shutdown(server) {
  server.close();
  // The browser holds the callback connection open with keep-alive, which would
  // otherwise keep the CLI alive for the server's idle timeout after login.
  server.closeAllConnections?.();
}

export function startCallbackServer({ state, timeoutMs = DEFAULT_CALLBACK_TIMEOUT_MS }) {
  return new Promise((resolve, reject) => {
    // Set once waitForCode() is called. Until then the server is already listening
    // (the OAuth client still has to be registered), so anything that arrives is a
    // stray request and must not be mistaken for — or allowed to pre-empt — the
    // real callback.
    let handleCallback = null;

    const server = createServer((req, res) => {
      const { pathname } = new URL(req.url, 'http://127.0.0.1');

      if (pathname !== CALLBACK_PATH || !handleCallback) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
        return;
      }

      handleCallback(req, res);
    });

    server.once('error', reject);

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();

      // Listening succeeded, so a later error belongs to waitForCode's promise.
      server.removeListener('error', reject);

      resolve({
        port,
        waitForCode: () => new Promise((resolveCode, rejectCode) => {
          const timer = setTimeout(() => {
            shutdown(server);
            rejectCode(new Error(
              `Timed out waiting for OAuth callback (Wayfront CLI v${CLI_VERSION}). `
              + 'Re-run `wayfront auth login` to try again.',
            ));
          }, timeoutMs);

          const settle = (settleWith, value) => {
            clearTimeout(timer);
            shutdown(server);
            settleWith(value);
          };

          server.once('error', (error) => settle(rejectCode, error));

          handleCallback = (req, res) => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const returnedState = url.searchParams.get('state');
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (error) {
              respond(res, 400, 'Wayfront CLI login failed', 'You can close this window.');
              settle(rejectCode, new Error(`OAuth authorization failed: ${error}`));
              return;
            }

            if (!code || returnedState !== state) {
              respond(res, 400, 'Wayfront CLI login failed', 'State mismatch. You can close this window.');
              settle(rejectCode, new Error('OAuth callback state mismatch.'));
              return;
            }

            respond(res, 200, 'Wayfront CLI connected', 'You can close this window and return to your terminal.');
            settle(resolveCode, code);
          };
        }),
      });
    });
  });
}

/**
 * Printed before the browser is launched so the login never depends on the launch
 * succeeding — the URL is unstyled and alone on its line to survive copy/paste out
 * of terminals that hard-wrap long lines.
 */
function printAuthorizationUrl(authorizationUrl) {
  console.log(`Wayfront CLI v${CLI_VERSION}`);
  console.log('');
  console.log('Open this URL in your browser to sign in:');
  console.log('');
  console.log(authorizationUrl);
  console.log('');
  console.log('The browser must be on this machine - the CLI is listening on 127.0.0.1.');
  console.log('Waiting for authorization... (Ctrl+C to cancel)');
}

export async function runOauthFlow(baseUrl) {
  const metadata = await discoverOAuthMetadata(baseUrl);
  const scope = DEFAULT_OAUTH_SCOPE;
  const state = toBase64Url(randomBytes(16));
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const callback = await startCallbackServer({ state });
  const redirectUri = `http://127.0.0.1:${callback.port}${CALLBACK_PATH}`;
  const client = await registerOauthClient(metadata, redirectUri, scope);
  const authorizationUrl = buildAuthorizationUrl({
    metadata,
    clientId: client.client_id,
    redirectUri,
    state,
    codeChallenge: challenge,
    scope,
  });

  printAuthorizationUrl(authorizationUrl);
  openUrl(authorizationUrl);

  const code = await callback.waitForCode();
  const token = await exchangeAuthorizationCode({
    metadata,
    clientId: client.client_id,
    redirectUri,
    code,
    verifier,
  });

  return {
    type: 'oauth',
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: token.expires_in ? new Date(Date.now() + (token.expires_in * 1000)).toISOString() : null,
    clientId: client.client_id,
    tokenEndpoint: metadata.token_endpoint,
    authorizationEndpoint: metadata.authorization_endpoint,
    registrationEndpoint: metadata.registration_endpoint,
    scope,
  };
}
