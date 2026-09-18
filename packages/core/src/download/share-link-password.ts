import * as argon2 from "argon2";

/** §"M9": share link password is optional and separate from any account password — argon2id, same as user passwords (M1). */
export async function hashSharePassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export async function verifySharePassword(hash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(hash, plainPassword);
}
