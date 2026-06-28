import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseDurationWindow } from "../src/core/duration.js";
import { reviewRepository, type IssueAnalyzer } from "../src/core/review.js";
import type { IssueRecommendation } from "../src/core/schemas.js";
import type { GitHubClient, GitHubIssueItem } from "../src/github/types.js";

describe("GitHub review source", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("uses a GitHub client when no fixture file is provided", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-github-"));
    const client = createFakeGitHubClient();

    const result = await reviewRepository({
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      since: parseDurationWindow("30d", now),
      outputDir: path.join(dir, "reports"),
      format: "json",
      comments: 0,
      reportId: "github",
      jsonSummary: false,
      clock: () => now,
      analyzer: createFakeAnalyzer(),
      githubClient: client,
    });

    expect(result.report.source).toEqual({
      kind: "github",
      issueCount: 1,
      labelCount: 1,
      commentsPerIssue: 0,
    });

    const json = JSON.parse(
      await readFile(path.join(dir, "reports", "jeremyaaron-pkg-guard-github.json"), "utf8"),
    ) as unknown;
    expect(json).toMatchObject({
      source: { kind: "github" },
      issues: [{ source: { number: 12 }, recommendation: { classification: "bug" } }],
    });
  });
});

function createFakeGitHubClient(): GitHubClient {
  return {
    async listOpenIssues() {
      return [
        {
          number: 12,
          title: "Exports map missing types",
          body: "The package fails TypeScript resolution.",
          user: { login: "octocat" },
          state: "open",
          labels: [{ name: "bug", color: "ff0000", description: "Something is not working" }],
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
          comments: 0,
          html_url: "https://github.com/jeremyaaron/pkg-guard/issues/12",
        } satisfies GitHubIssueItem,
      ];
    },
    async listLabels() {
      return [{ name: "bug", color: "ff0000", description: "Something is not working" }];
    },
    async listIssueComments() {
      throw new Error("comments should not be requested");
    },
  };
}

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
    suggestedLabels: [],
    missingInformation: [],
    relatedIssues: [],
    draftReply: null,
    security: {
      sensitive: false,
      confidence: "high",
      rationale: "No security-sensitive content is present.",
      publicReplyAllowed: true,
    },
    rationale: "The report describes a bug.",
    warnings: [],
  };
}
