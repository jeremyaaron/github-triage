import { describe, expect, it } from "vitest";

import {
  GithubTriageError,
  createUsageError,
  isGithubTriageError,
} from "../src/core/errors.js";

describe("GithubTriageError", () => {
  it("stores stable code, exit code, details, and cause", () => {
    const cause = new Error("inner");
    const error = new GithubTriageError({
      code: "github.api-failed",
      message: "GitHub request failed.",
      exitCode: 1,
      details: { status: 500 },
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("GithubTriageError");
    expect(error.code).toBe("github.api-failed");
    expect(error.exitCode).toBe(1);
    expect(error.details).toEqual({ status: 500 });
    expect(error.cause).toBe(cause);
  });

  it("creates usage errors with exit code 2", () => {
    const error = createUsageError("cli.invalid-repo", "Invalid repository.");

    expect(error.code).toBe("cli.invalid-repo");
    expect(error.exitCode).toBe(2);
  });

  it("detects typed errors", () => {
    expect(isGithubTriageError(createUsageError("cli.invalid-command", "Nope."))).toBe(true);
    expect(isGithubTriageError(new Error("Nope."))).toBe(false);
  });
});
