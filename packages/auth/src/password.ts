import * as argon2 from "argon2";

const MIN_LENGTH = 8;
// At least one letter and one digit, per docs §"M1" quy tắc: "mật khẩu ≥ 8 ký tự, có chữ và số".
const HAS_LETTER_AND_DIGIT = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  return argon2.verify(hash, plainPassword);
}

export function isValidPassword(plainPassword: string): boolean {
  return plainPassword.length >= MIN_LENGTH && HAS_LETTER_AND_DIGIT.test(plainPassword);
}
