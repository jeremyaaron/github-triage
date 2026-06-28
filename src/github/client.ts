import { Octokit } from "@octokit/rest";

import { version } from "../version.js";
import type {
  GitHubClient,
  GitHubCommentItem,
  GitHubIssueItem,
  GitHubLabelItem,
  ListIssueCommentsInput,
  ListOpenIssuesInput,
  RepoInput,
} from "./types.js";

export function createGitHubClient(token: string): GitHubClient {
  const octokit = new Octokit({
    auth: token,
    userAgent: `github-triage/${version}`,
  });

  return createGitHubClientFromOctokit(octokit);
}

export interface OctokitLike {
  paginate<T>(
    route: unknown,
    parameters: Record<string, unknown>,
  ): Promise<T[]>;
  rest: {
    issues: {
      listForRepo: unknown;
      listLabelsForRepo: unknown;
      listComments(input: OctokitListCommentsParameters): Promise<{ data: GitHubCommentItem[] }>;
    };
  };
}

interface OctokitListCommentsParameters extends Record<string, unknown> {
  owner: string;
  repo: string;
  issue_number: number;
  per_page: number;
  page: number;
}

export function createGitHubClientFromOctokit(octokit: OctokitLike): GitHubClient {
  return new OctokitGitHubClient(octokit);
}

class OctokitGitHubClient implements GitHubClient {
  constructor(private readonly octokit: OctokitLike) {}

  async listOpenIssues(input: ListOpenIssuesInput): Promise<GitHubIssueItem[]> {
    return await this.octokit.paginate(this.octokit.rest.issues.listForRepo, {
      owner: input.owner,
      repo: input.repo,
      state: "open",
      since: input.since,
      per_page: 100,
      sort: "updated",
      direction: "desc",
    });
  }

  async listLabels(input: RepoInput): Promise<GitHubLabelItem[]> {
    return await this.octokit.paginate(this.octokit.rest.issues.listLabelsForRepo, {
      owner: input.owner,
      repo: input.repo,
      per_page: 100,
    });
  }

  async listIssueComments(input: ListIssueCommentsInput): Promise<GitHubCommentItem[]> {
    const response = await this.octokit.rest.issues.listComments({
      owner: input.owner,
      repo: input.repo,
      issue_number: input.issueNumber,
      per_page: input.perPage,
      page: input.page,
    });

    return response.data;
  }
}
