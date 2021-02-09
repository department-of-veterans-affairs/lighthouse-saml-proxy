"use strict";

require("jest");

const { SlugHelper } = require("../slug_helper");
const config = {
  idps: [
    {
      slug: "localhost",
      id: "rewritten_localhost",
    },
    {
      slug: "lighthouse",
      id: "rewritten_lighthouse",
    },
  ],
};

describe("slug helper tests", () => {
  it("rewrite happy", async () => {
    const slugHelper = new SlugHelper(config);
    expect(slugHelper.rewrite("localhost")).toBe("rewritten_localhost");
  });

  it("rewrite with no slug mapping", async () => {
    const slugHelper = new SlugHelper(config);
    expect(slugHelper.rewrite("xxx")).toBe("xxx");
  });

  it("rewrite with no idps in config", async () => {
    const slugHelper = new SlugHelper({});
    expect(slugHelper.rewrite("xxx")).toBe("xxx");
  });
});
