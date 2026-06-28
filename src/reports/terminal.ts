import type { ReviewReport } from "../core/schemas.js";
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
    reports: paths?.files.map((file) => ({ format: file.format, path: file.path })) ?? [],
  };

  return `${JSON.stringify(summary, null, 2)}\n`;
}
