import { describe, expect, it } from "vitest";

import {
  detectGitHubRepository,
  parseGitHubRemoteUrl,
  type RepositoryExecFile,
} from "../src/repository/detect.js";

describe("parseGitHubRemoteUrl", () => {
  it.each([
    ["https://github.com/owner/repo.git"],
    ["https://github.com/owner/repo"],
    ["http://github.com/owner/repo.git"],
    ["git@github.com:owner/repo.git"],
    ["ssh://git@github.com/owner/repo.git"],
  ])("parses %s", (url) => {
    expect(parseGitHubRemoteUrl(url)).toEqual({
      owner: "owner",
      name: "repo",
    });
  });

  it.each([
    ["https://gitlab.com/owner/repo.git"],
    ["https://github.example.com/owner/repo.git"],
    ["https://github.com/owner/repo/issues"],
    ["git@example.com:owner/repo.git"],
    ["not-a-url"],
    ["https://github.com/owner/"],
  ])("rejects %s", (url) => {
    expect(parseGitHubRemoteUrl(url)).toBeNull();
  });
});

describe("detectGitHubRepository", () => {
  it("selects a parseable origin remote and exposes parsed remotes", async () => {
    const calls: ExecCall[] = [];
    const context = await detectGitHubRepository({
      cwd: "/work/project/packages/tool",
      execFile: createRepositoryExecFile(calls, {
        "rev-parse --show-toplevel": "/work/project\n",
        "remote -v": [
          "origin\thttps://github.com/owner/repo.git (fetch)",
          "origin\thttps://github.com/owner/repo.git (push)",
          "backup\thttps://example.com/owner/repo.git (fetch)",
        ].join("\n"),
      }),
    });

    expect(context).toEqual({
      root: "/work/project",
      remotes: [
        {
          name: "origin",
          url: "https://github.com/owner/repo.git",
          repo: {
            owner: "owner",
            name: "repo",
          },
        },
        {
          name: "backup",
          url: "https://example.com/owner/repo.git",
        },
      ],
      selected: {
        remoteName: "origin",
        remoteUrl: "https://github.com/owner/repo.git",
        repo: {
          owner: "owner",
          name: "repo",
        },
      },
    });
    expect(calls).toEqual([
      {
        file: "git",
        args: ["rev-parse", "--show-toplevel"],
        cwd: "/work/project/packages/tool",
      },
      {
        file: "git",
        args: ["remote", "-v"],
        cwd: "/work/project",
      },
    ]);
  });

  it("selects the only GitHub remote when origin is not parseable", async () => {
    const context = await detectGitHubRepository({
      execFile: createRepositoryExecFile([], {
        "rev-parse --show-toplevel": "/work/project\n",
        "remote -v": [
          "origin\tgit@example.com:owner/repo.git (fetch)",
          "upstream\tgit@github.com:owner/project.git (fetch)",
        ].join("\n"),
      }),
    });

    expect(context.selected).toEqual({
      remoteName: "upstream",
      remoteUrl: "git@github.com:owner/project.git",
      repo: {
        owner: "owner",
        name: "project",
      },
    });
  });

  it("fails with repo.detect-ambiguous for multiple non-origin GitHub remotes", async () => {
    await expect(
      detectGitHubRepository({
        execFile: createRepositoryExecFile([], {
          "rev-parse --show-toplevel": "/work/project\n",
          "remote -v": [
            "fork\thttps://github.com/owner/fork.git (fetch)",
            "upstream\thttps://github.com/owner/project.git (fetch)",
          ].join("\n"),
        }),
      }),
    ).rejects.toMatchObject({
      code: "repo.detect-ambiguous",
      exitCode: 2,
      message: expect.stringContaining("fork=owner/fork, upstream=owner/project"),
    });
  });

  it("fails with repo.detect-missing outside a git repository", async () => {
    await expect(
      detectGitHubRepository({
        execFile: createRepositoryExecFile([], {
          "rev-parse --show-toplevel": {
            error: new Error("fatal: not a git repository"),
            stderr: "fatal: not a git repository",
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "repo.detect-missing",
      exitCode: 2,
    });
  });

  it("fails with repo.detect-missing when no GitHub remote is configured", async () => {
    await expect(
      detectGitHubRepository({
        execFile: createRepositoryExecFile([], {
          "rev-parse --show-toplevel": "/work/project\n",
          "remote -v": "origin\tgit@example.com:owner/repo.git (fetch)\n",
        }),
      }),
    ).rejects.toMatchObject({
      code: "repo.detect-missing",
      exitCode: 2,
    });
  });

  it("maps unexpected git command failures to repo.git-failed", async () => {
    await expect(
      detectGitHubRepository({
        execFile: createRepositoryExecFile([], {
          "rev-parse --show-toplevel": "/work/project\n",
          "remote -v": {
            error: new Error("permission denied"),
            stderr: "permission denied",
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "repo.git-failed",
      exitCode: 1,
      details: "permission denied",
    });
  });
});

type ExecOutput =
  | string
  | {
      error: Error;
      stderr?: string;
    };

interface ExecCall {
  file: string;
  args: readonly string[];
  cwd?: string;
}

function createRepositoryExecFile(
  calls: ExecCall[],
  outputs: Record<string, ExecOutput>,
): RepositoryExecFile {
  return (file, args, options, callback) => {
    calls.push({
      file,
      args,
      ...(options.cwd ? { cwd: options.cwd } : {}),
    });

    const output = outputs[args.join(" ")];

    if (output === undefined) {
      callback(new Error(`Unexpected command: ${file} ${args.join(" ")}`), "", "");
      return;
    }

    if (typeof output === "string") {
      callback(null, output, "");
      return;
    }

    callback(output.error, "", output.stderr ?? "");
  };
}
