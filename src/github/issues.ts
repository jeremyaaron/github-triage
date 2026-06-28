import { GithubTriageError } from "../core/errors.js";
import type { RepoSlug, SourceComment, SourceIssue, SourceLabel } from "../core/schemas.js";
import type {
  GitHubClient,
  GitHubCommentItem,
  GitHubIssueItem,
  GitHubIssueLabel,
  GitHubIssueSource,
  GitHubLabelItem,
} from "./types.js";

export interface LoadGitHubIssueSourceOptions {
  client: GitHubClient;
  repo: RepoSlug;
  sinceDate: string;
  comments: number;
}

const commentsPerPage = 100;

export async function loadGitHubIssueSource(
  options: LoadGitHubIssueSourceOptions,
): Promise<GitHubIssueSource> {
  try {
    const [rawIssues, rawLabels] = await Promise.all([
      options.client.listOpenIssues({
        owner: options.repo.owner,
        repo: options.repo.name,
        since: options.sinceDate,
      }),
      options.client.listLabels({
        owner: options.repo.owner,
        repo: options.repo.name,
      }),
    ]);
    const labels = rawLabels.map(normalizeRepoLabel);
    const issues = [];

    for (const rawIssue of rawIssues) {
      if (rawIssue.pull_request) {
        continue;
      }

      const comments =
        options.comments > 0
          ? await loadLatestComments({
              client: options.client,
              owner: options.repo.owner,
              repo: options.repo.name,
              issueNumber: rawIssue.number,
              commentCount: rawIssue.comments,
              limit: options.comments,
            })
          : [];

      issues.push(normalizeIssue(rawIssue, comments));
    }

    return { labels, issues };
  } catch (error) {
    throw mapGitHubError(error);
  }
}

interface LoadLatestCommentsOptions {
  client: GitHubClient;
  owner: string;
  repo: string;
  issueNumber: number;
  commentCount: number;
  limit: number;
}

async function loadLatestComments(options: LoadLatestCommentsOptions): Promise<SourceComment[]> {
  const collected: GitHubCommentItem[] = [];
  const firstPage = Math.max(1, Math.ceil(options.commentCount / commentsPerPage));

  for (
    let page = firstPage;
    page >= 1 && collected.length < options.limit && options.commentCount > 0;
    page -= 1
  ) {
    const comments = await options.client.listIssueComments({
      owner: options.owner,
      repo: options.repo,
      issueNumber: options.issueNumber,
      page,
      perPage: commentsPerPage,
    });

    collected.unshift(...comments);
  }

  return collected.slice(-options.limit).map(normalizeComment);
}

function normalizeIssue(raw: GitHubIssueItem, comments: SourceComment[]): SourceIssue {
  return {
    number: raw.number,
    title: raw.title,
    body: raw.body ?? "",
    author: raw.user?.login ?? "unknown",
    state: raw.state === "closed" ? "closed" : "open",
    labels: raw.labels.map(normalizeIssueLabel).filter((label) => label.name.length > 0),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    commentCount: raw.comments,
    url: raw.html_url,
    comments,
  };
}

function normalizeRepoLabel(raw: GitHubLabelItem): SourceLabel {
  return {
    name: raw.name,
    ...(raw.color ? { color: raw.color } : {}),
    ...(raw.description ? { description: raw.description } : {}),
  };
}

function normalizeIssueLabel(raw: GitHubIssueLabel): SourceLabel {
  if (typeof raw === "string") {
    return { name: raw };
  }

  return {
    name: raw.name ?? "",
    ...(raw.color ? { color: raw.color } : {}),
    ...(raw.description ? { description: raw.description } : {}),
  };
}

function normalizeComment(raw: GitHubCommentItem): SourceComment {
  return {
    author: raw.user?.login ?? "unknown",
    body: raw.body ?? "",
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    url: raw.html_url,
  };
}

function mapGitHubError(error: unknown): GithubTriageError {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error);

  if ((status === 403 && message.toLowerCase().includes("rate limit")) || status === 429) {
    return new GithubTriageError({
      code: "github.rate-limited",
      message: "GitHub API rate limit exceeded. Try again later.",
      exitCode: 1,
      cause: error,
    });
  }

  if (status === 401 || status === 403) {
    return new GithubTriageError({
      code: "github.auth-missing",
      message: "GitHub authentication failed. Set GITHUB_TOKEN or run `gh auth login`.",
      exitCode: 1,
      cause: error,
    });
  }

  if (status === 404) {
    return new GithubTriageError({
      code: "github.repo-not-found",
      message: "GitHub repository was not found or is not accessible.",
      exitCode: 1,
      cause: error,
    });
  }

  return new GithubTriageError({
    code: "github.api-failed",
    message: "GitHub API request failed.",
    exitCode: 1,
    cause: error,
  });
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error !== "object" || error === null || !("message" in error)) {
    return "";
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : "";
}
