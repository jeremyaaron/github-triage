# github-triage v0.2.0 Technical Design

## Overview

`github-triage` v0.2.0 changes the product from a source-checkout MVP into a
project-local CLI that can be run from the repository being triaged.

The primary workflow becomes:

```sh
npx github-triage review --since 30d
```

When the repository argument is omitted, the CLI detects the current GitHub repository
from local git remotes. The existing explicit form remains supported:

```sh
github-triage review jeremyaaron/pkg-guard --since 30d
```

The runtime workflow becomes:

```text
CLI args
  -> optional git repository context
  -> optional project config
  -> resolved review options
  -> issue source (GitHub API or fixture file)
  -> duplicate candidate prepass
  -> AI triage workflow
  -> validated recommendation model
  -> terminal output
  -> optional Markdown/JSON reports
```

The main implementation theme is keeping the current v0.1.0 analysis pipeline intact
while improving the entrypoint, output defaults, and package-consumer workflow.

## Design Decisions

| Question | Decision |
| --- | --- |
| Primary v0.2 command | Support `github-triage review --since 30d` from inside a GitHub repository. |
| Explicit repo compatibility | Keep `github-triage review owner/repo --since 30d`. |
| Repository inference source | Use local git metadata only: `git rev-parse --show-toplevel` and `git remote -v`. Do not call `gh repo view` in v0.2.0. |
| Remote preference | Prefer a parseable GitHub `origin` remote. If no parseable `origin` exists and exactly one GitHub remote exists, use that. Otherwise fail with choices. Do not try to infer fork/upstream relationships. |
| Report option name | Add `--report <none|markdown|json|all>`. Default is `none`. Keep `--format <markdown|json|all>` as a deprecated compatibility alias for `--report`. |
| Terminal JSON | Keep `--json` as terminal-output JSON, not report JSON. Include summary, compact issue rows, and report paths in that JSON. |
| File report default | Default to terminal-only. Markdown/JSON files are written only when `--report` or config requests them. |
| Project config | Include minimal `.github-triage.json` support in v0.2.0. CLI flags override config. Config must not contain secrets. |
| Fixture repo identity | If `--issues-file` is used and no repo argument is provided, prefer detected repo; if detection is unavailable, use the fixture document's `repository` field. |
| GitHub writes | Remain out of scope. v0.2.0 stays read-only. |

## Runtime And Dependencies

No new runtime dependencies are required.

Continue using:

- Node.js `>=20.19.0`;
- TypeScript and ESM output;
- `@octokit/rest`;
- `openai`;
- `tool-call-contract`;
- `zod`;
- Vitest;
- ESLint;
- `pkg-guard`.

Repository detection should use Node's built-in `child_process.execFile` with an injected
test seam, following the existing `github/auth.ts` pattern.

## CLI Surface

### Commands

```text
github-triage review [owner/repo] [options]
github-triage --help
github-triage --version
```

`owner/repo` becomes optional for `review`.

### Options

```text
--since <duration>        Review open issues created or updated since duration ago.
--report <format>         none, markdown, json, or all. Default: none.
--format <format>         Deprecated alias for --report, except "none" is not accepted.
--output-dir <path>       Report output directory. Default: .github-triage/reports.
--issues-file <path>      Read issue-source JSON from disk instead of GitHub.
--comments <count>        Latest comments per issue to fetch. Default: 5. Range: 0..20.
--report-id <id>          Deterministic report id used as output basename suffix.
--capture-dir <path>      Write raw and normalized AI captures for regression work.
--model <name>            Override OPENAI_MODEL for this run.
--json                    Print terminal output as JSON.
--help                    Print help.
--version                 Print package version.
```

### Option Compatibility

v0.1.0 used `--format` for report artifacts and defaulted to `all`. v0.2.0 should:

- accept `--format markdown`, `--format json`, and `--format all`;
- map those values to `report`;
- reject `--format none` with `cli.invalid-format`;
- document `--report` as the preferred option;
- update tests to cover both names;
- avoid adding a runtime warning in v0.2.0 because the current CLI result object has no
  warning channel and the README can carry the migration note.

### Parsed Option Model

Current `parseCliArgs` is synchronous and returns fully resolved `ReviewCliOptions`.
Repository inference and config loading require IO, so v0.2.0 should split parsing from
resolution.

Recommended types:

