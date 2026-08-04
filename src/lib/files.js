import { posix, join } from 'node:path';
import { readdirSync } from 'node:fs';
import chalk from 'chalk';

// Template names map to a stable, forward-slash path regardless of platform:
// the mapping is a logical namespace, not an OS path, and Node's fs accepts `/`
// on Windows. Using the native path separator here produced backslash paths on
// Windows that broke the dot-notation round-trip.
function toPosix(p) {
  return p.replace(/\\/g, '/');
}

export function nameToPath(name, dir = './templates') {
  const parts = name.split('.');
  return posix.join(toPosix(dir), ...parts) + '.twig';
}

export function pathToName(filePath, dir = './templates') {
  let rel = toPosix(filePath).replace(/^\.\//, '').replace(/\/+$/, '');
  const base = toPosix(dir).replace(/^\.\//, '').replace(/\/+$/, '');

  if (base && (rel === base || rel.startsWith(`${base}/`))) {
    rel = rel.slice(base.length).replace(/^\/+/, '');
  }

  if (rel.endsWith('.twig')) {
    rel = rel.slice(0, -5);
  }

  return rel.split('/').join('.');
}

export function formatName(name) {
  const lastDot = name.lastIndexOf('.');
  if (lastDot === -1) return chalk.bold(name);
  return chalk.dim(name.slice(0, lastDot + 1)) + chalk.bold(name.slice(lastDot + 1));
}

export function elapsed(start) {
  const ms = Date.now() - start;
  return chalk.dim(ms < 1000 ? `(${ms}ms)` : `(${(ms / 1000).toFixed(1)}s)`);
}

export function findTemplateFiles(dir = './templates') {
  const results = [];

  function walk(current) {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.twig')) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}
