"use strict";

require("jest");
const { manageHandler } = require("../oauthHandlers");
describe("Manage Endpoint Tests", () => {
  let res;
  let next;
  beforeEach(() => {
    res = {};
    res.status = jest.fn();
    res.status.mockImplementation(() => res);
    res.json = jest.fn();
    res.redirect = jest.fn();
    res.json.mockImplementation(() => res);
    next = jest.fn();
  });
  afterEach(() => {
    expect(next).toHaveBeenCalled();
  });

  it("Valid URL", async () => {
    let url = "http://example.com";
    await manageHandler(res, next, url);
    expect(res.redirect).toHaveBeenLastCalledWith(url);
  });

  it("Empty String URL", async () => {
    await manageHandler(res, next, "");
    expect(res.status).toHaveBeenLastCalledWith(404);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "NOT FOUND",
      error_description: "No manage url defined for this endpoint.",
    });
  });

  it("Null URL", async () => {
    await manageHandler(res, next, null);
    expect(res.status).toHaveBeenLastCalledWith(404);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "NOT FOUND",
      error_description: "No manage url defined for this endpoint.",
    });
  });

  it("Undefined URL", async () => {
    await manageHandler(res, next, undefined);
    expect(res.status).toHaveBeenLastCalledWith(404);
    expect(res.json).toHaveBeenLastCalledWith({
      error: "NOT FOUND",
      error_description: "No manage url defined for this endpoint.",
    });
  });
});
