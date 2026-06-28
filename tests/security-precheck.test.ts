import { describe, expect, it } from "vitest";

import { runSecurityPrecheck } from "../src/analysis/security-precheck.js";
import type { SourceIssue } from "../src/core/schemas.js";

describe("runSecurityPrecheck", () => {
  it("flags high-confidence indicators from title and body", () => {
    const result = runSecurityPrecheck(
      createIssue("Authentication bypass in release workflow", "Looks like CVE-2026-12345."),
    );

    expect(result).toEqual({
      sensitive: true,
      confidence: "high",
      indicators: ["CVE identifier", "authentication bypass"],
      rationale:
        "Matched high-confidence security indicator(s): CVE identifier, authentication bypass.",
    });
  });

  it("flags medium-confidence indicators from comments", () => {
    const result = runSecurityPrecheck(
      createIssue("Unexpected log output", "No details.", ["The log printed a secret token."]),
    );

    expect(result.sensitive).toBe(true);
    expect(result.confidence).toBe("medium");
    expect(result.indicators).toEqual(["secret", "token"]);
  });

  it("returns a low-confidence non-sensitive result when no indicators match", () => {
    expect(runSecurityPrecheck(createIssue("Feature request", "Please add JSON output."))).toEqual({
      sensitive: false,
      confidence: "low",
      indicators: [],
      rationale: "No obvious security-sensitive indicators matched.",
    });
  });
});

function createIssue(title: string, body: string, comments: string[] = []): SourceIssue {
  return {
    number: 1,
    title,
    body,
    author: "octocat",
    state: "open",
    labels: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    commentCount: comments.length,
    url: "https://github.com/owner/repo/issues/1",
    comments: comments.map((comment, index) => ({
      author: "maintainer",
      body: comment,
      createdAt: `2026-01-02T00:0${index}:00.000Z`,
      updatedAt: `2026-01-02T00:0${index}:00.000Z`,
      url: `https://github.com/owner/repo/issues/1#issuecomment-${index}`,
    })),
  };
}
