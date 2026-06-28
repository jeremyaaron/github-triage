import { describe, expect, it } from "vitest";

import { resolveGitHubToken, type ExecFile } from "../src/github/auth.js";

describe("resolveGitHubToken", () => {
  it("uses GITHUB_TOKEN when present", async () => {
    const token = await resolveGitHubToken({
      env: { GITHUB_TOKEN: "  env-token  " },
      execFile: createExecFile(() => {
        throw new Error("gh should not be called.");
      }),
    });

    expect(token).toBe("env-token");
  });

  it("falls back to gh auth token", async () => {
    const calls: Array<{ file: string; args: readonly string[] }> = [];

    const token = await resolveGitHubToken({
      env: {},
      execFile: createExecFile((file, args, callback) => {
        calls.push({ file, args });
        callback(null, "gh-token\n", "");
      }),
    });

    expect(token).toBe("gh-token");
    expect(calls).toEqual([{ file: "gh", args: ["auth", "token"] }]);
  });

  it("fails with github.auth-missing when no token is available", async () => {
    await expect(
      resolveGitHubToken({
        env: {},
        execFile: createExecFile((_file, _args, callback) => {
          callback(new Error("not authenticated"), "", "no");
        }),
      }),
    ).rejects.toMatchObject({
      code: "github.auth-missing",
      exitCode: 1,
    });
  });
});

function createExecFile(implementation: ExecFile): ExecFile {
  return implementation;
}
