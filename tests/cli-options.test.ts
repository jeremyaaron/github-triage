import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import { parseCliArgs } from "../src/cli/options.js";

describe("parseCliArgs", () => {
  it("parses help and version commands", () => {
    expect(parseCliArgs([])).toEqual({ command: "help" });
    expect(parseCliArgs(["--help"])).toEqual({ command: "help" });
    expect(parseCliArgs(["--version"])).toEqual({ command: "version" });
  });

  it("parses an explicit review invocation", () => {
    expect(parseCliArgs(["review", "jeremyaaron/pkg-guard", "--since", "30d"])).toEqual({
      command: "review",
      args: {
        repo: {
          owner: "jeremyaaron",
          name: "pkg-guard",
        },
        since: "30d",
        jsonSummary: false,
      },
    });
  });

  it("parses an implicit review invocation", () => {
    expect(parseCliArgs(["review", "--since", "30d"])).toEqual({
      command: "review",
      args: {
        since: "30d",
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
          "--report",
          "none",
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
      ),
    ).toEqual({
      command: "review",
      args: {
        repo: {
          owner: "jeremyaaron",
          name: "pkg-guard",
        },
        since: "7d",
        outputDir: "reports",
        report: "json",
        issuesFile: "fixtures/issues.json",
        comments: 0,
        reportId: "fixture",
        captureDir: "captures",
        model: "gpt-test",
        jsonSummary: true,
      },
    });
  });

  it("accepts --report values", () => {
    for (const report of ["none", "markdown", "json", "all"]) {
      expect(parseCliArgs(["review", "owner/repo", "--since", "30d", "--report", report])).toMatchObject({
        command: "review",
        args: {
          report,
        },
      });
    }
  });

  it("rejects invalid commands", () => {
    expectCliError(() => parseCliArgs(["triage"]), "cli.invalid-command");
  });

  it("rejects invalid repo slugs", () => {
    expectCliError(() => parseCliArgs(["review", "pkg-guard", "--since", "30d"]), "cli.invalid-repo");
  });

  it("does not validate missing or invalid durations during syntactic parsing", () => {
    expect(parseCliArgs(["review", "owner/repo"])).toEqual({
      command: "review",
      args: {
        repo: {
          owner: "owner",
          name: "repo",
        },
        jsonSummary: false,
      },
    });
    expect(parseCliArgs(["review", "owner/repo", "--since", "1w"])).toMatchObject({
      command: "review",
      args: {
        since: "1w",
      },
    });
  });

  it("rejects invalid report and format values", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--report", "xml"]),
      "cli.invalid-format",
    );
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--format", "xml"]),
      "cli.invalid-format",
    );
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--format", "none"]),
      "cli.invalid-format",
    );
  });

  it("rejects invalid comments counts", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--comments", "21"]),
      "cli.invalid-comments",
    );
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--comments", "-1"]),
      "cli.invalid-comments",
    );
  });

  it("rejects invalid report ids", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since", "30d", "--report-id", "../x"]),
      "cli.invalid-report-id",
    );
  });

  it("rejects missing option values", () => {
    expectCliError(
      () => parseCliArgs(["review", "owner/repo", "--since"]),
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
