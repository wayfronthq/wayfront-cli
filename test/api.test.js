import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLocal } from '../src/lib/api.js';

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
