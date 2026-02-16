import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseInput } from '../src/commands/init.js';

describe('parseInput', () => {
  it('plain workspace name', () => {
    assert.deepEqual(parseInput('acme'), { workspace: 'acme', url: null });
  });

  it('full wayfront URL with https', () => {
    assert.deepEqual(parseInput('https://acme.wayfront.com'), { workspace: 'acme', url: null });
  });

  it('wayfront URL with path — strips path', () => {
    assert.deepEqual(parseInput('https://acme.wayfront.com/some/path'), { workspace: 'acme', url: null });
  });

  it('wayfront domain without protocol', () => {
    assert.deepEqual(parseInput('acme.wayfront.com'), { workspace: 'acme', url: null });
  });

  it('custom domain without protocol — adds https', () => {
    assert.deepEqual(parseInput('dev.example.com'), { workspace: 'dev', url: 'https://dev.example.com' });
  });

  it('custom domain with https', () => {
    assert.deepEqual(parseInput('https://dev.example.com'), { workspace: 'dev', url: 'https://dev.example.com' });
  });

  it('custom domain with http — preserves http', () => {
    assert.deepEqual(parseInput('http://test.spp.test'), { workspace: 'test', url: 'http://test.spp.test' });
  });

  it('localhost with port', () => {
    assert.deepEqual(parseInput('http://localhost:8000'), { workspace: 'localhost', url: 'http://localhost:8000' });
  });
});