```ts
export interface ParsedReviewArgs {
  repo?: RepoSlug;
  since?: string;
  report?: ReportArtifactFormat;
  outputDir?: string;
  issuesFile?: string;
  comments?: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  jsonSummary: boolean;
}

export interface ReviewCliOptions {
  repo: RepoSlug;
  since: DurationWindow;
  outputDir: string;
  report: ReportArtifactFormat;
  issuesFile?: string;
  comments: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  jsonSummary: boolean;
  projectRoot?: string;
}
```

`parseCliArgs` should still validate syntactic option values where possible, but it should
allow `review --since 30d` without a repo argument.

`runCli` should call a new async resolver before invoking `reviewRepositoryFromCli`:

```ts
const parsed = parseCliArgs(args, now);
const options = await resolveReviewCliOptions(parsed.args, dependencies);
```

## Repository Detection

Add a new module:

```text
src/repository/
  detect.ts
```

### Public API

```ts
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
  execFile?: ExecFile;
}

export async function detectGitHubRepository(
  options?: DetectRepositoryOptions,
): Promise<RepositoryContext>;

export function parseGitHubRemoteUrl(url: string): RepoSlug | null;
```

### Git Commands

Use:

```sh
git rev-parse --show-toplevel
git remote -v
```

`git rev-parse --show-toplevel` finds the repository root from nested directories.

`git remote -v` returns remotes and URLs. Parse both fetch and push rows, de-duplicate by
remote name and URL, and prefer fetch rows when both exist.

### Remote URL Parsing

Support:

```text
https://github.com/owner/repo.git
https://github.com/owner/repo
http://github.com/owner/repo.git
git@github.com:owner/repo.git
ssh://git@github.com/owner/repo.git
```

Do not support GitHub Enterprise hosts in v0.2.0. That can be added later through config.

Normalize:

- strip a trailing `.git`;
- require exactly two path components after `github.com`;
- validate owner and repo through existing `repoSlugSchema` or `parseRepoSlug`;
- reject empty owner/repo values.

### Selection Rules

1. If no git root is found, throw `repo.detect-missing`.
2. Parse all GitHub remotes.
3. If a parseable `origin` remote exists, select it.
4. If no parseable `origin` exists and exactly one parseable GitHub remote exists, select
   it.
5. If multiple parseable remotes remain, throw `repo.detect-ambiguous` and include
   `name=owner/repo` choices.
6. If no parseable GitHub remote exists, throw `repo.detect-missing`.

### Error Codes

Extend `GithubTriageErrorCode` with:

```ts
| "repo.detect-missing"
| "repo.detect-ambiguous"
| "repo.git-failed"
```

Use exit code `2` for missing or ambiguous repository detection because the user can fix
the invocation. Use exit code `1` only for unexpected git command failures that are not
ordinary "not a git repo" cases.

## Project Configuration

Add a new module:

```text
src/config/
  project-config.ts
```

### Config File

Filename:

```text
.github-triage.json
```

Location:

- only the detected git repository root;
- do not search parent directories outside the git root;
- do not load config when no project root is available.

Schema:

```ts
export const projectConfigSchema = z.object({
  since: z.string().optional(),
  comments: z.number().int().min(0).max(20).optional(),
  report: z.enum(["none", "markdown", "json", "all"]).optional(),
  outputDir: z.string().min(1).optional(),
  reportId: z.string().optional(),
  model: z.string().min(1).optional(),
});
```

Do not support secrets in config. Do not support `captureDir` in config; it remains an
explicit contributor/testing flag.

### Precedence

Apply values in this order:

1. CLI flags;
2. `.github-triage.json`;
3. defaults.

Defaults:

```ts
{
  report: "none",
  outputDir: ".github-triage/reports",
  comments: 5,
  jsonSummary: false
}
```

`since` is required from either CLI or config.

### Config Errors

Extend `GithubTriageErrorCode` with:

```ts
| "config.invalid-json"
| "config.invalid-shape"
```

Invalid config is a usage error with exit code `2`.

## Review Option Resolution

Add a resolver that combines parsed args, repository detection, fixture metadata, config,
and defaults:

```text
src/cli/
  resolve-options.ts
```

Recommended API:

```ts
export interface ResolveReviewOptionsDependencies {
  now?: Date;
  cwd?: string;
  execFile?: ExecFile;
}

export async function resolveReviewCliOptions(
  parsed: ParsedReviewArgs,
  dependencies?: ResolveReviewOptionsDependencies,
): Promise<ReviewCliOptions>;
```

