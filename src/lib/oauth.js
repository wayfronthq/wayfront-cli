import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';

export const DEFAULT_OAUTH_SCOPE = 'cli';

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

export function openUrl(url) {
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  exec(`${cmd} '${url}'`);
}

export async function discoverOAuthMetadata(baseUrl) {
  const response = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Could not discover OAuth metadata for ${baseUrl}`);
  }

  return response.json();
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

function startCallbackServer({ state, timeoutMs = 120000 }) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      const returnedState = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Wayfront CLI login failed</h1><p>You can close this window.</p>');
        server.close();
        reject(new Error(`OAuth authorization failed: ${error}`));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Wayfront CLI login failed</h1><p>State mismatch. You can close this window.</p>');
        server.close();
        reject(new Error('OAuth callback state mismatch.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Wayfront CLI connected</h1><p>You can close this window and return to your terminal.</p>');
      server.close();
      resolve(code);
    });

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        port,
        waitForCode: () => new Promise((resolveCode, rejectCode) => {
          const timer = setTimeout(() => {
            server.close();
            rejectCode(new Error('Timed out waiting for OAuth callback.'));
          }, timeoutMs);

          server.removeAllListeners('request');
          server.on('request', (req, res) => {
            const url = new URL(req.url, 'http://127.0.0.1');
            const returnedState = url.searchParams.get('state');
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');

            if (error) {
              clearTimeout(timer);
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Wayfront CLI login failed</h1><p>You can close this window.</p>');
              server.close();
              rejectCode(new Error(`OAuth authorization failed: ${error}`));
              return;
            }

            if (!code || returnedState !== state) {
              clearTimeout(timer);
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h1>Wayfront CLI login failed</h1><p>State mismatch. You can close this window.</p>');
              server.close();
              rejectCode(new Error('OAuth callback state mismatch.'));
              return;
            }

            clearTimeout(timer);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Wayfront CLI connected</h1><p>You can close this window and return to your terminal.</p>');
            server.close();
            resolveCode(code);
          });
        }),
      });
    });

    server.on('error', reject);
  });
}

export async function runOauthFlow(baseUrl) {
  const metadata = await discoverOAuthMetadata(baseUrl);
  const scope = DEFAULT_OAUTH_SCOPE;
  const state = toBase64Url(randomBytes(16));
  const verifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(verifier);
  const callback = await startCallbackServer({ state });
  const redirectUri = `http://127.0.0.1:${callback.port}/callback`;
  const client = await registerOauthClient(metadata, redirectUri, scope);
  const authorizationUrl = buildAuthorizationUrl({
    metadata,
    clientId: client.client_id,
    redirectUri,
    state,
    codeChallenge: challenge,
    scope,
  });

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
