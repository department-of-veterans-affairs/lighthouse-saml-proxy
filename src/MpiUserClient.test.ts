import "jest";
import axios from "axios";
import { MpiUserClient } from "./MpiUserClient";
jest.mock("axios", () => {
  return {
    post: jest.fn(() => Promise.resolve({})),
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
  icn: "fakeicn",
  email: "fakeemail",
};

beforeEach(() => {
  // @ts-ignore
  axios.post.mockReset();
  // @ts-ignore
  axios.post.mockImplementation(() =>
    Promise.resolve({
      data: {
        data: {
          id: "fakeICN",
          type: "user-mvi-icn",
          attributes: {
            icn: "fakeICN",
            first_name: "Edward",
            last_name: "Paget",
            id_theft_indicator: true,
          },
        },
      },
    })
  );
});

describe("getMVITraitsForLoa3User", () => {
  it("should call the mvi-user endpoint with the Veteran's EIDPI in request body", async () => {
    const client = new MpiUserClient(
      "faketoken",
      "https://example.gov/mvi-user",
      "faketoken",
      true
    );
    await client.getMpiTraitsForLoa3User(samlTraitsEDIPI);
    expect(axios.post).toHaveBeenCalledWith(
      "https://example.gov/mvi-user",
      expect.objectContaining({
        idp_uuid: samlTraitsEDIPI.uuid,
        dslogon_edipi: samlTraitsEDIPI.edipi,
        first_name: samlTraitsEDIPI.firstName,
        middle_name: samlTraitsEDIPI.middleName,
        last_name: samlTraitsEDIPI.lastName,
        dob: samlTraitsEDIPI.dateOfBirth,
        gender: "M",
      }),
      {
        headers: expect.objectContaining({
          apiKey: "faketoken",
          accesskey: "faketoken",
        }),
      }
    );
  });

  it("should call the mvi-user endpoint with the Veteran's icn in request body", async () => {
    const client = new MpiUserClient(
      "faketoken",
      "https://example.gov/mpi-user",
      "faketoken",
      true
    );
    await client.getMpiTraitsForLoa3User(samlTraitsICN);
    expect(axios.post).toHaveBeenCalledWith(
      "https://example.gov/mpi-user",
      expect.objectContaining({
        idp_uuid: samlTraitsICN.uuid,
        mhv_icn: samlTraitsICN.icn,
      }),
      {
        headers: expect.objectContaining({
          apiKey: "faketoken",
          accesskey: "faketoken",
        }),
      }
    );
  });

  it("should call the mvi-user endpoint with the Veteran's PII in request body", async () => {
    const client = new MpiUserClient(
      "faketoken",
      "https://example.gov/mpi-user",
      "faketoken",
      true
    );
    await client.getMpiTraitsForLoa3User(samlTraits);
    expect(axios.post).toHaveBeenCalledWith(
      "https://example.gov/mpi-user",
      expect.objectContaining({
        idp_uuid: samlTraits.uuid,
        ssn: samlTraits.ssn,
        first_name: samlTraits.firstName,
        middle_name: samlTraits.middleName,
        last_name: samlTraits.lastName,
        dob: samlTraits.dateOfBirth,
        gender: "M",
      }),
      {
        headers: expect.objectContaining({
          apiKey: "faketoken",
          accesskey: "faketoken",
        }),
      }
    );
  });

  it("should return the Veteran's ICN if the request is successful", async () => {
    const client = new MpiUserClient(
      "faketoken",
      "https://example.gov",
      "faketoken",
      false
    );
    const mpiTraits = await client.getMpiTraitsForLoa3User(samlTraits);
    expect(mpiTraits.icn).toEqual("fakeICN");
    expect(mpiTraits.idTheftIndicator).toEqual(false);
  });
});
