import { execFile } from "node:child_process";

import { GithubTriageError } from "../core/errors.js";

export interface ResolveGitHubTokenOptions {
  env?: NodeJS.ProcessEnv;
  execFile?: ExecFile;
}

export type ExecFile = (
  file: string,
  args: readonly string[],
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => void;

export async function resolveGitHubToken(
  options: ResolveGitHubTokenOptions = {},
): Promise<string> {
  const env = options.env ?? process.env;
  const envToken = env["GITHUB_TOKEN"]?.trim();

  if (envToken) {
    return envToken;
  }

  const ghToken = await readGitHubCliToken(options.execFile ?? execFile);

  if (ghToken) {
    return ghToken;
  }

  throw new GithubTriageError({
    code: "github.auth-missing",
    message: "GitHub authentication is required. Set GITHUB_TOKEN or run `gh auth login`.",
    exitCode: 1,
  });
}

async function readGitHubCliToken(runExecFile: ExecFile): Promise<string | null> {
  return await new Promise((resolve) => {
    runExecFile("gh", ["auth", "token"], (error, stdout) => {
      if (error) {
        resolve(null);
        return;
      }

      const token = stdout.trim();
      resolve(token.length > 0 ? token : null);
    });
  });
}
