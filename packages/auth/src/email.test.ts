import { normalizeEmail } from "./email";

describe("M1 email normalization", () => {
  it("trims whitespace and lowercases the email", () => {
    expect(normalizeEmail("  Teacher.Hanh@Gmail.com  ")).toBe("teacher.hanh@gmail.com");
  });
});
