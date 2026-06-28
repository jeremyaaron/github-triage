import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import type { ReviewCliOptions } from "../src/cli/options.js";
import { runCli } from "../src/cli/run.js";

describe("runCli", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("renders help", async () => {
    const result = await runCli(["--help"], { now });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("github-triage 0.1.0");
    expect(result.stdout).toContain("github-triage review <owner>/<repo> --since <duration>");
  });

  it("renders version", async () => {
    await expect(runCli(["--version"], { now })).resolves.toEqual({
      exitCode: 0,
      stdout: "0.1.0\n",
      stderr: "",
    });
  });

  it("calls injected reviewRepository with parsed options", async () => {
    let received: ReviewCliOptions | undefined;

    const result = await runCli(["review", "jeremyaaron/pkg-guard", "--since", "30d"], {
      now,
      reviewRepository: async (options) => {
        received = options;
        return { stdout: "review output\n" };
      },
    });

    expect(result).toEqual({
      exitCode: 0,
      stdout: "review output\n",
      stderr: "",
    });
    expect(received).toEqual({
      repo: {
        owner: "jeremyaaron",
        name: "pkg-guard",
      },
      since: {
        input: "30d",
        days: 30,
        sinceDate: "2026-05-29T12:00:00.000Z",
      },
      outputDir: ".github-triage/reports",
      format: "all",
      comments: 5,
      jsonSummary: false,
    });
  });

  it("passes --json through to reviewRepository", async () => {
    let received: ReviewCliOptions | undefined;

    const result = await runCli(["review", "owner/repo", "--since", "7d", "--json"], {
      now,
      reviewRepository: async (options) => {
        received = options;
        return { stdout: '{"ok":true}\n' };
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('{"ok":true}\n');
    expect(received?.jsonSummary).toBe(true);
  });

  it("maps usage errors to exit code 2", async () => {
    const result = await runCli(["review", "owner/repo", "--since", "30d", "--format", "xml"], {
      now,
    });

    expect(result.exitCode).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("error cli.invalid-format");
  });

  it("maps operational review errors to exit code 1", async () => {
    const result = await runCli(["review", "owner/repo", "--since", "30d"], {
      now,
      reviewRepository: async () => {
        throw new GithubTriageError({
          code: "github.api-failed",
          message: "GitHub failed.",
          exitCode: 1,
        });
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("error github.api-failed\n  GitHub failed.\n");
  });

  it("returns an auth error for GitHub source without credentials", async () => {
    const result = await runCli(["review", "owner/repo", "--since", "30d"], { now });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("error github.auth-missing");
    expect(result.stderr).toContain("Set GITHUB_TOKEN or run `gh auth login`");
  });
});
