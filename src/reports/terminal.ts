import type { ReportIssue, ReviewReport } from "../core/schemas.js";
import { reviewReportSchema } from "../core/schemas.js";
import type { ReportPathPlan } from "./paths.js";

export function renderTerminalSummary(report: ReviewReport, paths?: ReportPathPlan): string {
  const parsed = reviewReportSchema.parse(report);
  const lines: string[] = [];
  const repoName = `${parsed.repository.owner}/${parsed.repository.name}`;

  lines.push(`Reviewed ${parsed.summary.issueCount} open issues in ${repoName}`);
  lines.push("");
  lines.push(`Security-sensitive: ${parsed.summary.securitySensitive}`);
  lines.push(`Likely duplicates: ${parsed.summary.likelyDuplicates}`);
  lines.push(`Needs maintainer reply: ${parsed.summary.needsMaintainerReply}`);
  lines.push(`Missing reproduction: ${parsed.summary.missingReproduction}`);
  lines.push("");
  lines.push("Issues:");
  pushIssueRows(lines, parsed.issues);

  if (paths && paths.files.length > 0) {
    lines.push("");
    lines.push("Reports:");
    for (const file of paths.files) {
      lines.push(`  ${file.path}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function renderTerminalJsonSummary(report: ReviewReport, paths?: ReportPathPlan): string {
  const parsed = reviewReportSchema.parse(report);
  const summary = {
    repository: `${parsed.repository.owner}/${parsed.repository.name}`,
    issueCount: parsed.summary.issueCount,
    securitySensitive: parsed.summary.securitySensitive,
    likelyDuplicates: parsed.summary.likelyDuplicates,
    needsMaintainerReply: parsed.summary.needsMaintainerReply,
    missingReproduction: parsed.summary.missingReproduction,
    issues: parsed.issues.map(toTerminalIssueRow),
    reports: paths?.files.map((file) => ({ format: file.format, path: file.path })) ?? [],
  };

  return `${JSON.stringify(summary, null, 2)}\n`;
}

interface TerminalIssueRow {
  number: number;
  title: string;
  classification: string;
  status: string;
  labels: string[];
  url: string;
}

function pushIssueRows(lines: string[], issues: ReportIssue[]): void {
  if (issues.length === 0) {
    lines.push("  None");
    return;
  }

  const rows = issues.map(toTerminalIssueRow);
  const issueWidth = Math.max(...rows.map((row) => `#${row.number}`.length));
  const classificationWidth = Math.max(...rows.map((row) => row.classification.length));
  const statusWidth = Math.max(...rows.map((row) => row.status.length));

  for (const row of rows) {
    const issue = `#${row.number}`.padEnd(issueWidth);
    const classification = row.classification.padEnd(classificationWidth);
    const status = row.status.padEnd(statusWidth);
    const labels = row.labels.length > 0 ? row.labels.join(", ") : "none";

    lines.push(`  ${issue}  ${classification}  ${status}  labels: ${labels}`);
  }
}

function toTerminalIssueRow(issue: ReportIssue): TerminalIssueRow {
  return {
    number: issue.source.number,
    title: issue.source.title,
    classification: issue.recommendation.classification,
    status: selectPrimaryStatus(issue),
    labels: issue.recommendation.suggestedLabels.map((label) => label.name),
    url: issue.source.url,
  };
}

function selectPrimaryStatus(issue: ReportIssue): string {
  const recommendation = issue.recommendation;

  if (recommendation.security.sensitive && !recommendation.security.publicReplyAllowed) {
    return "avoid public reply";
  }

  if (recommendation.security.sensitive) {
    return "security review";
  }

  if (recommendation.relatedIssues.some((related) => related.relationship === "likely-duplicate")) {
    return "likely duplicate";
  }

  if (
    recommendation.missingInformation.some(
      (item) => item.kind === "reproduction" || item.kind === "minimal-reproduction",
    )
  ) {
    return "needs reproduction";
  }

  if (recommendation.draftReply) {
    return "needs reply";
  }

  return "ready for review";
}