Resolution order:

1. If `parsed.repo` exists, use it as the repository.
2. Otherwise, try `detectGitHubRepository`.
3. If detection fails and `parsed.issuesFile` exists, read the fixture file and use its
   `repository`.
4. If detection fails without `issuesFile`, surface the detection error.
5. If a repository context exists, load `.github-triage.json` from its root.
6. Merge config and CLI values.
7. Validate `since`.
8. Validate `reportId` from config if present.
9. Return fully resolved `ReviewCliOptions`.

For explicit `owner/repo` invocations, repository detection should still run only when it
is needed for project config. If git detection fails for an explicit repo, continue
without config. This keeps cross-repository review from arbitrary directories working.

## Report Output

### Types

Replace or extend the existing report format type:

```ts
export type ReportArtifactFormat = "none" | "markdown" | "json" | "all";
```

`planReportPaths` should accept `none` and return an empty `files` array with no
`markdownPath` or `jsonPath`.

### Review Flow

`reviewRepository` should write reports only when `paths.files.length > 0`.

For default v0.2.0 usage:

```ts
report: "none"
```

the review still returns a full in-memory `ReviewReport`, but no `.github-triage/reports`
directory is created.

### Backward Compatibility

Existing tests and code that use `format: "all"` should be migrated to `report: "all"`.

To reduce churn during implementation, the code may temporarily keep the field name
`format` and extend it to include `"none"`, but the public CLI and docs should use
`report`. The final code should prefer `report` for clarity.

## Terminal Output

`reports/terminal.ts` should become more useful by default.

### Plain Text

Render:

1. summary header;
2. aggregate counts;
3. compact issue rows;
4. report paths only when files exist.

Recommended row fields:

- issue number;
- classification;
- primary status flag;
- suggested label names.

Primary status flag selection:

1. `security: avoid public reply` when `security.sensitive` is true and
   `publicReplyAllowed` is false;
2. `security review` when `security.sensitive` is true;
3. `likely duplicate` when any related issue has relationship `likely-duplicate`;
4. `needs reproduction` when missing information includes `reproduction` or
   `minimal-reproduction`;
5. `needs reply` when `draftReply` is present;
6. `ready for review` otherwise.

Example:

```text
Reviewed 3 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 1
Needs maintainer reply: 2
Missing reproduction: 1

Issues:
  #42 bug       needs reproduction   labels: bug, needs reproduction
  #43 feature   needs reply          labels: enhancement
  #44 security  avoid public reply   labels: security
```

Keep formatting plain ASCII. Do not add color in v0.2.0; color can be revisited when
there are snapshot-stable formatting tests.

### Terminal JSON

`--json` should render a compact terminal object:

```json
{
  "repository": "jeremyaaron/pkg-guard",
  "issueCount": 3,
  "securitySensitive": 1,
  "likelyDuplicates": 1,
  "needsMaintainerReply": 2,
  "missingReproduction": 1,
  "issues": [
    {
      "number": 42,
      "title": "Crash on install",
      "classification": "bug",
      "status": "needs reproduction",
      "labels": ["bug", "needs reproduction"],
      "url": "https://github.com/jeremyaaron/pkg-guard/issues/42"
    }
  ],
  "reports": []
}
```

This output is not a replacement for the full JSON report. Full report JSON remains
available with `--report json` or `--report all`.

## Source Layout Changes

Add:

```text
src/
  cli/
    resolve-options.ts
  config/
    project-config.ts
  repository/
    detect.ts
```

Update:

```text
src/cli/options.ts
src/cli/run.ts
src/cli/help.ts
src/core/errors.ts
src/core/review.ts
src/reports/paths.ts
src/reports/terminal.ts
src/index.ts
```

Add tests:

```text
tests/repository-detect.test.ts
tests/project-config.test.ts
tests/cli-resolve-options.test.ts
```

Update tests:

```text
tests/cli-options.test.ts
tests/cli-run.test.ts
tests/report-paths.test.ts
tests/report-rendering.test.ts
tests/review-github.test.ts
tests/review-offline.test.ts
tests/regression-fixtures.test.ts
```

## Authentication

No authentication behavior changes.

GitHub token resolution remains:

1. `GITHUB_TOKEN`;
2. `gh auth token`;
3. fail with `github.auth-missing`.

OpenAI token resolution remains:

