import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDurationWindow } from "../src/core/duration.js";
import { GithubTriageError } from "../src/core/errors.js";
import { reviewRepository, type IssueAnalyzer } from "../src/core/review.js";
import type { IssueRecommendation } from "../src/core/schemas.js";
import { runCli } from "../src/cli/run.js";

describe("offline review orchestration", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("builds reports from fixture input and an injected analyzer", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-review-"));
    const fixturePath = path.join(dir, "issues.json");
    const outputDir = path.join(dir, "reports");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const result = await reviewRepository({
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      since: parseDurationWindow("30d", now),
      outputDir,
      report: "all",
      issuesFile: fixturePath,
      comments: 5,
      reportId: "test",
      jsonSummary: false,
      clock: () => now,
      analyzer: createFakeAnalyzer(),
    });

    const markdownPath = path.join(outputDir, "jeremyaaron-pkg-guard-test.md");
    const jsonPath = path.join(outputDir, "jeremyaaron-pkg-guard-test.json");

    expect(result.paths.markdownPath).toBe(markdownPath);
    expect(result.paths.jsonPath).toBe(jsonPath);
    expect(result.stdout).toContain("Reviewed 1 open issues in jeremyaaron/pkg-guard");
    expect(result.stdout).toContain(markdownPath);
    await expect(readFile(markdownPath, "utf8")).resolves.toContain("Draft reply:");

    const json = JSON.parse(await readFile(jsonPath, "utf8")) as unknown;
    expect(json).toMatchObject({
      schemaVersion: 1,
      repository: { owner: "jeremyaaron", name: "pkg-guard" },
      summary: {
        issueCount: 1,
        securitySensitive: 0,
        likelyDuplicates: 0,
        needsMaintainerReply: 1,
        missingReproduction: 1,
      },
    });
  });

  it("supports JSON terminal summaries", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-review-"));
    const fixturePath = path.join(dir, "issues.json");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const result = await reviewRepository({
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      since: parseDurationWindow("30d", now),
      outputDir: path.join(dir, "reports"),
      report: "json",
      issuesFile: fixturePath,
      comments: 5,
      reportId: "json-summary",
      jsonSummary: true,
      clock: () => now,
      analyzer: createFakeAnalyzer(),
    });

    expect(JSON.parse(result.stdout)).toMatchObject({
      repository: "jeremyaaron/pkg-guard",
      issueCount: 1,
      reports: [{ format: "json" }],
    });
  });

  it("does not write report files when report output is none", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-review-"));
    const fixturePath = path.join(dir, "issues.json");
    const outputDir = path.join(dir, "reports");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const result = await reviewRepository({
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      since: parseDurationWindow("30d", now),
      outputDir,
      report: "none",
      issuesFile: fixturePath,
      comments: 5,
      reportId: "terminal-only",
      jsonSummary: false,
      clock: () => now,
      analyzer: createFakeAnalyzer(),
    });

    expect(result.paths.files).toEqual([]);
    expect(result.stdout).not.toContain("Reports:");
    await expect(readdir(outputDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("maps report write failures to report.write-failed", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-review-"));
    const fixturePath = path.join(dir, "issues.json");
    const blockedOutputPath = path.join(dir, "blocked");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");
    await writeFile(blockedOutputPath, "not a directory", "utf8");

    await expect(
      reviewRepository({
        repo: { owner: "jeremyaaron", name: "pkg-guard" },
        since: parseDurationWindow("30d", now),
        outputDir: blockedOutputPath,
        report: "all",
        issuesFile: fixturePath,
        comments: 5,
        reportId: "test",
        jsonSummary: false,
        clock: () => now,
        analyzer: createFakeAnalyzer(),
      }),
    ).rejects.toMatchObject({
      code: "report.write-failed",
      exitCode: 1,
    } satisfies Partial<GithubTriageError>);
  });

  it("runs through the CLI with --issues-file and an injected review dependency", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-cli-"));
    const fixturePath = path.join(dir, "issues.json");
    const outputDir = path.join(dir, "reports");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const args = [
      "review",
      "jeremyaaron/pkg-guard",
      "--since",
      "30d",
      "--issues-file",
      fixturePath,
      "--output-dir",
      outputDir,
      "--report",
      "all",
      "--report-id",
      "test",
    ];
    const result = await runCli(args, {
      now,
      reviewRepository: async (options) => {
        const review = await reviewRepository({
          ...options,
          clock: () => now,
          analyzer: createFakeAnalyzer(),
        });
        return { stdout: review.stdout };
      },
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("Reviewed 1 open issues in jeremyaaron/pkg-guard");
    await expect(readFile(path.join(outputDir, "jeremyaaron-pkg-guard-test.md"), "utf8")).resolves.toContain(
      "Draft reply:",
    );
    await expect(readFile(path.join(outputDir, "jeremyaaron-pkg-guard-test.json"), "utf8")).resolves.toContain(
      '"classification": "bug"',
    );
  });

  it("returns an OpenAI auth error for default fixture-mode execution without credentials", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-cli-"));
    const fixturePath = path.join(dir, "issues.json");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const result = await runCli(
      ["review", "jeremyaaron/pkg-guard", "--since", "30d", "--issues-file", fixturePath],
      { now },
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("error analysis.auth-missing");
    expect(result.stderr).toContain("Set OPENAI_API_KEY");
  });

  it("returns an auth error when GitHub source is requested without credentials", async () => {
    const result = await runCli(["review", "owner/repo", "--since", "30d"], { now });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("error github.auth-missing");
    expect(result.stderr).toContain("Set GITHUB_TOKEN or run `gh auth login`");
  });
});

function createFakeAnalyzer(): IssueAnalyzer {
  return {
    async analyzeIssue(input) {
      return createRecommendation(input.issue.number);
    },
  };
}

function createRecommendation(issueNumber: number): IssueRecommendation {
  return {
    issueNumber,
    classification: "bug",
    confidence: "high",
    signals: [],
    suggestedLabels: [
      {
        name: "bug",
        confidence: "high",
        rationale: "The issue describes broken behavior.",
        exists: true,
      },
    ],
    missingInformation: [
      {
        kind: "minimal-reproduction",
        question: "Can you share a minimal reproduction?",
      },
    ],
    relatedIssues: [],
    draftReply: {
      body: "Thanks for the report. Can you share a minimal reproduction?",
      rationale: "A reproduction is needed before maintainer action.",
    },
    security: {
      sensitive: false,
      confidence: "high",
      rationale: "No security-sensitive content is present.",
      publicReplyAllowed: true,
    },
    rationale: "The report describes a TypeScript resolution bug.",
    warnings: [],
  };
}

function createFixtureDocument(): unknown {
  return {
    schemaVersion: 1,
    repository: {
      owner: "jeremyaaron",
      name: "pkg-guard",
    },
    labels: [{ name: "bug", description: "Something is not working" }],
    issues: [
      {
        number: 12,
        title: "Exports map missing types",
        body: "The package fails TypeScript resolution.",
        author: "octocat",
        state: "open",
        labels: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        commentCount: 0,
        url: "https://github.com/jeremyaaron/pkg-guard/issues/12",
        comments: [],
      },
    ],
  };
}
