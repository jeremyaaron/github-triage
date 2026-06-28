import { parseDurationWindow } from "../core/duration.js";
import { createUsageError } from "../core/errors.js";
import {
  parseRepoSlug,
  parseReportId,
  type DurationWindow,
  type RepoSlug,
} from "../core/schemas.js";
import { defaultReportOutputDir, type ReportFormat } from "../reports/paths.js";

export interface ReviewCliOptions {
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
}

export type ParsedCliCommand =
  | {
      command: "help";
    }
  | {
      command: "version";
    }
  | {
      command: "review";
      options: ReviewCliOptions;
    };

export function parseCliArgs(args: readonly string[], now = new Date()): ParsedCliCommand {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return { command: "help" };
  }

  if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
    return { command: "version" };
  }

  const [command, repoInput, ...rest] = args;

  if (command !== "review") {
    throw createUsageError(
      "cli.invalid-command",
      `Invalid command "${command ?? ""}". Use "github-triage review <owner>/<repo>".`,
    );
  }

  if (!repoInput) {
    throw createUsageError(
      "cli.invalid-repo",
      'Missing repository. Use "github-triage review <owner>/<repo>".',
    );
  }

  const repo = parseRepoSlug(repoInput);
  const raw = parseReviewFlags(rest);

  if (!raw.since) {
    throw createUsageError(
      "cli.invalid-duration",
      'Missing --since value. Use a day-based duration such as "--since 30d".',
    );
  }

  const since = parseDurationWindow(raw.since, now);

  return {
    command: "review",
    options: {
      repo,
      since,
      outputDir: raw.outputDir ?? defaultReportOutputDir,
      format: raw.format ?? "all",
      ...(raw.issuesFile ? { issuesFile: raw.issuesFile } : {}),
      comments: raw.comments ?? 5,
      ...(raw.reportId ? { reportId: raw.reportId } : {}),
      ...(raw.captureDir ? { captureDir: raw.captureDir } : {}),
      ...(raw.model ? { model: raw.model } : {}),
      jsonSummary: raw.jsonSummary,
    },
  };
}

interface RawReviewFlags {
  since?: string;
  outputDir?: string;
  format?: ReportFormat;
  issuesFile?: string;
  comments?: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  jsonSummary: boolean;
}

function parseReviewFlags(args: readonly string[]): RawReviewFlags {
  const raw: RawReviewFlags = {
    jsonSummary: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    switch (arg) {
      case "--since":
        raw.since = readOptionValue(args, index, "--since");
        index += 1;
        break;
      case "--output-dir":
        raw.outputDir = readOptionValue(args, index, "--output-dir");
        index += 1;
        break;
      case "--format":
        raw.format = parseFormat(readOptionValue(args, index, "--format"));
        index += 1;
        break;
      case "--issues-file":
        raw.issuesFile = readOptionValue(args, index, "--issues-file");
        index += 1;
        break;
      case "--comments":
        raw.comments = parseComments(readOptionValue(args, index, "--comments"));
        index += 1;
        break;
      case "--report-id":
        raw.reportId = parseReportId(readOptionValue(args, index, "--report-id"));
        index += 1;
        break;
      case "--capture-dir":
        raw.captureDir = readOptionValue(args, index, "--capture-dir");
        index += 1;
        break;
      case "--model":
        raw.model = readOptionValue(args, index, "--model");
        index += 1;
        break;
      case "--json":
        raw.jsonSummary = true;
        break;
      default:
        throw createUsageError(
          "cli.invalid-command",
          `Unknown option "${arg ?? ""}". Run "github-triage --help" for usage.`,
        );
    }
  }

  return raw;
}

function readOptionValue(args: readonly string[], index: number, name: string): string {
  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw createUsageError("cli.invalid-command", `Missing value for ${name}.`);
  }

  return value;
}

function parseFormat(input: string): ReportFormat {
  if (input === "markdown" || input === "json" || input === "all") {
    return input;
  }

  throw createUsageError(
    "cli.invalid-format",
    `Invalid --format value "${input}". Use markdown, json, or all.`,
  );
}

function parseComments(input: string): number {
  if (!/^(0|[1-9][0-9]*)$/.test(input)) {
    throw createUsageError(
      "cli.invalid-comments",
      `Invalid --comments value "${input}". Use an integer from 0 to 20.`,
    );
  }

  const count = Number(input);

  if (!Number.isInteger(count) || count < 0 || count > 20) {
    throw createUsageError(
      "cli.invalid-comments",
      `Invalid --comments value "${input}". Use an integer from 0 to 20.`,
    );
  }

  return count;
}
