import { hostname, userInfo } from 'node:os';
import { getCredentials, loadConfig, saveConfig, getApiBasePath } from './config.js';
import { refreshAccessToken } from './oauth.js';

function getDeviceName() {
  try {
    return `${userInfo().username}@${hostname()}`;
  } catch {
    return hostname();
  }
}

const originalEmitWarning = process.emitWarning;
process.emitWarning = function emitWarningPatched(warning, ...args) {
  if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  return originalEmitWarning.call(this, warning, ...args);
};

export function isLocal(url) {
  const { hostname: host } = new URL(url);
  return host === 'localhost'
    || host.endsWith('.test')
    || host.endsWith('.local');
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function normalizePath(path, basePath) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (path.startsWith('/api/')) {
    return `${basePath}${path.slice(4)}`;
  }

  if (path.startsWith('/oauth-api/')) {
    return `${basePath}${path.slice(10)}`;
  }

  if (!path.startsWith('/')) {
    return `${basePath}/${path}`;
  }

  return `${basePath}${path}`;
}

async function resolveAuthState() {
  const workspace = getCredentials();

  if (workspace.auth.type !== 'oauth') {
    return workspace;
  }

  const expiresAt = workspace.auth.expiresAt ? Date.parse(workspace.auth.expiresAt) : null;
  const shouldRefresh = workspace.auth.refreshToken && (!expiresAt || expiresAt <= Date.now() + 60_000);

  if (!shouldRefresh) {
    return workspace;
  }

  const refreshed = await refreshAccessToken(workspace.auth);
  const config = loadConfig();
  config.workspaces[workspace.workspace] = {
    ...config.workspaces[workspace.workspace],
    auth: {
      ...workspace.auth,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token || workspace.auth.refreshToken,
      expiresAt: refreshed.expires_in ? new Date(Date.now() + (refreshed.expires_in * 1000)).toISOString() : workspace.auth.expiresAt,
    },
  };
  saveConfig(config);

  return getCredentials();
}

export async function apiRequest(method, path, body) {
  const workspace = await resolveAuthState();
  const basePath = getApiBasePath(workspace);
  const url = /^https?:\/\//.test(path)
    ? path
    : `${workspace.url}${normalizePath(path, basePath)}`;

  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (isLocal(workspace.url)) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED='0';
  }

  const token = workspace.auth.type === 'oauth'
    ? workspace.auth.accessToken
    : workspace.auth.token;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'X-Device-Name': getDeviceName(),
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error(`Could not connect to ${url}`);
  } finally {
    if (prevTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    }
  }

  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(`API error ${response.status}: ${response.statusText}`, response.status);
    }

    if (response.status === 401) {
      throw new ApiError('Authentication failed. Check your credentials or run wayfront auth login.', 401);
    }
    if (response.status === 403) {
      throw new ApiError(data.message || 'Forbidden. Your workspace or user does not have access to this action.', 403);
    }
    if (response.status === 422 && data.errors) {
      const messages = Object.entries(data.errors)
        .map(([field, errors]) => `  ${field}: ${errors.join(', ')}`)
        .join('\n');
      throw new ApiError(`Validation failed:\n${messages}`, 422);
    }

    throw new ApiError(data.message || `API error ${response.status}`, response.status);
  }

  if (response.status === 204) return null;

  return response.json();
}

export function apiGet(path) {
  return apiRequest('GET', path);
}

export function apiPost(path, body) {
  return apiRequest('POST', path, body);
}

export function apiPut(path, body) {
  return apiRequest('PUT', path, body);
}

export function apiPatch(path, body) {
  return apiRequest('PATCH', path, body);
}

export function apiDelete(path) {
  return apiRequest('DELETE', path);
}
