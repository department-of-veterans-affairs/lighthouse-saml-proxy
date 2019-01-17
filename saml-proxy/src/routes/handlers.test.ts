import "jest";
import { getHashCode } from "./handlers.js"

describe("getHashCode", () => {
  it("should get hash code for a string", () => {
    expect(getHashCode("test-string")).toEqual(-1666277972);
  });
});
