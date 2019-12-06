require('jest');
const { statusCodeFromError } = require('../utils');

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
