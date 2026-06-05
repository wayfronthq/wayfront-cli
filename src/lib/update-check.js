import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from './config.js';

const REGISTRY_LATEST_URL = 'https://registry.npmjs.org/wayfront/latest';
export const UPDATE_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

function cachePath() {
  return join(getConfigDir(), 'update-check.json');
}

function readCache() {
  try {
    return JSON.parse(readFileSync(cachePath(), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    mkdirSync(getConfigDir(), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(data, null, 2) + '\n');
  } catch {
    // Update checks should never make the CLI fail.
  }
}

function versionParts(version) {
  return String(version)
    .replace(/^v/, '')
    .split('-')[0]
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function compareVersions(left, right) {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] || 0;
    const rightPart = rightParts[index] || 0;

    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }

  return 0;
}

export function buildUpdateNotice(currentVersion, latestVersion) {
  if (!latestVersion || compareVersions(currentVersion, latestVersion) >= 0) {
    return null;
  }

  return `Update available: wayfront ${currentVersion} -> ${latestVersion}. Run npm install -g wayfront@latest, or use npx wayfront@latest.`;
}

export async function getUpdateNotice({
  currentVersion,
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  timeoutMs = 800,
} = {}) {
  if (env.WAYFRONT_SKIP_UPDATE_CHECK === '1' || !currentVersion) {
    return null;
  }

  const cached = readCache();
  if (cached?.checkedAt && now() - cached.checkedAt < UPDATE_CHECK_TTL_MS) {
    return buildUpdateNotice(currentVersion, cached.latestVersion);
  }

  if (!fetchImpl) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(REGISTRY_LATEST_URL, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const latestVersion = payload?.version;
    writeCache({ checkedAt: now(), latestVersion });

    return buildUpdateNotice(currentVersion, latestVersion);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
