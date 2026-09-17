import { Writable } from "node:stream";
import { createLogger } from "./logger";

function captureStream() {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return { chunks, stream };
}

describe("M0 logger", () => {
  it("redacts sensitive fields (password, token, secret, authorization, cookie)", () => {
    const { chunks, stream } = captureStream();
    const testLogger = createLogger({ level: "info" }, stream);

    testLogger.info(
      {
        password: "hunter2",
        token: "abc123token",
        secret: "topsecret",
        authorization: "Bearer abc.def.ghi",
        cookie: "session=xyz",
      },
      "sensitive log line",
    );

    const output = chunks.join("");
    expect(output).not.toContain("hunter2");
    expect(output).not.toContain("abc123token");
    expect(output).not.toContain("topsecret");
    expect(output).not.toContain("Bearer abc.def.ghi");
    expect(output).not.toContain("session=xyz");
    expect(output).toContain("[REDACTED]");
  });
});
