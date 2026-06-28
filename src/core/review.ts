import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ReviewCliOptions } from "../cli/options.js";
import type { ReviewRepositoryResult } from "../cli/run.js";
import { readIssueSourceFile } from "../fixtures/issue-source.js";
import { resolveGitHubToken, type ExecFile } from "../github/auth.js";
import { createGitHubClient } from "../github/client.js";
import { loadGitHubIssueSource } from "../github/issues.js";
import type { GitHubClient, GitHubIssueSource } from "../github/types.js";
import { renderJsonReport } from "../reports/json.js";
import { renderMarkdownReport } from "../reports/markdown.js";
import { planReportPaths, type ReportFormat } from "../reports/paths.js";
import { renderTerminalJsonSummary, renderTerminalSummary } from "../reports/terminal.js";
import { GithubTriageError } from "./errors.js";
import {
  issueRecommendationSchema,
  reviewReportSchema,
  type DurationWindow,
  type IssueRecommendation,
  type RepoSlug,
  type ReviewReport,
  type SourceIssue,
  type SourceLabel,
} from "./schemas.js";
import { createReviewSummary } from "./summary.js";

export interface AnalyzeIssueInput {
  repository: RepoSlug;
  repositoryLabels: SourceLabel[];
  issue: SourceIssue;
}

export interface IssueAnalyzer {
  analyzeIssue(input: AnalyzeIssueInput): Promise<IssueRecommendation>;
}

export interface ReviewOptions {
  repo: RepoSlug;
  since: DurationWindow;
  outputDir: string;
  format: ReportFormat;
  issuesFile?: string;
  comments: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  jsonSummary: boolean;
  clock?: () => Date;
  analyzer?: IssueAnalyzer;
  githubClient?: GitHubClient;
  env?: NodeJS.ProcessEnv;
  execFile?: ExecFile;
}

export interface ReviewResult {
  report: ReviewReport;
  paths: ReturnType<typeof planReportPaths>;
  stdout: string;
}

export async function reviewRepositoryFromCli(
  options: ReviewCliOptions,
): Promise<ReviewRepositoryResult> {
  const result = await reviewRepository(options);
  return {
    stdout: result.stdout,
  };
}

export async function reviewRepository(options: ReviewOptions): Promise<ReviewResult> {
  const source = await loadReviewSource(options);
  const analyzer = options.analyzer ?? createConservativeAnalyzer();
  const reportIssues = [];

  for (const issue of source.issues) {
    const recommendation = issueRecommendationSchema.parse(
      await analyzer.analyzeIssue({
        repository: options.repo,
        repositoryLabels: source.labels,
        issue,
      }),
    );

    reportIssues.push({
      source: issue,
      recommendation,
    });
  }

  const generatedAt = (options.clock ?? (() => new Date()))().toISOString();
  const report = reviewReportSchema.parse({
    schemaVersion: 1,
    repository: options.repo,
    generatedAt,
    reviewWindow: {
      since: options.since.input,
      sinceDate: options.since.sinceDate,
    },
    source: {
      kind: source.kind,
      issueCount: source.issues.length,
      labelCount: source.labels.length,
      commentsPerIssue: options.comments,
    },
    summary: createReviewSummary(reportIssues),
    issues: reportIssues,
    warnings: [],
  });
  const paths = planReportPaths({
    repo: options.repo,
    outputDir: options.outputDir,
    format: options.format,
    now: new Date(generatedAt),
    ...(options.reportId ? { reportId: options.reportId } : {}),
  });

  await writeReports(report, paths.files);

  return {
    report,
    paths,
    stdout: options.jsonSummary
      ? renderTerminalJsonSummary(report, paths)
      : renderTerminalSummary(report, paths),
  };
}

type ReviewSource = GitHubIssueSource & {
  kind: "github" | "fixture";
};

async function loadReviewSource(options: ReviewOptions): Promise<ReviewSource> {
  if (options.issuesFile) {
    const fixture = await readIssueSourceFile(options.issuesFile);
    return {
      kind: "fixture",
      labels: fixture.labels,
      issues: fixture.issues,
    };
  }

  const client =
    options.githubClient ??
    createGitHubClient(
      await resolveGitHubToken({
        ...(options.env ? { env: options.env } : {}),
        ...(options.execFile ? { execFile: options.execFile } : {}),
      }),
    );
  const source = await loadGitHubIssueSource({
    client,
    repo: options.repo,
    sinceDate: options.since.sinceDate,
    comments: options.comments,
  });

  return {
    kind: "github",
    labels: source.labels,
    issues: source.issues,
  };
}

async function writeReports(
  report: ReviewReport,
  files: ReturnType<typeof planReportPaths>["files"],
): Promise<void> {
  try {
    for (const file of files) {
      await mkdir(path.dirname(file.path), { recursive: true });
      const content =
        file.format === "markdown" ? renderMarkdownReport(report) : renderJsonReport(report);
      await writeFile(file.path, content, "utf8");
    }
  } catch (error) {
    throw new GithubTriageError({
      code: "report.write-failed",
      message: "Could not write review report files.",
      exitCode: 1,
      cause: error,
    });
  }
}

function createConservativeAnalyzer(): IssueAnalyzer {
  return {
    async analyzeIssue(input) {
      return {
        issueNumber: input.issue.number,
        classification: "unclear",
        confidence: "low",
        signals: [],
        suggestedLabels: [],
        missingInformation: [
          {
            kind: "reproduction",
            question: "Can you share the smallest reproduction and the exact behavior you expected?",
          },
        ],
        relatedIssues: [],
        draftReply: {
          body: "Thanks for the report. Can you share the smallest reproduction and the exact behavior you expected?",
          rationale: "The offline fallback analyzer does not have enough context for a specific maintainer response.",
        },
        security: {
          sensitive: false,
          confidence: "low",
          rationale: "The offline fallback analyzer does not perform security classification.",
          publicReplyAllowed: true,
        },
        rationale: "Offline fallback recommendation used until model analysis is configured.",
        warnings: [
          {
            code: "analysis.offline-fallback",
            message: "Used conservative offline fallback analyzer.",
          },
        ],
      };
    },
  };
}
