import type { SourceIssue, SourceLabel } from "../core/schemas.js";

export interface GitHubIssueSource {
  labels: SourceLabel[];
  issues: SourceIssue[];
}

export interface GitHubClient {
  listOpenIssues(input: ListOpenIssuesInput): Promise<GitHubIssueItem[]>;
  listLabels(input: RepoInput): Promise<GitHubLabelItem[]>;
  listIssueComments(input: ListIssueCommentsInput): Promise<GitHubCommentItem[]>;
}

export interface RepoInput {
  owner: string;
  repo: string;
}

export interface ListOpenIssuesInput extends RepoInput {
  since: string;
}

export interface ListIssueCommentsInput extends RepoInput {
  issueNumber: number;
  page: number;
  perPage: number;
}

export interface GitHubIssueItem {
  number: number;
  title: string;
  body: string | null;
  user: {
    login: string;
  } | null;
  state: string;
  labels: GitHubIssueLabel[];
  created_at: string;
  updated_at: string;
  comments: number;
  html_url: string;
  pull_request?: unknown;
}

export type GitHubIssueLabel =
  | string
  | {
      name?: string | null;
      color?: string | null;
      description?: string | null;
    };

export interface GitHubLabelItem {
  name: string;
  color?: string | null;
  description?: string | null;
}

export interface GitHubCommentItem {
  user: {
    login: string;
  } | null;
  body?: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}
