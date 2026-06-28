import { describe, expect, it } from "vitest";

import { createGitHubClientFromOctokit, type OctokitLike } from "../src/github/client.js";

describe("createGitHubClientFromOctokit", () => {
  it("uses Octokit pagination for issues and labels", async () => {
    const calls: Array<{ route: unknown; parameters: Record<string, unknown> }> = [];
    const listForRepo = Symbol("listForRepo");
    const listLabelsForRepo = Symbol("listLabelsForRepo");
    const octokit: OctokitLike = {
      rest: {
        issues: {
          listForRepo,
          listLabelsForRepo,
          async listComments() {
            return { data: [] };
          },
        },
      },
      async paginate(route, parameters) {
        calls.push({ route, parameters });
        return [];
      },
    };
    const client = createGitHubClientFromOctokit(octokit);

    await client.listOpenIssues({
      owner: "jeremyaaron",
      repo: "pkg-guard",
      since: "2026-05-29T12:00:00.000Z",
    });
    await client.listLabels({
      owner: "jeremyaaron",
      repo: "pkg-guard",
    });

    expect(calls).toEqual([
      {
        route: listForRepo,
        parameters: {
          owner: "jeremyaaron",
          repo: "pkg-guard",
          state: "open",
          since: "2026-05-29T12:00:00.000Z",
          per_page: 100,
          sort: "updated",
          direction: "desc",
        },
      },
      {
        route: listLabelsForRepo,
        parameters: {
          owner: "jeremyaaron",
          repo: "pkg-guard",
          per_page: 100,
        },
      },
    ]);
  });

  it("uses the comments REST endpoint without pagination", async () => {
    const calls: Record<string, unknown>[] = [];
    const octokit: OctokitLike = {
      rest: {
        issues: {
          listForRepo: Symbol("listForRepo"),
          listLabelsForRepo: Symbol("listLabelsForRepo"),
          async listComments(input) {
            calls.push(input);
            return { data: [] };
          },
        },
      },
      async paginate() {
        return [];
      },
    };
    const client = createGitHubClientFromOctokit(octokit);

    await client.listIssueComments({
      owner: "jeremyaaron",
      repo: "pkg-guard",
      issueNumber: 12,
      page: 2,
      perPage: 100,
    });

    expect(calls).toEqual([
      {
        owner: "jeremyaaron",
        repo: "pkg-guard",
        issue_number: 12,
        page: 2,
        per_page: 100,
      },
    ]);
  });
});
