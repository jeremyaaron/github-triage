import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import { parseCliArgs } from "../src/cli/options.js";

describe("parseCliArgs", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("parses help and version commands", () => {
    expect(parseCliArgs([], now)).toEqual({ command: "help" });
    expect(parseCliArgs(["--help"], now)).toEqual({ command: "help" });
    expect(parseCliArgs(["--version"], now)).toEqual({ command: "version" });
  });

  it("parses a valid review invocation with defaults", () => {
    expect(parseCliArgs(["review", "jeremyaaron/pkg-guard", "--since", "30d"], now)).toEqual({
      command: "review",
      options: {
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
      },
    });
  });

  it("parses all review options", () => {
    expect(
      parseCliArgs(
        [
          "review",
          "jeremyaaron/pkg-guard",
          "--since",
          "7d",
          "--output-dir",
          "reports",
          "--format",
          "json",
          "--issues-file",
          "fixtures/issues.json",
          "--comments",
          "0",
          "--report-id",
          "fixture",
          "--capture-dir",
          "captures",
          "--model",
          "gpt-test",
          "--json",
        ],
        now,
      ),
    ).toEqual({
      command: "review",
      options: {
        repo: {
          owner: "jeremyaaron",
          name: "pkg-guard",
        },
        since: {
          input: "7d",
          days: 7,
          sinceDate: "2026-06-21T12:00:00.000Z",
        },
        outputDir: "reports",
        format: "json",
        issuesFile: "fixtures/issues.json",
        comments: 0,
        reportId: "fixture",
        captureDir: "captures",
        model: "gpt-test",
        jsonSummary: true,
      },
    });
  });

  it("rejects invalid commands", () => {
    expectCliError(() => parseCliArgs(["triage"], now), "cli.invalid-command");
  });

  it("rejects invalid repo slugs", () => {
    expectCliError(() => parseCliArgs(["review", "pkg-guard", "--since", "30d"], now), "cli.invalid-repo");
  });

  it("rejects missing and invalid durations", () => {
    expectCliError(() => parseCliArgs(["review", "owner/repo"], now), "cli.invalid-duration");
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "1w"], now),
      "cli.invalid-duration",
    );
  });

  it("rejects invalid formats", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--format", "xml"], now),
      "cli.invalid-format",
    );
  });

  it("rejects invalid comments counts", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--comments", "21"], now),
      "cli.invalid-comments",
    );
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--comments", "-1"], now),
      "cli.invalid-comments",
    );
  });

  it("rejects invalid report ids", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--report-id", "../x"], now),
      "cli.invalid-report-id",
    );
  });

  it("rejects missing option values", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since"], now),
      "cli.invalid-command",
    );
  });
});

function expectCliError(fn: () => unknown, code: string): void {
  try {
    fn();
    throw new Error("Expected CLI parsing to fail.");
  } catch (error) {
    expect(error).toBeInstanceOf(GithubTriageError);
    expect((error as GithubTriageError).code).toBe(code);
    expect((error as GithubTriageError).exitCode).toBe(2);
  }
}
