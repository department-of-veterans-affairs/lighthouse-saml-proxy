// Returns an object suitable for the response body of an OAuth 2.0 token
// response. The input is a TokenSet object from the openid-client library. See
// documentation here:
// https://github.com/panva/node-openid-client/blob/master/docs/README.md#tokenset
//
// The returned object will always have these keys:
//   * access_token
//   * expires_in
//   * refresh_token
//   * scope
// If the token set is for an OIDC request it will also have:
//   * id_token
const translateTokenSet = (token_set) => {
  // Example successful response from RFC 6749
  // {
  //   "access_token":"2YotnFZFEjr1zCsicMWpAA",
  //   "token_type":"example",
  //   "expires_in":3600,
  //   "refresh_token":"tGzv3JOkF0XG5Qx2TlKWIA",
  //   "example_parameter":"example_value"
  // }

  // Example successful response from OpenID Connect Core 1.0
  // {
  //  "access_token": "SlAV32hkKG",
  //  "token_type": "Bearer",
  //  "refresh_token": "8xLOxBtZp8",
  //  "expires_in": 3600,
  //  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOWdkazcifQ.ewogImlzc
  //    yI6ICJodHRwOi8vc2VydmVyLmV4YW1wbGUuY29tIiwKICJzdWIiOiAiMjQ4Mjg5
  //    NzYxMDAxIiwKICJhdWQiOiAiczZCaGRSa3F0MyIsCiAibm9uY2UiOiAibi0wUzZ
  //    fV3pBMk1qIiwKICJleHAiOiAxMzExMjgxOTcwLAogImlhdCI6IDEzMTEyODA5Nz
  //    AKfQ.ggW8hZ1EuVLuxNuuIJKX_V8a_OMXzR0EHR9R6jgdqrOOF4daGU96Sr_P6q
  //    Jp6IcmD3HP99Obi1PRs-cwh3LO-p146waJ8IhehcwL7F09JdijmBqkvPeB2T9CJ
  //    NqeGpe-gccMg4vfKjkM8FcGvnzZUN4_KSP0aAp1tOJ1zZwgjxqGByKHiOtX7Tpd
  //    QyHE5lcMiKPXfEIQILVq0pc_E2DzL7emopWoaoZTF_m0_N0YzFC6g6EJbOEoRoS
  //    K5hoDalrcvRYLSrQAZZKflyuVCyixEoV9GfNQC3_osjzw2PAithfubEEBLuVVk4
  //    XUVrWOLrLl0nx7RkKU8NXNHq-rvKMzqg"
  // }

  const responseAccum = {};
  const copy_field = (field) => {
    if (token_set[field] != null) {
      responseAccum[field] = token_set[field];
    }
  };

  // We need to copy these fields individually in order to control the shape of
  // the returned object. The `TokenSet.expires_in` field is a property, which
  // translates from an absolute timestamp field named `expires_at`. If we
  // simply serialized the `TokenSet` object then the response would contain
  // the internal fields liked `expires_at`.
  copy_field("access_token");
  copy_field("id_token");
  copy_field("refresh_token");
  copy_field("token_type");
  copy_field("scope");
  copy_field("expires_in");

  return responseAccum;
};

module.exports = {
  translateTokenSet: translateTokenSet,
};
