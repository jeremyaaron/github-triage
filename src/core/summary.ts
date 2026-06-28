import type { ReportIssue, ReviewSummary } from "./schemas.js";

export function createReviewSummary(issues: readonly ReportIssue[]): ReviewSummary {
  return {
    issueCount: issues.length,
    securitySensitive: issues.filter((issue) => issue.recommendation.security.sensitive).length,
    likelyDuplicates: issues.filter((issue) =>
      issue.recommendation.relatedIssues.some((related) => related.relationship === "likely-duplicate"),
    ).length,
    needsMaintainerReply: issues.filter((issue) => issue.recommendation.draftReply !== null).length,
    missingReproduction: issues.filter((issue) =>
      issue.recommendation.missingInformation.some(
        (item) => item.kind === "reproduction" || item.kind === "minimal-reproduction",
      ),
    ).length,
  };
}
