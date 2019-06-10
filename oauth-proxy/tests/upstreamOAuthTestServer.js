'use strict';

// This module provides an express app that responds to OAuth endpoints with
// pre-canned responses. This is used as a stand-in for Okta in our e2e tests.

const express = require('express');
const { buildBackgroundServerModule } = require('./backgroundServer');

const UPSTREAM_OAUTH_PORT = 9091;

function prefixPath(path) {
  return `${upstreamOAuthTestServerBaseUrl()}` + path;
}

// Builds the express app. Returns a reference to it.
function buildUpstreamOAuthTestApp() {
  const app = express();

  app.get('/.well-known/openid-configuration', (req, res) => {
    res.json({
      issuer: "https://deptva-eval.okta.com/oauth2/default",
      jwks_uri: prefixPath('/keys'),
      authorization_endpoint: prefixPath('/authorize'),
      userinfo_endpoint: prefixPath('/userinfo'),
      token_endpoint: prefixPath('/token'),
      introspection_endpoint: prefixPath('/introspection'),
      response_types_supported: [
        "code",
        "id_token",
        "code id_token",
        "code token",
        "id_token token",
        "code id_token token"
      ],
      response_modes_supported: [
        "query",
        "fragment",
        "form_post",
        "okta_post_message"
      ],
      grant_types_supported: [
        "authorization_code",
        "implicit",
        "refresh_token",
        "password"
      ],
      subject_types_supported: [
        "public"
      ],
      id_token_signing_alg_values_supported: [
        "RS256"
      ],
      scopes_supported: [
        "openid",
        "email",
        "profile",
        "address",
        "phone",
        "offline_access",
        "groups"
      ],
      token_endpoint_auth_methods_supported: [
        "client_secret_basic",
        "client_secret_post",
        "client_secret_jwt",
        "private_key_jwt",
        "none"
      ],
      claims_supported: [
        "iss",
        "ver",
        "sub",
        "aud",
        "iat",
        "exp",
        "jti",
        "auth_time",
        "amr",
        "idp",
        "nonce",
        "name",
        "nickname",
        "preferred_username",
        "given_name",
        "middle_name",
        "family_name",
        "email",
        "email_verified",
        "profile",
        "zoneinfo",
        "locale",
        "address",
        "phone_number",
        "picture",
        "website",
        "gender",
        "birthdate",
        "updated_at",
        "at_hash",
        "c_hash"
      ],
      code_challenge_methods_supported: [
        "S256"
      ],
    });
  });

  app.get('/keys', (req, res) => {
    res.json({ keys: [] });
  });

  app.get('/userinfo', (req, res) => {
    res.json({
      sub: '00uid4BxXw6I6TV4m0g3',
      name: 'John Doe',
      nickname: 'Jimmy',
      given_name: 'John',
      middle_name: 'James',
      family_name: 'Doe',
      profile: 'https://example.com/john.doe',
      zoneinfo: 'America/Los_Angeles',
      locale: 'en-US',
      updated_at: 1311280970,
      email: 'john.doe@example.com',
      email_verified: true,
      address: {
        street_address: '123 Hollywood Blvd.',
        locality: 'Los Angeles',
        region: 'CA',
        postal_code: '90210',
        country: 'US',
      },
      phone_number: '+1 (425) 555-1212',
    });
  });

  app.post('/introspection', (req, res) => {
    res.json({
      active: true,
      token_type: 'Bearer',
      scope: 'openid profile',
      client_id: 'a9VpZDRCeFh3Nkk2VdYa',
      username: 'john.doe@example.com',
      exp: 1451606400,
      iat: 1451602800,
      sub: 'john.doe@example.com',
      aud: 'https://deptva-eval.okta.com',
      iss: 'https://deptva-eval.okta.com/oauth2/orsmsg0aWLdnF3spV0g3',
      jti: 'AT.7P4KlczBYVcWLkxduEuKeZfeiNYkZIC9uGJ28Cc-YaI',
      uid: '00uid4BxXw6I6TV4m0g3',
    });
  });

  app.post('/token', (req, res) => {
    res.json({
      "access_token": "eyJraWQiOiIyb3RWdkJvMG84dk5pT29yeWR2NVZFTkJZT0hydFQ0Y183Q1Y3R1FvQmk0IiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULl9feUFINlFsbDA4TWpobnZhcUJTZUh6d3FkRDVhRFI2UFFZcm9CSUdCUmMuV0xUcjNsQUFiUS85UHd2TnVPRlZtMDB0NWVSblpsSmsvc2NnZFkzWCtrTT0iLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9kZWZhdWx0IiwiYXVkIjoiYXBpOi8vZGVmYXVsdCIsImlhdCI6MTU2MDI5MjI4NiwiZXhwIjoxNTYwMjk1ODg2LCJjaWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsInVpZCI6IjAwdTJwOWZhcjRpaERBRVg4MnA3Iiwic2NwIjpbIm9wZW5pZCIsIm9mZmxpbmVfYWNjZXNzIiwidmV0ZXJhbl9zdGF0dXMucmVhZCIsInByb2ZpbGUiXSwic3ViIjoiY2ZhMzIyNDQ1Njk4NDFhMDkwYWQ5ZDJmMDUyNGNmMzgifQ.bIWfYbnlmbVnZ6tBRAYNhi12hTqvyRkqcXKwEvjXN_nNnUC2nujS-BBVSvVA8mMRmVyaNica1pQKTQGMxdn6QOcFIm4wlNW1ojKWPUkcChXjwSOOuZdnx1obgr1dVRSX2hOphYVEfV84LmNWQFkwm3_l8-sXD0rjZg0bKeimSZ30yiGseImBmN-PhSTQRh6sp8jqUojZ9N5b-56EbeBsOGG-cjkm8iQvGx3-C50ahO5c_PCrm00x3px3Tzey0JjONz3dkjAaqUqnxd78LJVZ_cBahTMG9eIQwJPKum0en6ZKP9ABfsk2Sdr6qoAbJKV6G7d_-pwrmMfuYC4wkSh0Ow",
      "token_type": "Bearer",
      "expires_at": 1560295886,
      "scope": "openid offline_access veteran_status.read profile",
      "refresh_token": "KzJGlaIStu5Zs4ICWZnbDj1H-AWefL0zPhIDawc7qzk",
      "id_token": "eyJraWQiOiIyb3RWdkJvMG84dk5pT29yeWR2NVZFTkJZT0hydFQ0Y183Q1Y3R1FvQmk0IiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwMHUycDlmYXI0aWhEQUVYODJwNyIsIm5hbWUiOiJTaGViYTcwMyBIYXJyaXM3ODkiLCJ2ZXIiOjEsImlzcyI6Imh0dHBzOi8vZGVwdHZhLWV2YWwub2t0YS5jb20vb2F1dGgyL2RlZmF1bHQiLCJhdWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsImlhdCI6MTU2MDI5MjI4NiwiZXhwIjoxNTYwMjk1ODg2LCJqdGkiOiJJRC52Q013Z2xmQXpKWS1zVFd4M3FkSVNrVWtQVGYyUGVpUmdyV0JiM2hXWGs0IiwiYW1yIjpbInB3ZCJdLCJpZHAiOiIwb2ExcGJubGttbFdwbzBxMjJwNyIsInByZWZlcnJlZF91c2VybmFtZSI6ImNmYTMyMjQ0NTY5ODQxYTA5MGFkOWQyZjA1MjRjZjM4IiwiYXV0aF90aW1lIjoxNTYwMjkyMjg0LCJhdF9oYXNoIjoiMkM4bXhySE5QU3VvQTBadXh2S2FfZyJ9.US3kfRZEjFkJeZ_EwxFVGRkSLCRPoi4mpQSIcKis6xVOswC8ZXkWsjISQKgWEy1hKXpKRVGnIpG8CMfOQYKOg-OhP8fOrn0DsBFfWHUc93v_dwAZSEYWJZvvYaHknbjYD5FpwRpCQt7Flv7YDLMhwLnW7b99hKgAm-NSydU1aLZT00tH5g8XwguMJj817OiVXyXj4Qd0MROJe0AFNcWxmsq3Y6hiiMSIQafHwl6VAVLi5-KLosYrXyTEo-LAiEs5L-iXZu6GwOk2LfOxNTcphMY_yQsYfZZV5Boiu5DFCBAgyjuUWF9n25pWsyqyUj1cPofOL1UsOqaqsCDadpKBbQ",
      "state": "ySHaHZLjdeiwQB6l4cT2A7RZb8OoVXsZ2EhTtwC9iwU"
    });
  });

  app.get('/authorize', (req, res) => {
    res.redirect(req.query.redirect_uri);
  });

  app.use(function(req, res, next) {
    res.status(404).send(`Upstream issuer test server did not recognize URL: ${req.url}`);
  });

  return app;
}

function upstreamOAuthTestServerBaseUrl() {
  return `http://localhost:${UPSTREAM_OAUTH_PORT}`;
}

const {
  startServerInBackground,
  stopBackgroundServer,
} = buildBackgroundServerModule('upstream OAuth test');

module.exports = {
  start: () => { startServerInBackground(buildUpstreamOAuthTestApp(), UPSTREAM_OAUTH_PORT) },
  stop: stopBackgroundServer,
  baseUrl: upstreamOAuthTestServerBaseUrl,
};
