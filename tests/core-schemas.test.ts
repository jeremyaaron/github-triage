import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import {
  issueSourceDocumentSchema,
  parseRepoSlug,
  parseReportId,
  reviewReportSchema,
} from "../src/core/schemas.js";

const sourceIssue = {
  number: 12,
  title: "Exports map missing types",
  body: "The package fails TypeScript resolution.",
  author: "octocat",
  state: "open" as const,
  labels: [
    {
      name: "bug",
      description: "Something is not working",
    },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  commentCount: 1,
  url: "https://github.com/jeremyaaron/pkg-guard/issues/12",
  comments: [
    {
      author: "maintainer",
      body: "Can you share a reproduction?",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      url: "https://github.com/jeremyaaron/pkg-guard/issues/12#issuecomment-1",
    },
  ],
};

const recommendation = {
  issueNumber: 12,
  classification: "bug" as const,
  confidence: "high" as const,
  signals: [
    {
      kind: "typescript-resolution-failure",
      confidence: "high" as const,
      rationale: "The issue describes a consumer import failure.",
    },
  ],
  suggestedLabels: [
    {
      name: "bug",
      confidence: "high" as const,
      rationale: "The current behavior appears broken.",
      exists: true,
    },
  ],
  missingInformation: [
    {
      kind: "minimal-reproduction" as const,
      question: "Can you share a minimal package that reproduces the resolution failure?",
    },
  ],
  relatedIssues: [
    {
      issueNumber: 7,
      title: "Types not found through exports",
      url: "https://github.com/jeremyaaron/pkg-guard/issues/7",
      relationship: "related" as const,
      confidence: "medium" as const,
      rationale: "Both issues mention type resolution through exports.",
    },
  ],
  draftReply: {
    body: "Thanks for the report. Can you share a minimal reproduction?",
    rationale: "The maintainer needs a reproduction before investigating.",
  },
  security: {
    sensitive: false,
    confidence: "high" as const,
    rationale: "The report does not describe a vulnerability or secret exposure.",
    publicReplyAllowed: true,
  },
  rationale: "The issue has enough detail to classify as a bug but still needs a reproduction.",
  warnings: [],
};

describe("repo and report id parsing", () => {
  it("parses owner/repo slugs", () => {
    expect(parseRepoSlug("jeremyaaron/pkg-guard")).toEqual({
      owner: "jeremyaaron",
      name: "pkg-guard",
    });
  });

  it("rejects malformed repo slugs with stable error metadata", () => {
    for (const value of ["pkg-guard", "too/many/parts", "owner/", "/repo", "owner/repo name"]) {
      try {
        parseRepoSlug(value);
        throw new Error(`Expected ${value} to fail.`);
      } catch (error) {
        expect(error).toBeInstanceOf(GithubTriageError);
        expect((error as GithubTriageError).code).toBe("cli.invalid-repo");
        expect((error as GithubTriageError).exitCode).toBe(2);
      }
    }
  });

  it("validates report ids", () => {
    expect(parseReportId("20260628-120000Z")).toBe("20260628-120000Z");
    expect(parseReportId("fixture.clear-bug_1")).toBe("fixture.clear-bug_1");
  });

  it("rejects unsafe report ids", () => {
    for (const value of ["../outside", "with space", "owner/repo", ""]) {
      expect(() => parseReportId(value)).toThrow(GithubTriageError);
    }
  });
});

describe("source and report schemas", () => {
  it("accepts a valid issue-source fixture document", () => {
    const parsed = issueSourceDocumentSchema.parse({
      schemaVersion: 1,
      repository: {
        owner: "jeremyaaron",
        name: "pkg-guard",
      },
      labels: [
        {
          name: "bug",
          description: "Something is not working",
        },
      ],
      issues: [sourceIssue],
    });

    expect(parsed.issues).toHaveLength(1);
    expect(parsed.issues[0]?.number).toBe(12);
  });

  it("rejects invalid issue-source fixture shapes", () => {
    const result = issueSourceDocumentSchema.safeParse({
      schemaVersion: 1,
      repository: {
        owner: "jeremyaaron",
        name: "pkg-guard",
      },
      labels: [],
      issues: [
        {
          ...sourceIssue,
          number: -1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid review report", () => {
    const parsed = reviewReportSchema.parse({
      schemaVersion: 1,
      repository: {
        owner: "jeremyaaron",
        name: "pkg-guard",
      },
      generatedAt: "2026-06-28T12:00:00.000Z",
      reviewWindow: {
        since: "30d",
        sinceDate: "2026-05-29T12:00:00.000Z",
      },
      source: {
        kind: "fixture",
        issueCount: 1,
        labelCount: 1,
        commentsPerIssue: 5,
      },
      summary: {
        issueCount: 1,
        securitySensitive: 0,
        likelyDuplicates: 0,
        needsMaintainerReply: 1,
        missingReproduction: 1,
      },
      issues: [
        {
          source: sourceIssue,
          recommendation,
        },
      ],
      warnings: [],
    });

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.issues[0]?.recommendation.classification).toBe("bug");
  });

  it("rejects invalid recommendation categories", () => {
    const result = reviewReportSchema.safeParse({
      schemaVersion: 1,
      repository: {
        owner: "jeremyaaron",
        name: "pkg-guard",
      },
      generatedAt: "2026-06-28T12:00:00.000Z",
      reviewWindow: {
        since: "30d",
        sinceDate: "2026-05-29T12:00:00.000Z",
      },
      source: {
        kind: "fixture",
        issueCount: 1,
        labelCount: 1,
        commentsPerIssue: 5,
      },
      summary: {
        issueCount: 1,
        securitySensitive: 0,
        likelyDuplicates: 0,
        needsMaintainerReply: 1,
        missingReproduction: 1,
      },
      issues: [
        {
          source: sourceIssue,
          recommendation: {
            ...recommendation,
            classification: "enhancement",
          },
        },
      ],
      warnings: [],
    });

    expect(result.success).toBe(false);
  });
});
