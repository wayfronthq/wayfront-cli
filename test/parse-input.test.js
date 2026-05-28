import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkspaceInput } from '../src/lib/workspace-input.js';

describe('parseWorkspaceInput', () => {
  it('plain workspace name', () => {
    assert.deepEqual(parseWorkspaceInput('acme'), { workspace: 'acme', url: null });
  });

  it('full wayfront URL with https', () => {
    assert.deepEqual(parseWorkspaceInput('https://acme.wayfront.com'), { workspace: 'acme', url: null });
  });

  it('wayfront URL with path — strips path', () => {
    assert.deepEqual(parseWorkspaceInput('https://acme.wayfront.com/some/path'), { workspace: 'acme', url: null });
  });

  it('wayfront domain without protocol', () => {
    assert.deepEqual(parseWorkspaceInput('acme.wayfront.com'), { workspace: 'acme', url: null });
  });

  it('custom domain without protocol — adds https', () => {
    assert.deepEqual(parseWorkspaceInput('dev.example.com'), { workspace: 'dev', url: 'https://dev.example.com' });
  });

  it('custom domain with https', () => {
    assert.deepEqual(parseWorkspaceInput('https://dev.example.com'), { workspace: 'dev', url: 'https://dev.example.com' });
  });

  it('custom domain with http — preserves http', () => {
    assert.deepEqual(parseWorkspaceInput('http://test.spp.test'), { workspace: 'test', url: 'http://test.spp.test' });
  });

  it('localhost with port', () => {
    assert.deepEqual(parseWorkspaceInput('http://localhost:8000'), { workspace: 'localhost', url: 'http://localhost:8000' });
  });
});
