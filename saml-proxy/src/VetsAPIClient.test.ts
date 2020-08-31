import "jest";
import * as request from "request-promise-native";
import { VetsAPIClient } from "./VetsAPIClient";
jest.mock("request-promise-native", () => {
  return {
    post: jest.fn((_) => Promise.resolve({})),
  };
});

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

beforeEach(() => {
  request.post.mockReset();
  request.post.mockImplementation((_) =>
    Promise.resolve({
      data: {
        id: "fakeICN",
        type: "user-mvi-icn",
        attributes: {
          icn: "fakeICN",
          first_name: "Edward",
          last_name: "Paget",
        },
      },
    })
  );
});

describe("getMVITraitsForLoa3User", () => {
  it("should call the mvi-user endpoint with the Veteran's EIDPI in request body", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    await client.getMVITraitsForLoa3User(samlTraitsEDIPI);
    expect(request.post).toHaveBeenCalledWith({
      url: "https://example.gov/internal/auth/v0/mvi-user",
      json: true,
      headers: expect.objectContaining({
        apiKey: "faketoken",
      }),
      body: expect.objectContaining({
        idp_uuid: samlTraitsEDIPI.uuid,
        user_email: samlTraitsEDIPI.email,
        dslogon_edipi: samlTraitsEDIPI.edipi,
        first_name: samlTraitsEDIPI.firstName,
        middle_name: samlTraitsEDIPI.middleName,
        last_name: samlTraitsEDIPI.lastName,
        dob: samlTraitsEDIPI.dateOfBirth,
        gender: samlTraitsEDIPI.gender,
        level_of_assurance: "3",
      }),
    });
  });

  it("should call the mvi-user endpoint with the Veteran's icn in request body", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    await client.getMVITraitsForLoa3User(samlTraitsICN);
    expect(request.post).toHaveBeenCalledWith({
      url: "https://example.gov/internal/auth/v0/mvi-user",
      json: true,
      headers: expect.objectContaining({
        apiKey: "faketoken",
      }),
      body: expect.objectContaining({
        idp_uuid: samlTraitsICN.uuid,
        user_email: samlTraitsICN.email,
        mhv_icn: samlTraitsICN.icn,
        level_of_assurance: "3",
      }),
    });
  });

  it("should call the mvi-user endpoint with the Veteran's PII in request body", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    await client.getMVITraitsForLoa3User(samlTraits);
    expect(request.post).toHaveBeenCalledWith({
      url: "https://example.gov/internal/auth/v0/mvi-user",
      json: true,
      headers: expect.objectContaining({
        apiKey: "faketoken",
      }),
      body: expect.objectContaining({
        idp_uuid: samlTraits.uuid,
        user_email: samlTraits.email,
        ssn: samlTraits.ssn,
        first_name: samlTraits.firstName,
        middle_name: samlTraits.middleName,
        last_name: samlTraits.lastName,
        dob: samlTraits.dateOfBirth,
        gender: samlTraits.gender,
        level_of_assurance: "3",
      }),
    });
  });

  it("should return the Veteran's ICN if the request is successful", async () => {
    const client = new VetsAPIClient("faketoken", "https://example.gov");
    const { icn } = await client.getMVITraitsForLoa3User(samlTraits);
    expect(icn).toEqual("fakeICN");
  });
});
