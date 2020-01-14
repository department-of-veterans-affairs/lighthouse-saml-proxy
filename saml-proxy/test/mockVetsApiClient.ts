import { SAMLUser } from '../src/VetsAPIClient';

export default class MockVetsApiClient {
  public async getMVITraitsForLoa3User(user: SAMLUser) : Promise<{ icn: string, first_name: string, last_name: string }> {
    if(user.firstName == 'mvi') {
      return {
        icn: '123',
        first_name: user.firstName,
        last_name: user.lastName
      };
    }

    throw new Error('Not found');
  }

  public async getVSOSearch(firstName: string, lastName: string) : Promise<{poa: string}> {
    if(firstName == 'vso') {
      return {
        poa: 'poa'
      };
    }

    throw new Error('Not found');
  }
}
