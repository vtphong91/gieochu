import { decryptSecret, encryptSecret } from "./encryption";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("M7 payment secret encryption", () => {
  it("round-trips a secret through AES-256-GCM encrypt/decrypt", () => {
    const encrypted = encryptSecret("sk_live_super_secret", KEY);
    expect(encrypted).not.toContain("sk_live_super_secret");
    expect(decryptSecret(encrypted, KEY)).toBe("sk_live_super_secret");
  });

  it("fails to decrypt when the ciphertext has been tampered with", () => {
    const encrypted = encryptSecret("sk_live_super_secret", KEY);
    const [iv, tag, ciphertext] = encrypted.split(":");
    const tamperedByte = Buffer.from(ciphertext!, "base64");
    tamperedByte[0] = (tamperedByte[0] ?? 0) ^ 0xff;
    const tampered = `${iv}:${tag}:${tamperedByte.toString("base64")}`;

    expect(() => decryptSecret(tampered, KEY)).toThrow();
  });
});
