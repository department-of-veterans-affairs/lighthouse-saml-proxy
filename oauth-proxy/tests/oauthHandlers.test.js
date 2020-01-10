'use strict';

require('jest');

const { TokenSet } = require('openid-client');
const timekeeper = require('timekeeper');

const { translateTokenSet } = require('../oauthHandlers/tokenResponse');

describe('translateTokenSet', () => {
  it('omits id_token if not in TokenSet', async () => {
    const oauth_only_set = new TokenSet({
      access_token: 'oauth.is.cool',
      refresh_token: 'refresh.later',
      expires_in: 3600,
    });
    const translated = translateTokenSet(oauth_only_set);
    expect(translated).not.toHaveProperty('id_token');
  });

  it('copies id_token for OIDC', async () => {
    const fake_id_token = 'oidc.is.cool';
    const oidc_set = new TokenSet({
      access_token: 'oauth.is.cool',
      refresh_token: 'refresh.later',
      id_token: fake_id_token,
      expires_in: 3600,
    });

    const translated = translateTokenSet(oidc_set);
    expect(translated).toHaveProperty('id_token');
    expect(translated.id_token).toEqual(fake_id_token);
  });

  it('translates absolute timestamps to relative timestamps', async () => {
    try {
      timekeeper.freeze(Date.now());
      const abs_oauth_set = new TokenSet({
        access_token: 'oauth.is.cool',
        refresh_token: 'refresh.later',
        expires_in: 7200,
      });
      const now_sec = Math.floor(Date.now() / 1000);
      expect(abs_oauth_set.expires_at - now_sec).toEqual(7200);

      const translated = translateTokenSet(abs_oauth_set);
      expect(translated).toHaveProperty('expires_in');
      expect(translated.expires_in).toEqual(7200);
    } finally {
      timekeeper.reset();
    }
  });
});

