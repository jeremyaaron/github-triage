import { isGithubTriageError } from "../core/errors.js";
import { reviewRepositoryFromCli } from "../core/review.js";
import { version } from "../version.js";
import { renderHelp } from "./help.js";
import { parseCliArgs, type ReviewCliOptions } from "./options.js";
import {
  resolveReviewCliOptions,
  type ResolveReviewOptionsDependencies,
} from "./resolve-options.js";

export interface CliResult {
  exitCode: 0 | 1 | 2;
  stdout: string;
  stderr: string;
}

export interface ReviewRepositoryResult {
  stdout: string;
  stderr?: string;
}

export type ReviewRepository = (options: ReviewCliOptions) => Promise<ReviewRepositoryResult>;

export interface RunCliDependencies {
  reviewRepository?: ReviewRepository;
  now?: Date;
  cwd?: string;
  execFile?: ResolveReviewOptionsDependencies["execFile"];
}

export async function runCli(
  args: readonly string[],
  dependencies: RunCliDependencies = {},
): Promise<CliResult> {
  try {
    const parsed = parseCliArgs(args);

    switch (parsed.command) {
      case "help":
        return {
          exitCode: 0,
          stdout: renderHelp(),
          stderr: "",
        };
      case "version":
        return {
          exitCode: 0,
          stdout: `${version}\n`,
          stderr: "",
        };
      case "review": {
        const reviewRepository = dependencies.reviewRepository ?? reviewRepositoryFromCli;
        const options = await resolveReviewCliOptions(parsed.args, {
          ...(dependencies.now ? { now: dependencies.now } : {}),
          ...(dependencies.cwd ? { cwd: dependencies.cwd } : {}),
          ...(dependencies.execFile ? { execFile: dependencies.execFile } : {}),
        });
        const result = await reviewRepository(options);
        return {
          exitCode: 0,
          stdout: result.stdout,
          stderr: result.stderr ?? "",
        };
      }
    }
  } catch (error) {
    return renderError(error);
  }
}

function renderError(error: unknown): CliResult {
  if (isGithubTriageError(error)) {
    return {
      exitCode: error.exitCode,
      stdout: "",
      stderr: `error ${error.code}\n  ${error.message}\n`,
    };
  }

  const message = error instanceof Error ? error.message : String(error);

  return {
    exitCode: 1,
    stdout: "",
    stderr: `error github-triage.unexpected\n  ${message}\n`,
  };
}
