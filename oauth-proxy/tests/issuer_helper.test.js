"use strict";

require("jest");
const { createFakeConfig, ISSUER_METADATA } = require("./testUtils");
const { buildIssuer } = require("../issuer_helper");
const { Issuer } = require("openid-client");

describe("happy paths buildIssuer tests", () => {
  let config;

  beforeEach(() => {
    config = createFakeConfig();
    let mockDiscover = jest.fn();
    mockDiscover.mockImplementation(() => {
      return {
        metadata: ISSUER_METADATA,
      };
    });
    Issuer.discover = mockDiscover;
  });

  it("Happy Path no custom endpoints", async () => {
    let category = config.routes.categories.find(
      (category) => category.api_category == "/health/v1"
    );
    let issuer = await buildIssuer(category);
    expect(issuer.metadata.authorization_endpoint).toEqual(
      ISSUER_METADATA.authorization_endpoint
    );
    expect(issuer.metadata.token_endpoint).toEqual(
      ISSUER_METADATA.token_endpoint
    );
    expect(issuer.metadata.userinfo_endpoint).toEqual(
      ISSUER_METADATA.userinfo_endpoint
    );
    expect(issuer.metadata.introspection_endpoint).toEqual(
      ISSUER_METADATA.introspection_endpoint
    );
    expect(issuer.metadata.revocation_endpoint).toEqual(
      ISSUER_METADATA.revocation_endpoint
    );
    expect(issuer.metadata.jwks_uri).toEqual(ISSUER_METADATA.jwks_uri);
    expect(issuer.metadata.issuer).toEqual(ISSUER_METADATA.issuer);
  });

  it("Happy Path all custom endpoints", async () => {
    let category = config.routes.categories.find(
      (category) => category.api_category == "/overrideEndpoints"
    );
    let issuer = await buildIssuer(category);

    expect(issuer.metadata.authorization_endpoint).toEqual(
      category.custom_metadata.authorization_endpoint
    );
    expect(issuer.metadata.token_endpoint).toEqual(
      category.custom_metadata.token_endpoint
    );
    expect(issuer.metadata.userinfo_endpoint).toEqual(
      category.custom_metadata.userinfo_endpoint
    );
    expect(issuer.metadata.introspection_endpoint).toEqual(
      category.custom_metadata.introspection_endpoint
    );
    expect(issuer.metadata.revocation_endpoint).toEqual(
      category.custom_metadata.revocation_endpoint
    );
    expect(issuer.metadata.jwks_uri).toEqual(category.custom_metadata.jwks_uri);
    expect(issuer.metadata.issuer).toEqual(category.custom_metadata.issuer);
  });
});
