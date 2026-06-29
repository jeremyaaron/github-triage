import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { validateToolCalls } from "tool-call-contract";
import { describe, expect, it } from "vitest";

import { composeIssueRecommendation } from "../src/analysis/recommendations.js";
import {
  classifyIssueContract,
  draftReplyContract,
  escalateSecurityContract,
  findDuplicateContract,
  requestReproductionContract,
  suggestLabelsContract,
  triageToolContracts,
  type ClassifyIssueInput,
  type DraftReplyInput,
  type EscalateSecurityInput,
  type FindDuplicateInput,
  type RequestReproductionInput,
  type SuggestLabelsInput,
} from "../src/analysis/tool-contracts.js";
import { parseDurationWindow } from "../src/core/duration.js";
import { reviewRepository, type IssueAnalyzer } from "../src/core/review.js";
import type { IssueRecommendation } from "../src/core/schemas.js";
import { readIssueSourceFile } from "../src/fixtures/issue-source.js";

type FixtureCase = {
  id: string;
  issueNumber: number;
  classification: IssueRecommendation["classification"];
  label: string;
  missingKind?: IssueRecommendation["missingInformation"][number]["kind"];
  relatedIssue?: number;
  securitySensitive: boolean;
};

const fixtureCases: FixtureCase[] = [
  {
    id: "clear-bug",
    issueNumber: 101,
    classification: "bug",
    label: "bug",
    missingKind: "minimal-reproduction",
    securitySensitive: false,
  },
  {
    id: "vague-bug",
    issueNumber: 102,
    classification: "unclear",
    label: "needs reproduction",
    missingKind: "reproduction",
    securitySensitive: false,
  },
  {
    id: "feature-request",
    issueNumber: 103,
    classification: "feature",
    label: "enhancement",
    securitySensitive: false,
  },
  {
    id: "duplicate-report",
    issueNumber: 104,
    classification: "bug",
    label: "duplicate",
    relatedIssue: 41,
    securitySensitive: false,
  },
  {
    id: "support-request",
    issueNumber: 105,
    classification: "support",
    label: "question",
    securitySensitive: false,
  },
  {
    id: "security-looking-report",
    issueNumber: 106,
    classification: "security",
    label: "security",
    securitySensitive: true,
  },
  {
    id: "dependency-update",
    issueNumber: 107,
    classification: "dependency",
    label: "dependencies",
    securitySensitive: false,
  },
  {
    id: "missing-reproduction",
    issueNumber: 108,
    classification: "bug",
    label: "needs reproduction",
    missingKind: "minimal-reproduction",
    securitySensitive: false,
  },
];

