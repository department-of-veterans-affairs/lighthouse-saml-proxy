import "jest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { VetsAPIClient } from "./VetsAPIClient";

const mock = new MockAdapter(axios);

const samlTraits = {
  dateOfBirth: "1990-01-01",
  firstName: "Edward",
  gender: "male",
  lastName: "Paget",
  middleName: "John",
  ssn: "333-99-8988",
  email: "user@example.com",
  uuid: "fakeuuid",
};

const samlTraitsEDIPI = {
  dateOfBirth: "1990-01-01",
  edipi: "asdfasdfasdf",
  email: "user@example.com",
  firstName: "Edward",
  gender: "male",
  lastName: "Paget",
  middleName: "John",
  ssn: "333-99-8988",
  uuid: "fakeuuid",
};

const samlTraitsICN = {
  uuid: "fakeuuid",
  email: "user@example.com",
  icn: "fakeicn",
};

const mockRespData = {
  data: {
    id: "fakeICN",
    type: "user-mvi-icn",
    attributes: {
      icn: "fakeICN",
      first_name: "Edward",
      last_name: "Paget",
    },
  },
};

const expectedHeader = {
  apiKey: "faketoken",
};

beforeEach(() => {
  mock.reset;
  jest.mock("axios", () => ({
    create: jest.fn(),
    post: jest.fn(),
    defaults: jest.fn(),
  }));

  mock
    .onPost("https://example.gov/internal/auth/v0/mvi-user")
    .reply(200, mockRespData);
});

describe("getMVITraitsForLoa3User", () => {
  it("should call the mvi-user endpoint with the Veteran's EIDPI in request body", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    const expectedBody = {
      idp_uuid: "fakeuuid",
      user_email: "user@example.com",
      dslogon_edipi: "asdfasdfasdf",
      mhv_icn: null,
      ssn: "333-99-8988",
      first_name: "Edward",
      middle_name: "John",
      last_name: "Paget",
      dob: "1990-01-01",
      gender: "male",
      level_of_assurance: "3",
    };
    mock
      .onPost(
        "https://example.gov/internal/auth/v0/mvi-user",
        expectedBody,
        expectedHeader
      )
      .reply(200, mockRespData);

    const result = await client.getMVITraitsForLoa3User(samlTraitsEDIPI);

    expect(result).toStrictEqual({
      icn: "fakeICN",
      first_name: "Edward",
      last_name: "Paget",
    });
  });

  it("should call the mvi-user endpoint with the Veteran's icn in request body", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    const expectedBody = {
      idp_uuid: samlTraitsICN.uuid,
      user_email: samlTraitsICN.email,
      mhv_icn: samlTraitsICN.icn,
      level_of_assurance: "3",
    };
    mock
      .onPost(
        "https://example.gov/internal/auth/v0/mvi-user",
        expectedBody,
        expectedHeader
      )
      .reply(200, mockRespData);
    const result = await client.getMVITraitsForLoa3User(samlTraitsICN);
    expect(result).toStrictEqual({
      icn: "fakeICN",
      first_name: "Edward",
      last_name: "Paget",
    });
  });

  it("should call the mvi-user endpoint with the Veteran's PII in request body", async () => {
    const expectedBody = {
      idp_uuid: "fakeuuid",
      user_email: "user@example.com",
      dslogon_edipi: null,
      mhv_icn: null,
      ssn: "333-99-8988",
      first_name: "Edward",
      middle_name: "John",
      last_name: "Paget",
      dob: "1990-01-01",
      gender: "male",
      level_of_assurance: "3",
    };
    mock
      .onPost(
        "https://example.gov/internal/auth/v0/mvi-user",
        expectedBody,
        expectedHeader
      )
      .reply(200, mockRespData);

    const client = new VetsAPIClient("faketoken", "https://example.gov");
    const result = await client.getMVITraitsForLoa3User(samlTraits);
    expect(result).toStrictEqual({
      icn: "fakeICN",
      first_name: "Edward",
      last_name: "Paget",
    });
  });

  it("should return the Veteran's ICN if the request is successful", async () => {
    const expectedBody = {
      idp_uuid: "fakeuuid",
      user_email: "user@example.com",
      dslogon_edipi: null,
      mhv_icn: null,
      ssn: "333-99-8988",
      first_name: "Edward",
      middle_name: "John",
      last_name: "Paget",
      dob: "1990-01-01",
      gender: "male",
      level_of_assurance: "3",
    };
    mock
      .onPost(
        "https://example.gov/internal/auth/v0/mvi-user",
        expectedBody,
        expectedHeader
      )
      .reply(200, mockRespData);

    const client = new VetsAPIClient("faketoken", "https://example.gov");
    const { icn } = await client.getMVITraitsForLoa3User(samlTraits);
    expect(icn).toEqual("fakeICN");
  });
});
