import { applyStorageDelta } from "./storage-accounting";

describe("M5 storage usage accounting", () => {
  it("adds a file's size and subtracts a removed file's size, never going below 0", () => {
    expect(applyStorageDelta(1_000_000, 500_000)).toBe(1_500_000);
    expect(applyStorageDelta(1_500_000, -500_000)).toBe(1_000_000);
    expect(applyStorageDelta(200_000, -500_000)).toBe(0);
  });
});
