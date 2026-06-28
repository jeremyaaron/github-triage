import { execFile } from "node:child_process";

import { createUsageError, GithubTriageError } from "../core/errors.js";
import { parseRepoSlug, type RepoSlug } from "../core/schemas.js";

export interface RepositoryContext {
  root: string;
  remotes: GitRemote[];
  selected: DetectedGitHubRepository;
}

export interface GitRemote {
  name: string;
  url: string;
  repo?: RepoSlug;
}

export interface DetectedGitHubRepository {
  remoteName: string;
  remoteUrl: string;
  repo: RepoSlug;
}

export interface DetectRepositoryOptions {
  cwd?: string;
  execFile?: RepositoryExecFile;
}

export type RepositoryExecFile = (
  file: string,
  args: readonly string[],
  options: { cwd?: string },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => void;

interface GitCommandResult {
  stdout: string;
  stderr: string;
}

export async function detectGitHubRepository(
  options: DetectRepositoryOptions = {},
): Promise<RepositoryContext> {
  const runExecFile = options.execFile ?? execFile;
  const rootResult = await runGitCommand(runExecFile, ["rev-parse", "--show-toplevel"], {
    cwd: options.cwd,
    missingIsUsageError: true,
  });
  const root = rootResult.stdout.trim();

  if (!root) {
    throw createMissingRepositoryError();
  }

  const remoteResult = await runGitCommand(runExecFile, ["remote", "-v"], {
    cwd: root,
    missingIsUsageError: false,
  });
  const remotes = parseGitRemotes(remoteResult.stdout);
  const selected = selectGitHubRemote(remotes);

  return {
    root,
    remotes,
    selected,
  };
}

export function parseGitHubRemoteUrl(url: string): RepoSlug | null {
  const trimmed = url.trim();
  const scpLikeMatch = /^git@github\.com:([^/]+)\/(.+)$/.exec(trimmed);

  if (scpLikeMatch) {
    return parseRemoteRepoParts(scpLikeMatch[1], scpLikeMatch[2]);
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com") {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean);

  if (parts.length !== 2) {
    return null;
  }

  return parseRemoteRepoParts(parts[0], parts[1]);
}

function parseRemoteRepoParts(owner: string | undefined, repo: string | undefined): RepoSlug | null {
  if (!owner || !repo) {
    return null;
  }

  const normalizedRepo = repo.endsWith(".git") ? repo.slice(0, -4) : repo;

  try {
    return parseRepoSlug(`${owner}/${normalizedRepo}`);
  } catch {
    return null;
  }
}

function parseGitRemotes(output: string): GitRemote[] {
  const remotes = new Map<string, GitRemote>();

  for (const line of output.split(/\r?\n/)) {
    const match = /^(\S+)\s+(\S+)\s+\((fetch|push)\)$/.exec(line.trim());

    if (!match) {
      continue;
    }

    const name = match[1];
    const url = match[2];
    const direction = match[3];

    if (!name || !url || !direction) {
      continue;
    }

    const key = `${name}\0${url}`;

    if (direction === "push" && remotes.has(key)) {
      continue;
    }

    const repo = parseGitHubRemoteUrl(url);
    remotes.set(key, {
      name,
      url,
      ...(repo ? { repo } : {}),
    });
  }

  return [...remotes.values()];
}

function selectGitHubRemote(remotes: GitRemote[]): DetectedGitHubRepository {
  const githubRemotes = remotes.filter(isGitHubRemote);
  const origin = githubRemotes.find((remote) => remote.name === "origin");

  if (origin?.repo) {
    return {
      remoteName: origin.name,
      remoteUrl: origin.url,
      repo: origin.repo,
    };
  }

  if (githubRemotes.length === 1) {
    const remote = githubRemotes[0];

    if (!remote) {
      throw createMissingRepositoryError();
    }

    return {
      remoteName: remote.name,
      remoteUrl: remote.url,
      repo: remote.repo,
    };
  }

  if (githubRemotes.length > 1) {
    const choices = githubRemotes
      .map((remote) => `${remote.name}=${remote.repo?.owner}/${remote.repo?.name}`)
      .join(", ");

    throw createUsageError(
      "repo.detect-ambiguous",
      `Multiple GitHub remotes were found: ${choices}. Run "github-triage review owner/repo --since 30d" to choose explicitly.`,
      githubRemotes,
    );
  }

  throw createMissingRepositoryError();
}

function createMissingRepositoryError(): GithubTriageError {
  return createUsageError(
    "repo.detect-missing",
    'Could not infer a GitHub repository from this directory. Run "github-triage review owner/repo --since 30d" from any directory.',
  );
}

function isGitHubRemote(remote: GitRemote): remote is GitRemote & { repo: RepoSlug } {
  return remote.repo !== undefined;
}

async function runGitCommand(
  runExecFile: RepositoryExecFile,
  args: readonly string[],
  options: {
    cwd: string | undefined;
    missingIsUsageError: boolean;
  },
): Promise<GitCommandResult> {
  return await new Promise((resolve, reject) => {
    runExecFile("git", args, options.cwd ? { cwd: options.cwd } : {}, (error, stdout, stderr) => {
      if (!error) {
        resolve({ stdout, stderr });
        return;
      }

      if (options.missingIsUsageError && isNotGitRepository(stderr, error)) {
        reject(createMissingRepositoryError());
        return;
      }

      reject(
        new GithubTriageError({
          code: "repo.git-failed",
          message: `Git command failed: git ${args.join(" ")}`,
          exitCode: 1,
          cause: error,
          ...(stderr.trim() ? { details: stderr.trim() } : {}),
        }),
      );
    });
  });
}

function isNotGitRepository(stderr: string, error: Error): boolean {
  const text = `${stderr}\n${error.message}`.toLowerCase();
  return text.includes("not a git repository") || text.includes("not a git repo");
}
