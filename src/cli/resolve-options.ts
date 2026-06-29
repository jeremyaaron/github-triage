import { parseDurationWindow } from "../core/duration.js";
import { createUsageError, isGithubTriageError } from "../core/errors.js";
import { parseReportId, type RepoSlug } from "../core/schemas.js";
import { readProjectConfig } from "../config/project-config.js";
import { readIssueSourceFile } from "../fixtures/issue-source.js";
import { defaultReportOutputDir } from "../reports/paths.js";
import {
  detectGitHubRepository,
  type RepositoryContext,
  type RepositoryExecFile,
} from "../repository/detect.js";
import type { ParsedReviewArgs, ReviewCliOptions } from "./options.js";

export interface ResolveReviewOptionsDependencies {
  now?: Date;
  cwd?: string;
  execFile?: RepositoryExecFile;
}

export async function resolveReviewCliOptions(
  parsed: ParsedReviewArgs,
  dependencies: ResolveReviewOptionsDependencies = {},
): Promise<ReviewCliOptions> {
  const detection = await resolveRepository(parsed, dependencies);
  const config = detection.context ? await readProjectConfig({ root: detection.context.root }) : {};
  const sinceInput = parsed.since ?? config.since;

  if (!sinceInput) {
    throw createUsageError(
      "cli.invalid-duration",
      'Missing --since value. Use a day-based duration such as "--since 30d".',
    );
  }

  const report = parsed.report ?? config.report ?? "none";
  const reportId = parsed.reportId ?? config.reportId;
  const model = parsed.model ?? config.model;

  if (reportId) {
    parseReportId(reportId);
  }

  return {
    repo: detection.repo,
    since: parseDurationWindow(sinceInput, dependencies.now),
    outputDir: parsed.outputDir ?? config.outputDir ?? defaultReportOutputDir,
    report,
    ...(parsed.issuesFile ? { issuesFile: parsed.issuesFile } : {}),
    comments: parsed.comments ?? config.comments ?? 5,
    ...(reportId ? { reportId } : {}),
    ...(parsed.captureDir ? { captureDir: parsed.captureDir } : {}),
    ...(model ? { model } : {}),
    jsonSummary: parsed.jsonSummary,
    ...(detection.context ? { projectRoot: detection.context.root } : {}),
  };
}

interface RepositoryResolution {
  repo: RepoSlug;
  context?: RepositoryContext;
}

async function resolveRepository(
  parsed: ParsedReviewArgs,
  dependencies: ResolveReviewOptionsDependencies,
): Promise<RepositoryResolution> {
  if (parsed.repo) {
    const context = await tryDetectGitHubRepository(dependencies);
    return {
      repo: parsed.repo,
      ...(context ? { context } : {}),
    };
  }

  try {
    const context = await detectGitHubRepository(createDetectRepositoryOptions(dependencies));

    return {
      repo: context.selected.repo,
      context,
    };
  } catch (error) {
    if (parsed.issuesFile) {
      const fixture = await readIssueSourceFile(parsed.issuesFile);
      return {
        repo: fixture.repository,
      };
    }

    throw error;
  }
}

async function tryDetectGitHubRepository(
  dependencies: ResolveReviewOptionsDependencies,
): Promise<RepositoryContext | undefined> {
  try {
    return await detectGitHubRepository(createDetectRepositoryOptions(dependencies));
  } catch (error) {
    if (
      isGithubTriageError(error) &&
      (error.code === "repo.detect-missing" ||
        error.code === "repo.detect-ambiguous" ||
        error.code === "repo.git-failed")
    ) {
      return undefined;
    }

    throw error;
  }
}

function createDetectRepositoryOptions(
  dependencies: ResolveReviewOptionsDependencies,
): Parameters<typeof detectGitHubRepository>[0] {
  return {
    ...(dependencies.cwd ? { cwd: dependencies.cwd } : {}),
    ...(dependencies.execFile ? { execFile: dependencies.execFile } : {}),
  };
}
