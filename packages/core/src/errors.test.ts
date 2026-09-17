import { AppError } from "./errors";

describe("M0 AppError", () => {
  it("does not leak internal details in the response body when expose=false", () => {
    const err = new AppError({
      code: "DB_CONNECTION_FAILED",
      message: "connection string postgresql://user:s3cr3t@host contains credentials",
      httpStatus: 500,
      expose: false,
    });

    const body = err.toResponseBody("req-123");

    expect(body.error.message).not.toContain("s3cr3t");
    expect(body.error.message).not.toContain("postgresql://");
    expect(body.error.code).toBe("DB_CONNECTION_FAILED");
    expect(body.error.requestId).toBe("req-123");
  });
});
