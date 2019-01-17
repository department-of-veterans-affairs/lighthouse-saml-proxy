import 'jest';
import * as request from 'request-promise-native';
import { VetsAPIClient } from './VetsAPIClient';
jest.mock('request-promise-native', () => {
  return {
    get: jest.fn((_) => Promise.resovle({})),
  };
});

const samlTraits = {
  dateOfBirth: '1990-01-01',
  firstName: 'Edward',
  gender: 'male',
  lastName: 'Paget',
  middleName: 'John',
  ssn: '333-99-8988',
};

beforeEach(() => {
  request.get.mockReset();
});

describe('getICN', () => {
  it('should call the mvi-lookup endpoint with the Veteran\'s PII in headers', async () => {
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    await client.getICN(samlTraits);
    expect(request.get).toHaveBeenCalledWith({
      url: 'https://example.gov/internal/openid_auth/v0/mvi-lookup',
      json: true,
      headers: expect.objectContaining({
        apiKey: 'faketoken',
        'x-va-ssn': expect.any(String),
        'x-va-first-name': expect.any(String),
        'x-va-middle-name': expect.any(String),
        'x-va-last-name': expect.any(String),
        'x-va-dob': expect.any(String),
        'x-va-gender': expect.any(String),
      })
    });
  });

  it('should return the Veteran\'s ICN if the request is successful', async () => {
    request.get.mockImplementation((_) => Promise.resolve({
      data: {
        id: 'fakeICN',
        type: "user-mvi-icn",
        attributes: {
          icn: 'fakeICN',
        }
      }
    }));
    const client = new VetsAPIClient('faketoken', 'https://example.gov');
    const icn = await client.getICN(samlTraits);
    expect(icn).toEqual('fakeICN');
  });
});
