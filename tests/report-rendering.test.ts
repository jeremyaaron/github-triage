import { describe, expect, it } from "vitest";

import type { ReviewReport } from "../src/core/schemas.js";
import { renderJsonReport } from "../src/reports/json.js";
import { renderMarkdownReport } from "../src/reports/markdown.js";
import { planReportPaths } from "../src/reports/paths.js";
import { renderTerminalJsonSummary, renderTerminalSummary } from "../src/reports/terminal.js";

const report: ReviewReport = {
  schemaVersion: 1,
  repository: {
    owner: "jeremyaaron",
    name: "pkg-guard",
  },
  generatedAt: "2026-06-28T15:30:05.000Z",
  reviewWindow: {
    since: "30d",
    sinceDate: "2026-05-29T15:30:05.000Z",
  },
  source: {
    kind: "fixture",
    issueCount: 2,
    labelCount: 2,
    commentsPerIssue: 5,
  },
  summary: {
    issueCount: 2,
    securitySensitive: 1,
    likelyDuplicates: 1,
    needsMaintainerReply: 1,
    missingReproduction: 1,
  },
  issues: [
    {
      source: {
        number: 12,
        title: "Exports map missing types",
        body: "The package fails TypeScript resolution.",
        author: "octocat",
        state: "open",
        labels: [{ name: "bug", description: "Something is not working" }],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        commentCount: 0,
        url: "https://github.com/jeremyaaron/pkg-guard/issues/12",
        comments: [],
      },
      recommendation: {
        issueNumber: 12,
        classification: "bug",
        confidence: "high",
        signals: [
          {
            kind: "typescript-resolution-failure",
            confidence: "high",
            rationale: "The issue describes a consumer import failure.",
          },
        ],
        suggestedLabels: [
          {
            name: "bug",
            confidence: "high",
            rationale: "The current behavior appears broken.",
            exists: true,
          },
        ],
        missingInformation: [
          {
            kind: "minimal-reproduction",
            question: "Can you share a minimal reproduction?",
          },
        ],
        relatedIssues: [
          {
            issueNumber: 7,
            title: "Types not found through exports",
            url: "https://github.com/jeremyaaron/pkg-guard/issues/7",
            relationship: "likely-duplicate",
            confidence: "medium",
            rationale: "Both issues mention type resolution through exports.",
          },
        ],
        draftReply: {
          body: "Thanks for the report. Can you share a minimal reproduction?",
          rationale: "The maintainer needs a reproduction before investigating.",
        },
        security: {
          sensitive: false,
          confidence: "high",
          rationale: "The report does not describe a vulnerability or secret exposure.",
          publicReplyAllowed: true,
        },
        rationale: "The issue has enough detail to classify as a bug.",
        warnings: [],
      },
    },
    {
      source: {
        number: 13,
        title: "Possible token exposure",
        body: "I found a token in logs.",
        author: "security-reporter",
        state: "open",
        labels: [],
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
        commentCount: 0,
        url: "https://github.com/jeremyaaron/pkg-guard/issues/13",
        comments: [],
      },
      recommendation: {
        issueNumber: 13,
        classification: "security",
        confidence: "medium",
        signals: [],
        suggestedLabels: [
          {
            name: "security",
            confidence: "medium",
            rationale: "The issue mentions token exposure.",
            exists: false,
          },
        ],
        missingInformation: [],
        relatedIssues: [],
        draftReply: null,
        security: {
          sensitive: true,
          confidence: "medium",
          rationale: "The report may contain secret material.",
          publicReplyAllowed: false,
        },
        rationale: "The issue should be handled carefully.",
        warnings: [
          {
            code: "analysis.fallback",
            message: "Model output was incomplete.",
          },
        ],
      },
    },
  ],
  warnings: [
    {
      code: "fixture.warning",
      message: "Fixture mode was used.",
    },
  ],
};

describe("JSON report rendering", () => {
  it("renders deterministic pretty JSON with a trailing newline", () => {
    const rendered = renderJsonReport(report);

    expect(rendered).toMatch(/^\{\n {2}"schemaVersion": 1,/);
    expect(rendered.endsWith("\n")).toBe(true);
    expect(JSON.parse(rendered)).toEqual(report);
  });
});

describe("Markdown report rendering", () => {
  it("renders required sections and per-issue recommendations", () => {
    const rendered = renderMarkdownReport(report);

    expect(rendered).toContain("# GitHub Triage Report: jeremyaaron/pkg-guard");
    expect(rendered).toContain("## Summary");
    expect(rendered).toContain("## Security-Sensitive Issues");
    expect(rendered).toContain("## Needs Maintainer Response");
    expect(rendered).toContain("## Possible Duplicates And Related Issues");
    expect(rendered).toContain("## Issue Recommendations");
    expect(rendered).toContain("## Warnings");
    expect(rendered).toContain("### #12 [Exports map missing types]");
    expect(rendered).toContain("Suggested labels: `bug` (high, existing)");
    expect(rendered).toContain("Draft reply:");
    expect(rendered).toContain("```markdown");
    expect(rendered).toContain("- #13 [Possible token exposure]");
  });

  it("uses suggestion wording and does not imply GitHub was changed", () => {
    const rendered = renderMarkdownReport(report).toLowerCase();

    expect(rendered).toContain("suggested labels");
    expect(rendered).toContain("draft reply");
    expect(rendered).not.toContain("applied label");
    expect(rendered).not.toContain("posted comment");
    expect(rendered).not.toContain("closed issue");
  });
});

describe("terminal summary rendering", () => {
  const paths = planReportPaths({
    repo: report.repository,
    format: "all",
    reportId: "fixture",
  });

  it("renders concise human terminal output", () => {
    expect(renderTerminalSummary(report, paths)).toBe(`Reviewed 2 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 1
Needs maintainer reply: 1
Missing reproduction: 1

Reports:
  .github-triage/reports/jeremyaaron-pkg-guard-fixture.md
  .github-triage/reports/jeremyaaron-pkg-guard-fixture.json
`);
  });

  it("renders compact JSON terminal output", () => {
    const rendered = renderTerminalJsonSummary(report, paths);

    expect(JSON.parse(rendered)).toEqual({
      repository: "jeremyaaron/pkg-guard",
      issueCount: 2,
      securitySensitive: 1,
      likelyDuplicates: 1,
      needsMaintainerReply: 1,
      missingReproduction: 1,
      reports: [
        {
          format: "markdown",
          path: ".github-triage/reports/jeremyaaron-pkg-guard-fixture.md",
        },
        {
          format: "json",
          path: ".github-triage/reports/jeremyaaron-pkg-guard-fixture.json",
        },
      ],
    });
  });
});
