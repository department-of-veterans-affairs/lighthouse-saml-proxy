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
  email: 'user@example.com'
};

const samlTraitsEDIPI = {
  dateOfBirth: '1990-01-01',
  edipi: 'asdfasdfasdf',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
  email: 'user@example.com'
}

beforeEach(() => {
  request.get.mockReset();
  request.get.mockImplementation((_) => Promise.resolve({
    data: {
      id: 'fakeICN',
      type: "user-mvi-icn",
      attributes: {
        icn: 'fakeICN',
      }
    }
  }));
});

describe('getICNForLoa3User', () => {
  it('should call the mvi-user endpoint with the Veteran\'s EIDPI in a header', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getICNForLoa3User(samlTraitsEDIPI);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/auth/v0/mvi-user',
      json: true,
      headers: {
        apiKey: 'faketoken',
        'x-va-edipi': expect.any(String),
        'x-va-user-email': expect.any(String),
        'x-va-level-of-assurance': '3',
      },
    });
  });

  it('should call the mvi-user endpoint with the Veteran\'s PII in headers', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getICNForLoa3User(samlTraits);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/auth/v0/mvi-user',
      json: true,
      headers: expect.objectContaining({
        apiKey: 'faketoken',
        'x-va-ssn': expect.any(String),
        'x-va-first-name': expect.any(String),
        'x-va-middle-name': expect.any(String),
        'x-va-last-name': expect.any(String),
        'x-va-level-of-assurance': '3',
        'x-va-dob': expect.any(String),
        'x-va-gender': expect.any(String),
        'x-va-user-email': expect.any(String),
      }),
    });
  });

  it('should return the Veteran\'s ICN if the request is successful', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    const icn = await client.getICNForLoa3User(samlTraits);
    expect(icn).toEqual('fakeICN');
  });
});