1. `OPENAI_API_KEY`;
2. fail with `analysis.auth-missing`.

The improved workflow does not imply any new write permissions. GitHub tokens still need
only read access for public issue metadata.

## Read-Only Guarantee

v0.2.0 may read:

- CLI args;
- git root and remotes;
- `.github-triage.json`;
- issue fixture files;
- GitHub issues, labels, and comments;
- OpenAI model responses.

v0.2.0 may write:

- terminal output;
- optional local reports under the requested output directory;
- explicit capture files only when `--capture-dir` is provided.

v0.2.0 must not:

- stage, commit, or modify repository source files;
- post GitHub comments;
- apply labels;
- close, edit, assign, transfer, or lock issues;
- change repository settings;
- push changes.

## README And Contributor Docs

Update README around consumer-project usage:

```sh
npx github-triage review --since 30d
```

and pinned usage:

```json
{
  "scripts": {
    "triage": "github-triage review --since 30d"
  },
  "devDependencies": {
    "github-triage": "^0.2.0"
  }
}
```

Document:

- implicit repo detection;
- explicit repo override;
- supported GitHub remote URL formats;
- `--report` output artifacts;
- `.github-triage.json`;
- auth requirements;
- read-only behavior;
- troubleshooting `repo.detect-missing` and `repo.detect-ambiguous`.

Update contributor notes with:

- repository detection test strategy;
- config precedence;
- report default change from v0.1.0;
- release smoke commands from a separate fixture repository when credentials are
  available.

## Testing Strategy

### Unit Tests

Repository detection:

- parses supported HTTPS and SSH remote formats;
- rejects non-GitHub URLs;
- strips `.git`;
- selects `origin` when present;
- selects the only GitHub remote when `origin` is absent;
- fails on multiple non-origin GitHub remotes;
- fails outside a git repo.

Config:

- absent config returns empty config;
- valid config parses;
- invalid JSON fails with `config.invalid-json`;
- invalid shape fails with `config.invalid-shape`;
- CLI values override config values.

CLI:

- parses `review --since 30d`;
- parses explicit `review owner/repo --since 30d`;
- parses `--report none|markdown|json|all`;
- maps `--format markdown|json|all` to report values;
- rejects invalid report values;
- resolves repo from git when omitted;
- resolves repo from fixture when omitted and no git repo is available;
- preserves explicit repo when provided.

Reports:

- `report: "none"` writes no files and does not create an output directory;
- `report: "all"` writes Markdown and JSON;
- terminal output includes compact issue rows;
- terminal JSON includes compact issue rows and report paths.

Regression:

- existing regression captures still validate;
- fixture review tests pass with `report: "all"` where files are asserted;
- default review tests assert no report paths are printed unless reports are requested.

### Manual Smoke

With credentials:

```sh
npm run build
node dist/cli/index.js review --since 30d
node dist/cli/index.js review --since 30d --report all --report-id smoke
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d
npm run verify:release
```

Run the implicit commands from a GitHub-backed repository whose `origin` points to the
target repo.

## Migration Notes

v0.1.0:

```sh
github-triage review owner/repo --since 30d
```

still works in v0.2.0.

The visible default changes from "write Markdown and JSON reports" to "print terminal
output only." Users who want v0.1.0-style files should run:

```sh
github-triage review owner/repo --since 30d --report all
```

or add:

```json
{
  "report": "all"
}
```

to `.github-triage.json`.

## Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Inferring `origin` chooses a fork instead of upstream | Prefer explicit, documented behavior. Users can pass `owner/repo` directly. Do not invent fork detection in v0.2.0. |
| Changing default report generation surprises v0.1 users | Keep `--format` alias, document `--report all`, and note the change in README/CHANGELOG. |
| Config loading makes explicit cross-repo review surprising | Only load config from detected current repo. If explicit repo is provided and no repo root is found, continue without config. |
| Terminal rows become too wide | Keep rows compact and use comma-separated labels. Avoid draft reply snippets in terminal output. |
| Repository detection is hard to test | Keep git execution behind an injected `execFile` and expose pure `parseGitHubRemoteUrl`. |

## Deferred Work

- GitHub Enterprise host support.
- `--remote <name>` or config-based remote selection.
- `gh repo view` fallback.
- Colorized terminal output.
- Interactive terminal review.
- GitHub Action.
- GitHub App.
- VS Code extension.
- Write-capable apply commands.
