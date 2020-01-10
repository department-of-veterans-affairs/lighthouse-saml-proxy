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
      scope: 'openid offline_access veteran_status.read profile launch/patient',
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
      "access_token": "eyJraWQiOiJDcnNSZDNpYnhIMUswSl9WYWd0TnlHaER2cFlRN0hLdVd6NFFibk5IQmlBIiwiYWxnIjoiUlMyNTYifQ.eyJ2ZXIiOjEsImp0aSI6IkFULk41Qlg4d3RXN01jSlp4ZDlqX0FfLVozVFA1LWI5Mk5fZ3E1MXRMY2w1VXcuUUFjTlo1d3JpL1ZhMUx4UGZ4b2ZjU3RvbkpKMnM0b0d0SzI5RDZFdGpsRT0iLCJpc3MiOiJodHRwczovL2RlcHR2YS1ldmFsLm9rdGEuY29tL29hdXRoMi9kZWZhdWx0IiwiYXVkIjoiYXBpOi8vZGVmYXVsdCIsImlhdCI6MTU3ODU4NTQ1MSwiZXhwIjoxNTc4NTg5MDUxLCJjaWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsInVpZCI6IjAwdTJwOWZhcjRpaERBRVg4MnA3Iiwic2NwIjpbIm9mZmxpbmVfYWNjZXNzIiwicGF0aWVudC9QYXRpZW50LnJlYWQiLCJsYXVuY2gvcGF0aWVudCIsInZldGVyYW5fc3RhdHVzLnJlYWQiLCJvcGVuaWQiLCJwcm9maWxlIl0sInN1YiI6ImNmYTMyMjQ0NTY5ODQxYTA5MGFkOWQyZjA1MjRjZjM4In0.NN8kTau8BKOycr_8BQKvV9_BnNgXjC1LkP2f85lTKcz8n1soAXqcfDJpDpndt7ihGgdd7AbDQIwaQwW6j9NPg9wr98G7kPfaFNIqJTsjj1FvHw9kwIK74l1CB0nQoRs-Yl-g26c6Z9fvOkSsTbFzGwFoTLp3dox6-vt18C5ql8vfPyNyooIZ9C1V2myEtYgoKpWHH1mx_Sx1ySRInuIOsoUYFJmRw87BMbb9F3n_IF377hJNy9tVNJFS78O9ZvnFWzUOQsx5qCtMGRkHEQFRQsK4Zo8Nd-Gc1_rjVwklfDeQlNd2uPEklGkbxCEZd2rIuWU4fIPPkENN6TKrVUtzjg",
      "token_type": "Bearer",
      "expires_at": 1560295886,
      "scope": "offline_access openid patient/Patient.read launch/patient veteran_status.read profile",
      "refresh_token": "LNrJMS-UHzlaNe3FTqYra48t4NpeLlWxrMovngqPoKY",
      "id_token": "eyJraWQiOiJDcnNSZDNpYnhIMUswSl9WYWd0TnlHaER2cFlRN0hLdVd6NFFibk5IQmlBIiwiYWxnIjoiUlMyNTYifQ.eyJzdWIiOiIwMHUycDlmYXI0aWhEQUVYODJwNyIsIm5hbWUiOiJTaGViYTcwMyBIYXJyaXM3ODkiLCJ2ZXIiOjEsImlzcyI6Imh0dHBzOi8vZGVwdHZhLWV2YWwub2t0YS5jb20vb2F1dGgyL2RlZmF1bHQiLCJhdWQiOiIwb2EzNXJsYjhwdEh1bGVGZjJwNyIsImlhdCI6MTU3ODU4NTQ1MSwiZXhwIjoxNTc4NTg5MDUxLCJqdGkiOiJJRC4wLXZ5blUzMy1UbWEza0lsa1dwWTRGODNYdjFVekJXcHltT2RuS2tjT193IiwiYW1yIjpbInB3ZCJdLCJpZHAiOiIwb2ExcGJubGttbFdwbzBxMjJwNyIsInByZWZlcnJlZF91c2VybmFtZSI6ImNmYTMyMjQ0NTY5ODQxYTA5MGFkOWQyZjA1MjRjZjM4IiwiYXV0aF90aW1lIjoxNTc4NTg1NDUxLCJhdF9oYXNoIjoiVnVfNXhkZkVmN1BoT1VfNllJSENFQSJ9.EXRka3_Xyk49D01rP-Di0OB0GFIA0GxXrkHm-HyiEJIZHiWOkXji985VaJyXktQtzAnGtRRpbfqJ1zWc-1lY0rfh_KIgLe8dklnqUSL0OrzBQSIQK-X9a0iIS8eLo_xDH2vCDtmKtXUb1ZTcYkwupwW4ITNpb8vXBh0VR8Bk5myAaTe2ROSggGgHqf2koBEhEGWu7ASgzL5l74PXXFhCamC1uespkHixKUThctG86GSdMGRU9f0fS0wtmpQ595J2bUVG0mhRD7akExgC1L7k8AHWcudXkumkri0uDBr8vo4iFsLVGSKoOv1ZVfvEykcQUqOAhhRzTOQ7iM-p0_-nMw",
      "state": "SXf66LG3ebuqD804HYX4GjLhfCJ5T8MtbuxsJ_Iwy9Q"
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
