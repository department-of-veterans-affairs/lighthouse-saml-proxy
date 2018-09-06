import "jest";
import { getHashCode } from "./handlers"

describe("getHashCode", () => {
  test("It should get hash code for a string", () => {
    expect(getHashCode("test-string")).toEqual(-1666277972);
  });
});
