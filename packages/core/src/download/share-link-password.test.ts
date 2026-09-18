import { hashSharePassword, verifySharePassword } from "./share-link-password";

describe("M9 share link password", () => {
  it("hashes the password and verifies only the correct plaintext against it", async () => {
    const hash = await hashSharePassword("keo-dai-123");
    expect(hash).not.toBe("keo-dai-123");

    await expect(verifySharePassword(hash, "keo-dai-123")).resolves.toBe(true);
    await expect(verifySharePassword(hash, "wrong-password")).resolves.toBe(false);
  });
});
