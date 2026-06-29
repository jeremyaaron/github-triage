import path from "node:path";

import { parseReportId, repoSlugSchema, type RepoSlug } from "../core/schemas.js";

export const defaultReportOutputDir = ".github-triage/reports";

export type ReportFormat = "markdown" | "json" | "all";
export type ReportArtifactFormat = "none" | ReportFormat;

export interface ReportPathPlanOptions {
  repo: RepoSlug;
  report: ReportArtifactFormat;
  outputDir?: string;
  reportId?: string;
  now?: Date;
}

export interface ReportFilePath {
  format: Exclude<ReportFormat, "all">;
  path: string;
}

export interface ReportPathPlan {
  outputDir: string;
  reportId: string;
  baseName: string;
  files: ReportFilePath[];
  markdownPath?: string;
  jsonPath?: string;
}

export function createDefaultReportId(now = new Date()): string {
  const year = String(now.getUTCFullYear()).padStart(4, "0");
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const hours = String(now.getUTCHours()).padStart(2, "0");
  const minutes = String(now.getUTCMinutes()).padStart(2, "0");
  const seconds = String(now.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}Z`;
}

export function planReportPaths(options: ReportPathPlanOptions): ReportPathPlan {
  const repo = repoSlugSchema.parse(options.repo);
  const outputDir = options.outputDir ?? defaultReportOutputDir;
  const reportId = options.reportId
    ? parseReportId(options.reportId)
    : createDefaultReportId(options.now);
  const baseName = `${repo.owner}-${repo.name}-${reportId}`;
  const files = createReportFiles(outputDir, baseName, options.report);
  const markdownPath = files.find((file) => file.format === "markdown")?.path;
  const jsonPath = files.find((file) => file.format === "json")?.path;

  return {
    outputDir,
    reportId,
    baseName,
    files,
    ...(markdownPath ? { markdownPath } : {}),
    ...(jsonPath ? { jsonPath } : {}),
  };
}

function createReportFiles(
  outputDir: string,
  baseName: string,
  format: ReportArtifactFormat,
): ReportFilePath[] {
  switch (format) {
    case "none":
      return [];
    case "markdown":
      return [{ format: "markdown", path: path.join(outputDir, `${baseName}.md`) }];
    case "json":
      return [{ format: "json", path: path.join(outputDir, `${baseName}.json`) }];
    case "all":
      return [
        { format: "markdown", path: path.join(outputDir, `${baseName}.md`) },
        { format: "json", path: path.join(outputDir, `${baseName}.json`) },
      ];
  }
}
