import { hostname, userInfo } from 'node:os';
import { getCredentials } from './config.js';

function getDeviceName() {
  try {
    return `${userInfo().username}@${hostname()}`;
  } catch {
    return hostname();
  }
}

// Suppress the TLS warning when we intentionally disable cert checks for local dev
const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...args) {
  if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  return originalEmitWarning.call(this, warning, ...args);
};

export function isLocal(url) {
  const { hostname } = new URL(url);
  return hostname === 'localhost'
    || hostname.endsWith('.test')
    || hostname.endsWith('.local');
}

async function request(method, path, body) {
  const { url: baseUrl, token } = getCredentials();
  const url = `${baseUrl}${path}`;

  // Trust self-signed certs for local dev domains
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  if (isLocal(baseUrl)) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-Device-Name': getDeviceName(),
    },
  };

  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error(`Could not connect to ${url}`);
  } finally {
    if (prevTls === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls;
    }
  }

  if (!res.ok) {
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }

    if (res.status === 401) {
      throw new Error('Authentication failed. Check your API token.');
    }
    if (res.status === 403) {
      throw new Error(data.message || 'Forbidden. Your license may not include API access.');
    }
    if (res.status === 422 && data.errors) {
      const msgs = Object.entries(data.errors)
        .map(([field, errs]) => `  ${field}: ${errs.join(', ')}`)
        .join('\n');
      throw new Error(`Validation failed:\n${msgs}`);
    }

    throw new Error(data.message || `API error ${res.status}`);
  }

  if (res.status === 204) return null;

  return res.json();
}

export function apiGet(path) {
  return request('GET', path);
}

export function apiPut(path, body) {
  return request('PUT', path, body);
}

export function apiDelete(path) {
  return request('DELETE', path);
}
