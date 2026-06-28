import { describe, expect, it } from "vitest";

import { parseDurationWindow } from "../src/core/duration.js";
import { GithubTriageError } from "../src/core/errors.js";

describe("parseDurationWindow", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("parses day-based durations", () => {
    expect(parseDurationWindow("30d", now)).toEqual({
      input: "30d",
      days: 30,
      sinceDate: "2026-05-29T12:00:00.000Z",
    });
  });

  it("rejects unsupported duration formats", () => {
    expect(() => parseDurationWindow("1w", now)).toThrow(GithubTriageError);
    expect(() => parseDurationWindow("2026-06-01", now)).toThrow(GithubTriageError);
    expect(() => parseDurationWindow("0d", now)).toThrow(GithubTriageError);
  });

  it("uses stable CLI error metadata for invalid durations", () => {
    try {
      parseDurationWindow("forever", now);
      throw new Error("Expected parseDurationWindow to throw.");
    } catch (error) {
      expect(error).toBeInstanceOf(GithubTriageError);
      expect((error as GithubTriageError).code).toBe("cli.invalid-duration");
      expect((error as GithubTriageError).exitCode).toBe(2);
    }
  });
});
