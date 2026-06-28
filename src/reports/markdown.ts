import type {
  IssueRecommendation,
  ReportIssue,
  ReviewReport,
  SourceLabel,
} from "../core/schemas.js";
import { reviewReportSchema } from "../core/schemas.js";

export function renderMarkdownReport(report: ReviewReport): string {
  const parsed = reviewReportSchema.parse(report);
  const lines: string[] = [];
  const repoName = `${parsed.repository.owner}/${parsed.repository.name}`;

  lines.push(`# GitHub Triage Report: ${repoName}`);
  lines.push("");
  lines.push(`Generated: ${parsed.generatedAt}`);
  lines.push(`Review window: ${parsed.reviewWindow.since} since ${parsed.reviewWindow.sinceDate}`);
  lines.push(`Source: ${parsed.source.kind}`);
  lines.push("");

  pushSummary(lines, parsed);
  pushSecuritySensitiveIssues(lines, parsed.issues);
  pushNeedsMaintainerResponse(lines, parsed.issues);
  pushPossibleDuplicates(lines, parsed.issues);
  pushIssueRecommendations(lines, parsed.issues);
  pushWarnings(lines, parsed);

  return `${lines.join("\n")}\n`;
}

function pushSummary(lines: string[], report: ReviewReport): void {
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Issues reviewed: ${report.summary.issueCount}`);
  lines.push(`- Security-sensitive: ${report.summary.securitySensitive}`);
  lines.push(`- Likely duplicates: ${report.summary.likelyDuplicates}`);
  lines.push(`- Needs maintainer reply: ${report.summary.needsMaintainerReply}`);
  lines.push(`- Missing reproduction: ${report.summary.missingReproduction}`);
  lines.push("");
}

function pushSecuritySensitiveIssues(lines: string[], issues: ReportIssue[]): void {
  lines.push("## Security-Sensitive Issues");
  lines.push("");

  const sensitiveIssues = issues.filter((issue) => issue.recommendation.security.sensitive);

  if (sensitiveIssues.length === 0) {
    lines.push("None flagged.");
    lines.push("");
    return;
  }

  for (const issue of sensitiveIssues) {
    lines.push(
      `- #${issue.source.number} [${issue.source.title}](${issue.source.url}) - ${issue.recommendation.security.confidence}: ${issue.recommendation.security.rationale}`,
    );
  }

  lines.push("");
}

function pushNeedsMaintainerResponse(lines: string[], issues: ReportIssue[]): void {
  lines.push("## Needs Maintainer Response");
  lines.push("");

  const responseIssues = issues.filter((issue) => issue.recommendation.draftReply);

  if (responseIssues.length === 0) {
    lines.push("No draft replies suggested.");
    lines.push("");
    return;
  }

  for (const issue of responseIssues) {
    lines.push(`- #${issue.source.number} [${issue.source.title}](${issue.source.url})`);
  }

  lines.push("");
}

function pushPossibleDuplicates(lines: string[], issues: ReportIssue[]): void {
  lines.push("## Possible Duplicates And Related Issues");
  lines.push("");

  const issuesWithRelated = issues.filter((issue) => issue.recommendation.relatedIssues.length > 0);

  if (issuesWithRelated.length === 0) {
    lines.push("No duplicate or related issue candidates suggested.");
    lines.push("");
    return;
  }

  for (const issue of issuesWithRelated) {
    lines.push(`- #${issue.source.number} [${issue.source.title}](${issue.source.url})`);
    for (const related of issue.recommendation.relatedIssues) {
      lines.push(
        `  - ${related.relationship} #${related.issueNumber} [${related.title}](${related.url}) - ${related.confidence}: ${related.rationale}`,
      );
    }
  }

  lines.push("");
}

function pushIssueRecommendations(lines: string[], issues: ReportIssue[]): void {
  lines.push("## Issue Recommendations");
  lines.push("");

  if (issues.length === 0) {
    lines.push("No issues reviewed.");
    lines.push("");
    return;
  }

  for (const issue of issues) {
    pushIssueRecommendation(lines, issue);
  }
}

function pushIssueRecommendation(lines: string[], issue: ReportIssue): void {
  const recommendation = issue.recommendation;

  lines.push(`### #${issue.source.number} [${issue.source.title}](${issue.source.url})`);
  lines.push("");
  lines.push(`- Classification: ${recommendation.classification} (${recommendation.confidence})`);
  lines.push(`- Current labels: ${formatLabels(issue.source.labels)}`);
  lines.push(`- Suggested labels: ${formatSuggestedLabels(recommendation)}`);
  lines.push(`- Missing information: ${formatMissingInformation(recommendation)}`);
  lines.push(`- Related issues: ${formatRelatedIssues(recommendation)}`);
  lines.push(`- Security-sensitive: ${formatSecurity(recommendation)}`);
  lines.push("");

  if (recommendation.draftReply) {
    lines.push("Draft reply:");
    lines.push("");
    lines.push("```markdown");
    lines.push(recommendation.draftReply.body);
    lines.push("```");
    lines.push("");
  } else {
    lines.push("Draft reply: None suggested.");
    lines.push("");
  }

  lines.push(`Rationale: ${recommendation.rationale}`);

  if (recommendation.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of recommendation.warnings) {
      lines.push(`- ${warning.code}: ${warning.message}`);
    }
  }

  lines.push("");
}

function pushWarnings(lines: string[], report: ReviewReport): void {
  lines.push("## Warnings");
  lines.push("");

  if (report.warnings.length === 0) {
    lines.push("None.");
    lines.push("");
    return;
  }

  for (const warning of report.warnings) {
    const prefix = warning.issueNumber ? `#${warning.issueNumber} ` : "";
    lines.push(`- ${prefix}${warning.code}: ${warning.message}`);
  }

  lines.push("");
}

function formatLabels(labels: SourceLabel[]): string {
  if (labels.length === 0) {
    return "None";
  }

  return labels.map((label) => `\`${label.name}\``).join(", ");
}

function formatSuggestedLabels(recommendation: IssueRecommendation): string {
  if (recommendation.suggestedLabels.length === 0) {
    return "None";
  }

  return recommendation.suggestedLabels
    .map((label) => {
      const status = label.exists ? "existing" : "new-label candidate";
      return `\`${label.name}\` (${label.confidence}, ${status}) - ${label.rationale}`;
    })
    .join("; ");
}

function formatMissingInformation(recommendation: IssueRecommendation): string {
  if (recommendation.missingInformation.length === 0) {
    return "None";
  }

  return recommendation.missingInformation
    .map((item) => `${item.kind}: ${item.question}`)
    .join("; ");
}

function formatRelatedIssues(recommendation: IssueRecommendation): string {
  if (recommendation.relatedIssues.length === 0) {
    return "None";
  }

  return recommendation.relatedIssues
    .map(
      (issue) =>
        `${issue.relationship} #${issue.issueNumber} [${issue.title}](${issue.url}) (${issue.confidence})`,
    )
    .join("; ");
}

function formatSecurity(recommendation: IssueRecommendation): string {
  const security = recommendation.security;
  const publicReply = security.publicReplyAllowed ? "public reply allowed" : "avoid public reply";
  return `${security.sensitive ? "yes" : "no"} (${security.confidence}, ${publicReply}) - ${security.rationale}`;
}
