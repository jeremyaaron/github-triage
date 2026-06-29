import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { projectConfigFileName } from "../src/config/project-config.js";
import { resolveReviewCliOptions } from "../src/cli/resolve-options.js";
import type { RepositoryExecFile } from "../src/repository/detect.js";

describe("resolveReviewCliOptions", () => {
  const now = new Date("2026-06-28T12:00:00.000Z");

  it("resolves an implicit repository from git remotes", async () => {
    const options = await resolveReviewCliOptions(
      {
        since: "30d",
        jsonSummary: false,
      },
      {
        now,
        cwd: "/work/project/packages/pkg",
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": "/work/project\n",
          "remote -v": "origin\thttps://github.com/owner/repo.git (fetch)\n",
        }),
      },
    );

    expect(options).toMatchObject({
      repo: {
        owner: "owner",
        name: "repo",
      },
      since: {
        input: "30d",
        days: 30,
        sinceDate: "2026-05-29T12:00:00.000Z",
      },
      outputDir: ".github-triage/reports",
      report: "none",
      comments: 5,
      jsonSummary: false,
      projectRoot: "/work/project",
    });
  });

  it("preserves an explicit repository when git detection is unavailable", async () => {
    const options = await resolveReviewCliOptions(
      {
        repo: {
          owner: "explicit",
          name: "repo",
        },
        since: "7d",
        report: "json",
        comments: 0,
        jsonSummary: true,
      },
      {
        now,
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": {
            error: new Error("fatal: not a git repository"),
            stderr: "fatal: not a git repository",
          },
        }),
      },
    );

    expect(options).toMatchObject({
      repo: {
        owner: "explicit",
        name: "repo",
      },
      since: {
        input: "7d",
        days: 7,
        sinceDate: "2026-06-21T12:00:00.000Z",
      },
      report: "json",
      comments: 0,
      jsonSummary: true,
    });
    expect(options.projectRoot).toBeUndefined();
  });

  it("falls back to fixture repository metadata when implicit detection fails", async () => {
    const issuesFile = await createIssueFixture({
      owner: "fixture-owner",
      name: "fixture-repo",
    });

    const options = await resolveReviewCliOptions(
      {
        since: "30d",
        issuesFile,
        jsonSummary: false,
      },
      {
        now,
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": {
            error: new Error("fatal: not a git repository"),
            stderr: "fatal: not a git repository",
          },
        }),
      },
    );

    expect(options.repo).toEqual({
      owner: "fixture-owner",
      name: "fixture-repo",
    });
    expect(options.issuesFile).toBe(issuesFile);
  });

  it("applies project config when CLI values are absent", async () => {
    const root = await createProjectRoot({
      since: "14d",
      comments: 0,
      report: "markdown",
      outputDir: "reports",
      reportId: "weekly",
      model: "gpt-test",
    });

    const options = await resolveReviewCliOptions(
      {
        jsonSummary: false,
      },
      {
        now,
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": `${root}\n`,
          "remote -v": "origin\tgit@github.com:owner/repo.git (fetch)\n",
        }),
      },
    );

    expect(options).toMatchObject({
      repo: {
        owner: "owner",
        name: "repo",
      },
      since: {
        input: "14d",
        days: 14,
        sinceDate: "2026-06-14T12:00:00.000Z",
      },
      outputDir: "reports",
      report: "markdown",
      comments: 0,
      reportId: "weekly",
      model: "gpt-test",
      projectRoot: root,
    });
  });

  it("lets CLI values override config values", async () => {
    const root = await createProjectRoot({
      since: "14d",
      comments: 0,
      report: "markdown",
      outputDir: "reports",
      reportId: "weekly",
      model: "gpt-config",
    });

    const options = await resolveReviewCliOptions(
      {
        since: "3d",
        comments: 2,
        report: "all",
        outputDir: "cli-reports",
        reportId: "cli",
        model: "gpt-cli",
        jsonSummary: false,
      },
      {
        now,
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": `${root}\n`,
          "remote -v": "origin\tgit@github.com:owner/repo.git (fetch)\n",
        }),
      },
    );

    expect(options).toMatchObject({
      since: {
        input: "3d",
        days: 3,
        sinceDate: "2026-06-25T12:00:00.000Z",
      },
      outputDir: "cli-reports",
      report: "all",
      comments: 2,
      reportId: "cli",
      model: "gpt-cli",
    });
  });

  it("fails when since is missing after config resolution", async () => {
    await expect(
      resolveReviewCliOptions(
        {
          jsonSummary: false,
        },
        {
          now,
          execFile: createRepositoryExecFile({
            "rev-parse --show-toplevel": "/work/project\n",
            "remote -v": "origin\thttps://github.com/owner/repo.git (fetch)\n",
          }),
        },
      ),
    ).rejects.toMatchObject({
      code: "cli.invalid-duration",
      exitCode: 2,
    });
  });

  it("fails for invalid since values during resolution", async () => {
    await expect(
      resolveReviewCliOptions(
        {
          repo: {
            owner: "owner",
            name: "repo",
          },
          since: "1w",
          jsonSummary: false,
        },
        {
          now,
          execFile: createRepositoryExecFile({
            "rev-parse --show-toplevel": {
              error: new Error("fatal: not a git repository"),
              stderr: "fatal: not a git repository",
            },
          }),
        },
      ),
    ).rejects.toMatchObject({
      code: "cli.invalid-duration",
      exitCode: 2,
    });
  });

  it("resolves report none without requesting report artifacts", async () => {
    const options = await resolveReviewCliOptions(
      {
        repo: {
          owner: "owner",
          name: "repo",
        },
        since: "30d",
        report: "none",
        jsonSummary: false,
      },
      {
        now,
        execFile: createRepositoryExecFile({
          "rev-parse --show-toplevel": {
            error: new Error("fatal: not a git repository"),
            stderr: "fatal: not a git repository",
          },
        }),
      },
    );

    expect(options.report).toBe("none");
  });
});

type ExecOutput =
  | string
  | {
      error: Error;
      stderr?: string;
    };

function createRepositoryExecFile(outputs: Record<string, ExecOutput>): RepositoryExecFile {
  return (_file, args, _options, callback) => {
    const output = outputs[args.join(" ")];

    if (output === undefined) {
      callback(new Error(`Unexpected command: ${args.join(" ")}`), "", "");
      return;
    }

    if (typeof output === "string") {
      callback(null, output, "");
      return;
    }

    callback(output.error, "", output.stderr ?? "");
  };
}

async function createProjectRoot(config: unknown): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "github-triage-resolve-"));
  await writeFile(path.join(root, projectConfigFileName), JSON.stringify(config), "utf8");
  return root;
}

async function createIssueFixture(repository: { owner: string; name: string }): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "github-triage-fixture-"));
  const fixturePath = path.join(root, "issues.json");
  await writeFile(
    fixturePath,
    JSON.stringify({
      schemaVersion: 1,
      repository,
      labels: [],
      issues: [],
    }),
    "utf8",
  );
  return fixturePath;
}
