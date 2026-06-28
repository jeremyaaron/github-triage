import { describe, expect, it } from "vitest";

import { loadGitHubIssueSource } from "../src/github/issues.js";
import type {
  GitHubClient,
  GitHubCommentItem,
  GitHubIssueItem,
  GitHubLabelItem,
  ListIssueCommentsInput,
  ListOpenIssuesInput,
} from "../src/github/types.js";

describe("loadGitHubIssueSource", () => {
  it("loads labels, filters pull requests, normalizes issues, and keeps latest comments", async () => {
    const commentCalls: ListIssueCommentsInput[] = [];
    const client = createFakeClient({
      issues: [
        createIssue({ number: 12, comments: 101 }),
        {
          ...createIssue({ number: 13 }),
          pull_request: {},
        },
      ],
      labels: [{ name: "bug", color: "ff0000", description: "Something is not working" }],
      comments: async (input) => {
        commentCalls.push(input);

        if (input.page === 2) {
          return [createComment("latest", 101)];
        }

        return Array.from({ length: 100 }, (_value, index) =>
          createComment(`comment-${index + 1}`, index + 1),
        );
      },
    });

    const source = await loadGitHubIssueSource({
      client,
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      sinceDate: "2026-05-29T12:00:00.000Z",
      comments: 2,
    });

    expect(source.labels).toEqual([
      {
        name: "bug",
        color: "ff0000",
        description: "Something is not working",
      },
    ]);
    expect(source.issues).toHaveLength(1);
    expect(source.issues[0]).toMatchObject({
      number: 12,
      title: "Issue 12",
      body: "",
      author: "octocat",
      state: "open",
      labels: [{ name: "bug" }],
      commentCount: 101,
      comments: [
        { author: "comment-100", body: "Comment 100" },
        { author: "latest", body: "Comment 101" },
      ],
    });
    expect(commentCalls).toEqual([
      {
        owner: "jeremyaaron",
        repo: "pkg-guard",
        issueNumber: 12,
        page: 2,
        perPage: 100,
      },
      {
        owner: "jeremyaaron",
        repo: "pkg-guard",
        issueNumber: 12,
        page: 1,
        perPage: 100,
      },
    ]);
  });

  it("skips comment requests when comments are disabled", async () => {
    let commentRequests = 0;
    const client = createFakeClient({
      issues: [createIssue({ number: 12, comments: 3 })],
      labels: [],
      comments: async () => {
        commentRequests += 1;
        return [];
      },
    });

    const source = await loadGitHubIssueSource({
      client,
      repo: { owner: "jeremyaaron", name: "pkg-guard" },
      sinceDate: "2026-05-29T12:00:00.000Z",
      comments: 0,
    });

    expect(source.issues[0]?.comments).toEqual([]);
    expect(commentRequests).toBe(0);
  });

  it("maps common GitHub API failures", async () => {
    for (const [status, code] of [
      [401, "github.auth-missing"],
      [403, "github.auth-missing"],
      [404, "github.repo-not-found"],
      [429, "github.rate-limited"],
      [500, "github.api-failed"],
    ] as const) {
      const client = createFakeClient({
        issues: async () => {
          throw Object.assign(new Error("GitHub failed"), { status });
        },
        labels: [],
        comments: async () => [],
      });

      await expect(
        loadGitHubIssueSource({
          client,
          repo: { owner: "jeremyaaron", name: "pkg-guard" },
          sinceDate: "2026-05-29T12:00:00.000Z",
          comments: 0,
        }),
      ).rejects.toMatchObject({
        code,
        exitCode: 1,
      });
    }
  });

  it("maps GitHub 403 rate-limit responses to github.rate-limited", async () => {
    const client = createFakeClient({
      issues: async () => {
        throw Object.assign(new Error("API rate limit exceeded"), { status: 403 });
      },
      labels: [],
      comments: async () => [],
    });

    await expect(
      loadGitHubIssueSource({
        client,
        repo: { owner: "jeremyaaron", name: "pkg-guard" },
        sinceDate: "2026-05-29T12:00:00.000Z",
        comments: 0,
      }),
    ).rejects.toMatchObject({
      code: "github.rate-limited",
      exitCode: 1,
    });
  });
});

function createFakeClient(input: {
  issues: GitHubIssueItem[] | ((input: ListOpenIssuesInput) => Promise<GitHubIssueItem[]>);
  labels: GitHubLabelItem[];
  comments: (input: ListIssueCommentsInput) => Promise<GitHubCommentItem[]>;
}): GitHubClient {
  return {
    async listOpenIssues(options) {
      return typeof input.issues === "function" ? await input.issues(options) : input.issues;
    },
    async listLabels() {
      return input.labels;
    },
    async listIssueComments(options) {
      return await input.comments(options);
    },
  };
}

function createIssue(input: { number: number; comments?: number }): GitHubIssueItem {
  return {
    number: input.number,
    title: `Issue ${input.number}`,
    body: null,
    user: { login: "octocat" },
    state: "open",
    labels: ["bug"],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    comments: input.comments ?? 0,
    html_url: `https://github.com/jeremyaaron/pkg-guard/issues/${input.number}`,
  };
}

function createComment(author: string, number: number): GitHubCommentItem {
  return {
    user: { login: author },
    body: `Comment ${number}`,
    created_at: `2026-01-02T00:${String(number % 60).padStart(2, "0")}:00.000Z`,
    updated_at: `2026-01-02T00:${String(number % 60).padStart(2, "0")}:00.000Z`,
    html_url: `https://github.com/jeremyaaron/pkg-guard/issues/12#issuecomment-${number}`,
  };
}
