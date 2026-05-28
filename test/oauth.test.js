import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuthorizationUrl, DEFAULT_OAUTH_SCOPE } from '../src/lib/oauth.js';

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
