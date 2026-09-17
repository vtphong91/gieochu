import { hashPassword, isValidPassword, verifyPassword } from "./password";

describe("M1 password", () => {
  it("hashes a password and verifies the correct plaintext against it", async () => {
    const hash = await hashPassword("Str0ngPass!");
    expect(hash).not.toBe("Str0ngPass!");
    await expect(verifyPassword(hash, "Str0ngPass!")).resolves.toBe(true);
  });

  it("fails verification with the wrong password", async () => {
    const hash = await hashPassword("Str0ngPass!");
    await expect(verifyPassword(hash, "WrongPass1")).resolves.toBe(false);
  });

  it("enforces the password policy (>= 8 chars, at least one letter and one digit)", () => {
    expect(isValidPassword("Str0ngPass")).toBe(true);
    expect(isValidPassword("short1")).toBe(false); // too short
    expect(isValidPassword("alllettersnodigits")).toBe(false); // no digit
    expect(isValidPassword("12345678")).toBe(false); // no letter
  });
});
