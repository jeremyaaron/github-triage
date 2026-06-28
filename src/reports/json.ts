import { reviewReportSchema, type ReviewReport } from "../core/schemas.js";

export function renderJsonReport(report: ReviewReport): string {
  const parsed = reviewReportSchema.parse(report);
  return `${JSON.stringify(parsed, null, 2)}\n`;
}
