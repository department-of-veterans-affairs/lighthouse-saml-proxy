import 'jest';
import * as request from 'request-promise-native';
import { VetsAPIClient } from './VetsAPIClient';
jest.mock('request-promise-native', () => {
  return {
    get: jest.fn((_) => Promise.resolve({})),
  };
});

const samlTraits = {
  dateOfBirth: '1990-01-01',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  email: 'user@example.com',
  uuid: 'fakeuuid',
};

const samlTraitsEDIPI = {
  dateOfBirth: '1990-01-01',
  edipi: 'asdfasdfasdf',
  email: 'user@example.com',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  uuid: 'fakeuuid',
};

const samlTraitsICN = {
  uuid: 'fakeuuid',
  email: 'user@example.com',
  icn: 'fakeicn',
};

beforeEach(() => {
  request.get.mockReset();
  request.get.mockImplementation((_) => Promise.resolve({
    data: {
      id: 'fakeICN',
      type: "user-mvi-icn",
      attributes: {
        icn: 'fakeICN',
        first_name: 'Edward',
        last_name: 'Paget',
      }
    }
  }));
});

describe('getMVITraitsForLoa3User', () => {
  it('should call the mvi-user endpoint with the Veteran\'s EIDPI in a header', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getMVITraitsForLoa3User(samlTraitsEDIPI);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/auth/v0/mvi-user',
      json: true,
      headers: expect.objectContaining({
        apiKey: 'faketoken',
        'x-va-idp-uuid': expect.any(String),
        'x-va-user-email': expect.any(String),
        'x-va-dslogon-edipi': expect.any(String),
        'x-va-first-name': expect.any(String),
        'x-va-middle-name': expect.any(String),
        'x-va-last-name': expect.any(String),
        'x-va-dob': expect.any(String),
        'x-va-gender': expect.any(String),
        'x-va-level-of-assurance': '3',
      }),
    });
  });

  it('should call the mvi-user endpoint with the Veteran\'s icn in headers', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getMVITraitsForLoa3User(samlTraitsICN);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/auth/v0/mvi-user',
      json: true,
      headers: expect.objectContaining({
        apiKey: 'faketoken',
        'x-va-idp-uuid': expect.any(String),
        'x-va-user-email': expect.any(String),
        'x-va-mhv-icn': expect.any(String),
        'x-va-level-of-assurance': '3',
      }),
    });
  });

  it('should call the mvi-user endpoint with the Veteran\'s PII in headers', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getMVITraitsForLoa3User(samlTraits);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/auth/v0/mvi-user',
      json: true,
      headers: expect.objectContaining({
        apiKey: 'faketoken',
        'x-va-idp-uuid': expect.any(String),
        'x-va-user-email': expect.any(String),
        'x-va-ssn': expect.any(String),
        'x-va-first-name': expect.any(String),
        'x-va-middle-name': expect.any(String),
        'x-va-last-name': expect.any(String),
        'x-va-dob': expect.any(String),
        'x-va-gender': expect.any(String),
        'x-va-level-of-assurance': '3',
      }),
    });
  });

  it('should return the Veteran\'s ICN if the request is successful', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    const { icn } = await client.getMVITraitsForLoa3User(samlTraits);
    expect(icn).toEqual('fakeICN');
  });
});
