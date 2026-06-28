import { describe, expect, it } from "vitest";

import {
  createDuplicateCandidateMap,
  findDuplicateCandidates,
} from "../src/analysis/duplicate-candidates.js";
import type { SourceIssue } from "../src/core/schemas.js";

describe("duplicate candidate scoring", () => {
  it("returns deterministic top candidates by score and issue number", () => {
    const issue = createIssue(10, "Type declarations missing from exports map", [
      "TypeScript cannot resolve declarations through package exports.",
    ]);
    const candidates = [
      issue,
      createIssue(2, "Exports map does not expose types", [
        "The package exports map is missing TypeScript declarations.",
      ]),
      createIssue(3, "Support pnpm workspace checks", ["Feature request for workspace mode."]),
      createIssue(1, "Types fail when using package exports", [
        "Type declarations are unavailable through the exports field.",
      ]),
    ];

    expect(findDuplicateCandidates(issue, candidates, { minScore: 0.05 })).toEqual([
      {
        issueNumber: 2,
        title: "Exports map does not expose types",
        url: "https://github.com/owner/repo/issues/2",
        reason: "Shared terms: declarations, exports, map, missing, package",
        score: 0.512,
      },
      {
        issueNumber: 1,
        title: "Types fail when using package exports",
        url: "https://github.com/owner/repo/issues/1",
        reason: "Shared terms: declarations, exports, package, through, type",
        score: 0.372,
      },
    ]);
  });

  it("creates a candidate map for every issue", () => {
    const issues = [
      createIssue(1, "Missing types", ["exports types missing"]),
      createIssue(2, "Types missing", ["package exports missing types"]),
    ];
    const map = createDuplicateCandidateMap(issues, { minScore: 0.01 });

    expect([...map.keys()]).toEqual([1, 2]);
    expect(map.get(1)?.[0]?.issueNumber).toBe(2);
    expect(map.get(2)?.[0]?.issueNumber).toBe(1);
  });
});

function createIssue(number: number, title: string, bodyLines: string[]): SourceIssue {
  return {
    number,
    title,
    body: bodyLines.join("\n"),
    author: "octocat",
    state: "open",
    labels: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    commentCount: 0,
    url: `https://github.com/owner/repo/issues/${number}`,
    comments: [],
  };
}