describe("regression fixtures", () => {
  it("includes the expected issue-source fixtures and regression captures", async () => {
    const issueFixtures = await readdir("fixtures/issues");
    const captures = await readdir("captures/regression");

    expect(issueFixtures.sort()).toEqual(fixtureCases.map((fixture) => `${fixture.id}.json`).sort());
    expect(captures.sort()).toEqual(fixtureCases.map((fixture) => `${fixture.id}.json`).sort());
  });

  it("validates every issue-source fixture shape", async () => {
    for (const fixture of fixtureCases) {
      const document = await readIssueSourceFile(issueFixturePath(fixture.id));

      expect(document.repository).toEqual({
        owner: "jeremyaaron",
        name: "pkg-guard",
      });
      expect(document.issues.some((issue) => issue.number === fixture.issueNumber)).toBe(true);
    }
  });

  it("validates every regression capture against triage tool contracts", async () => {
    for (const fixture of fixtureCases) {
      const capture = await readCapture(fixture.id);
      const results = validateToolCalls(triageToolContracts, capture);

      expect(results).toHaveLength(6);
      expect(results.every((result) => result.ok)).toBe(true);
    }
  });

  it("does not include obvious sensitive fixture data in normalized captures", async () => {
    for (const fixture of fixtureCases) {
      const capture = await readFile(capturePath(fixture.id), "utf8");

      expect(capture).not.toContain("fixture-author");
      expect(capture).not.toContain("sk-");
    }
  });

  it("produces focused report behavior for every fixture category", async () => {
    for (const fixture of fixtureCases) {
      const outputDir = await mkdtemp(path.join(os.tmpdir(), `github-triage-${fixture.id}-`));
      const recommendation = await recommendationFromCapture(
        fixture.id,
        fixture.issueNumber,
      );

      const result = await reviewRepository({
        repo: { owner: "jeremyaaron", name: "pkg-guard" },
        since: parseDurationWindow("30d", new Date("2026-06-28T12:00:00.000Z")),
        outputDir,
        report: "all",
        issuesFile: issueFixturePath(fixture.id),
        comments: 5,
        reportId: fixture.id,
        jsonSummary: false,
        clock: () => new Date("2026-06-28T12:00:00.000Z"),
        analyzer: createCaptureBackedAnalyzer(fixture.issueNumber, recommendation),
      });
      const issue = result.report.issues.find(
        (reportIssue) => reportIssue.source.number === fixture.issueNumber,
      );

      expect(issue?.recommendation.classification).toBe(fixture.classification);
      expect(issue?.recommendation.suggestedLabels.map((label) => label.name)).toContain(
        fixture.label,
      );
      expect(issue?.recommendation.security.sensitive).toBe(fixture.securitySensitive);

      if (fixture.missingKind) {
        expect(
          issue?.recommendation.missingInformation.map((item) => item.kind),
        ).toContain(fixture.missingKind);
      }

      if (fixture.relatedIssue) {
        expect(issue?.recommendation.relatedIssues.map((related) => related.issueNumber)).toContain(
          fixture.relatedIssue,
        );
      }

      const json = await readFile(
        path.join(outputDir, `jeremyaaron-pkg-guard-${fixture.id}.json`),
        "utf8",
      );
      const markdown = await readFile(
        path.join(outputDir, `jeremyaaron-pkg-guard-${fixture.id}.md`),
        "utf8",
      );

      expect(JSON.parse(json)).toMatchObject({
        repository: {
          owner: "jeremyaaron",
          name: "pkg-guard",
        },
      });
      expect(markdown).toContain("## Issue Recommendations");
      expect(markdown.toLowerCase()).not.toContain("posted comment");
      expect(markdown.toLowerCase()).not.toContain("applied label");
    }
  });
});

function createCaptureBackedAnalyzer(
  issueNumber: number,
  recommendation: IssueRecommendation,
): IssueAnalyzer {
  return {
    async analyzeIssue(input) {
      if (input.issue.number === issueNumber) {
        return recommendation;
      }

      return composeIssueRecommendation({
        issueNumber: input.issue.number,
      });
    },
  };
}

async function recommendationFromCapture(
  fixtureId: string,
  issueNumber: number,
): Promise<IssueRecommendation> {
  const capture = await readCapture(fixtureId);
  const results = validateToolCalls(triageToolContracts, capture);
  const values = {
    issueNumber,
  } as {
    issueNumber: number;
    classification?: ClassifyIssueInput;
    labels?: SuggestLabelsInput;
    duplicates?: FindDuplicateInput;
    reproduction?: RequestReproductionInput;
    draftReply?: DraftReplyInput;
    security?: EscalateSecurityInput;
  };

  for (const result of results) {
    if (!result.ok) {
      throw new Error(`Invalid capture ${fixtureId}: ${JSON.stringify(result.issues)}`);
    }

    switch (result.contractName) {
      case classifyIssueContract.name:
        values.classification = result.value as ClassifyIssueInput;
        break;
      case suggestLabelsContract.name:
        values.labels = result.value as SuggestLabelsInput;
        break;
      case findDuplicateContract.name:
        values.duplicates = result.value as FindDuplicateInput;
        break;
      case requestReproductionContract.name:
        values.reproduction = result.value as RequestReproductionInput;
        break;
      case draftReplyContract.name:
        values.draftReply = result.value as DraftReplyInput;
        break;
      case escalateSecurityContract.name:
        values.security = result.value as EscalateSecurityInput;
        break;
    }
  }

  return composeIssueRecommendation(values);
}

async function readCapture(fixtureId: string): Promise<unknown> {
  return JSON.parse(await readFile(capturePath(fixtureId), "utf8")) as unknown;
}

function issueFixturePath(fixtureId: string): string {
  return path.join("fixtures", "issues", `${fixtureId}.json`);
}

function capturePath(fixtureId: string): string {
  return path.join("captures", "regression", `${fixtureId}.json`);
}
