export type GithubTriageExitCode = 1 | 2;

export type GithubTriageErrorCode =
  | "cli.invalid-command"
  | "cli.invalid-repo"
  | "cli.invalid-duration"
  | "cli.invalid-format"
  | "cli.invalid-comments"
  | "cli.invalid-report-id"
  | "repo.detect-missing"
  | "repo.detect-ambiguous"
  | "repo.git-failed"
  | "github.auth-missing"
  | "github.repo-not-found"
  | "github.rate-limited"
  | "github.api-failed"
  | "fixture.invalid-json"
  | "fixture.invalid-shape"
  | "analysis.auth-missing"
  | "analysis.model-failed"
  | "analysis.output-invalid"
  | "report.write-failed";

export interface GithubTriageErrorOptions {
  code: GithubTriageErrorCode;
  message: string;
  exitCode: GithubTriageExitCode;
  details?: unknown;
  cause?: unknown;
}

export class GithubTriageError extends Error {
  readonly code: GithubTriageErrorCode;
  readonly exitCode: GithubTriageExitCode;
  readonly details?: unknown;

  constructor(options: GithubTriageErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = "GithubTriageError";
    this.code = options.code;
    this.exitCode = options.exitCode;
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }
}

export function isGithubTriageError(error: unknown): error is GithubTriageError {
  return error instanceof GithubTriageError;
}

export function createUsageError(
  code: GithubTriageErrorCode,
  message: string,
  details?: unknown,
): GithubTriageError {
  return new GithubTriageError({
    code,
    message,
    exitCode: 2,
    details,
  });
}
