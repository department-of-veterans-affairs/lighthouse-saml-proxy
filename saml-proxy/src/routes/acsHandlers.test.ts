import 'jest';
import { Response, Request, NextFunction } from 'express';

import * as handlers from './acsHandlers';
import { VetsAPIClient } from '../VetsAPIClient';
jest.mock('../VetsAPIClient');

const client = new VetsAPIClient('fakeToken', 'https://example.gov');

// Technically Doesn't TypeCheck, but typechecking is off for test files
// Since there's no way to make it work in tests with the mix of js and ts

const claimsWithICN = {
  dateOfBirth: '1990-01-01',
  edipi: 'asdfasdfasdf',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  icn: 'asdfasdf',
  email: 'ed@example.gov',
  uuid: 'totally-uniq',
};

const claimsWithEDIPI = {
  dateOfBirth: '1990-01-01',
  edipi: 'asdfasdfasdf',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  email: 'ed@example.gov',
  uuid: 'totally-uniq',
}

const claimsWithNoEDIPI = {
  dateOfBirth: '1990-01-01',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  email: 'ed@example.gov',
  uuid: 'totally-uniq',
}

describe('scrubUserClaims', () => {
  it('should return a user claims object with only permitted keys', () => {
    const req = { user: { claims: { ...claimsWithICN } }};
    const nextFn = jest.fn();
    handlers.scrubUserClaims(req, {}, nextFn);
    expect(req.user.claims).toEqual(expect.objectContaining({
      firstName: expect.any(String),
      lastName: expect.any(String),
      email: expect.any(String),
      middleName: expect.any(String),
    }));
    expect(req.user.claims).toEqual(expect.not.objectContaining({
      ssn: expect.any(String),
      gender: expect.any(String),
      dateOfBirth: expect.any(String),
    }));
  });
})

describe('loadICN', () => {
  beforeEach(() => {
    client.getICN.mockReset();
  });

  it('should call next and not make any vetsAPIClient calls when ICN Exists', async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: {...claimsWithICN }
      }
    };
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getICN).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
  });

  it('should load ICN and assign it as a user claim when edipi exists and no icn', async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: {...claimsWithEDIPI }
      }
    };

    req.vetsAPIClient.getICN.mockResolvedValueOnce('anICN');
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getICN).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual('anICN');
  });

  it('should load ICN and assign it as a user claim when traits exist and no icn', async () => {
    const nextFn = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: {...claimsWithNoEDIPI }
      }
    };
    req.vetsAPIClient.getICN.mockResolvedValueOnce('anICN');
    await handlers.loadICN(req, {}, nextFn);
    expect(req.vetsAPIClient.getICN).toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalled();
    expect(req.user.claims.icn).toEqual('anICN');
  });

  it('should render error page when getICN errors', async () => {
    const nextFn = jest.fn();
    const render = jest.fn();
    const req = {
      vetsAPIClient: client,
      user: {
        claims: {...claimsWithNoEDIPI }
      }
    };
    const err = new Error('Oops')
    err.name = 'StatusCodeError';
    err.statusCode = '404';
    req.vetsAPIClient.getICN.mockRejectedValueOnce(err);
    await handlers.loadICN(req, { render }, nextFn);
    expect(render).toHaveBeenCalled();
  });
});
