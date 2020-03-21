require('jest');
const { statusCodeFromError, parseBasicAuth } = require('../utils');

describe('statusCodeFromError', () => {
  describe('returns the default', () => {
    it('if response is undefined', () => {
      expect(statusCodeFromError({})).toEqual(500);
    });

    it('if response.statusCode is undefined', () => {
      expect(statusCodeFromError({response: {}})).toEqual(500);
    });
  });

  it('returns the value in response.statusCode if defined', () => {
    expect(statusCodeFromError({response: {statusCode: 404}})).toEqual(404);
  });
});

describe('parseBasicAuth', () => {
  describe('undefined', () => {
    it('missing request returns undefined', () => {
      expect(parseBasicAuth()).toEqual(undefined);
    });

    it('invalid request type returns undefined', () => {
      expect(parseBasicAuth("request")).toEqual(undefined);
    });

    it('empty request returns undefined', () => {
      expect(parseBasicAuth({})).toEqual(undefined);
    });

    it('invalid headers type returns undefined', () => {
      expect(parseBasicAuth({headers: "headers"})).toEqual(undefined);
    });

    it('empty headers returns undefined', () => {
      expect(parseBasicAuth({headers: {}})).toEqual(undefined);
    });

    it('invalid authorization type returns undefined', () => {
      expect(parseBasicAuth({headers: {authorization: {}}})).toEqual(undefined);
    });

    it('invalid authorization returns undefined', () => {
      expect(parseBasicAuth({headers: {authorization: "Basic "}})).toEqual(undefined);
    });

    it('invalid username password returns undefined', () => {
      let usernamePassword = Buffer.from('user1').toString('base64');
      expect(parseBasicAuth({headers: {authorization: `Basic ${usernamePassword}`}})).toEqual(undefined);
    });
  });

  it('valid username password returns undefined', () => {
    let usernamePassword = Buffer.from('user1:pass1').toString('base64');
    let credentials = parseBasicAuth({headers: {authorization: `Basic ${usernamePassword}`}});
    expect(credentials.username).toEqual("user1");
    expect(credentials.password).toEqual("pass1");
  });
});
