# github-triage v0.1.0 Technical Design

## Overview

`github-triage` v0.1.0 is a local, read-only TypeScript CLI that reviews issues for one
GitHub repository and writes Markdown and JSON triage reports.

The runtime workflow is:

```text
CLI args
  -> issue source (GitHub API or fixture file)
  -> normalized issue context
  -> duplicate candidate prepass
  -> AI triage workflow
  -> validated recommendation model
  -> Markdown and JSON reports
```

The product-facing workflow stays simple:

```sh
github-triage review jeremyaaron/pkg-guard --since 30d
```

The implementation should keep GitHub reads, AI analysis, report rendering, and regression
capture plumbing separated. That keeps v0.1.0 small enough to ship while leaving room for
future write modes, additional providers, or richer repository memory without rewriting
the MVP.

## Design Decisions

The v0.1.0 PRD left several choices open. This design resolves them as follows.

| Question | Decision |
| --- | --- |
| Initial model/provider | Use the OpenAI Responses API through the official `openai` npm package. Default model is configured by a single constant and can be overridden with `OPENAI_MODEL`; start with `gpt-5.5` unless implementation validation requires a cheaper or more broadly available model. |
| Model authentication | Read `OPENAI_API_KEY`. Do not support other providers in v0.1.0. |
| GitHub authentication | Prefer `GITHUB_TOKEN`. If absent, shell out to `gh auth token`. If neither works, fail with an actionable auth error. |
| GitHub API strategy | Use REST through `@octokit/rest`; fetch issues, labels, and a bounded set of comments. Avoid GraphQL in v0.1.0. |
| No-network input | Support `--issues-file <path>` as a fixture mode. When present, skip GitHub API calls and read normalized issue-source JSON from disk. |
| Default output directory | Write reports to `.github-triage/reports`. |
| Report filenames | Default to `<owner>-<repo>-<YYYYMMDD-HHmmssZ>.md` and `.json`. Support `--report-id <id>` for deterministic tests and repeatable fixture output. |
| Comments per issue | Fetch the latest 5 comments per issue by default. Support `--comments <n>` with an allowed range of `0..20`. |
| Duplicate scope | Compare only issues loaded for the current run. Do not search older issues in v0.1.0. |
| Confidence scale | Use `"low"`, `"medium"`, and `"high"` instead of numeric scores. |
| Internal tool contracts | Define triage decision tools with `tool-call-contract`; use them to validate captured AI tool calls and generated regression fixtures. |
| Capture behavior | Do not write raw AI traces by default. Add `--capture-dir <path>` for explicit local capture during dogfood and tests. |
| GitHub writes | No write API calls, no write scopes, and no mutation options in v0.1.0. |

## Runtime And Dependencies

The package should follow the existing portfolio conventions:

- Node.js `>=20.19.0`.
- TypeScript.
- ESM package output.
- npm as the package manager.
- Vitest for tests.
- ESLint for linting.
- `pkg-guard` in the release verification path.

Runtime dependencies:

- `@octokit/rest` for GitHub REST API access.
- `openai` for Responses API calls.
- `tool-call-contract` for internal tool contracts, validation, normalization, redaction,
  and generated regression tests.
- `zod` for runtime schemas and typed parsing.

Avoid a CLI framework in v0.1.0. The command surface is small enough for a focused manual
parser, matching the current style of `pkg-guard`.

Build scripts should be conventional:

```json
{
  "build": "tsc -p tsconfig.build.json && node scripts/mark-bin-executable.mjs",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "lint": "eslint .",
  "verify:release": "npm run lint && npm run typecheck && npm test && npm run build && pkg-guard check && npm pack --dry-run --ignore-scripts"
}
```

## CLI Surface

Ship one command:

```text
github-triage review <owner>/<repo> [options]
```

Supported options:

```text
--since <duration>        Review open issues created or updated since duration ago.
--output-dir <path>       Report output directory. Default: .github-triage/reports.
--format <format>         markdown, json, or all. Default: all.
--issues-file <path>      Read issue-source JSON from disk instead of GitHub.
--comments <count>        Latest comments per issue to fetch. Default: 5. Range: 0..20.
--report-id <id>          Deterministic report id used as output basename suffix.
--capture-dir <path>      Write raw and normalized AI captures for regression work.
--model <name>            Override OPENAI_MODEL for this run.
--json                    Print terminal summary as JSON.
--help                    Print help.
--version                 Print package version.
```

`--since` should support day-based durations in v0.1.0:

```text
7d
30d
90d
```

Hours, weeks, months, and ISO date strings are deferred. Invalid durations should fail
before any network or model calls.

`--issues-file` still requires `<owner>/<repo>` so reports have stable repository
metadata. The fixture file may override issue URLs and labels, but not the target repo
slug used in output paths.

### Exit Codes

Use a small, documented exit-code set:

| Code | Meaning |
| --- | --- |
| `0` | Review completed and requested reports were written. |
| `1` | Operational failure such as GitHub API error, model error, file IO error, or validation failure. |
| `2` | Usage error such as invalid args, invalid repo slug, or invalid duration. |

Triage findings never cause a non-zero exit. A security-sensitive issue is a report
result, not a process failure.

## Source Layout

Recommended module layout:

```text
src/
  index.ts
  cli/
    help.ts
    index.ts
    options.ts
    run.ts
  core/
    review.ts
    duration.ts
    errors.ts
    schemas.ts
    summary.ts
  github/
    auth.ts
    client.ts
    issues.ts
    types.ts
  analysis/
    analyzer.ts
    duplicate-candidates.ts
    prompt.ts
    recommendations.ts
    tool-contracts.ts
    trace-capture.ts
  reports/
    json.ts
    markdown.ts
    paths.ts
    terminal.ts
  fixtures/
    issue-source.ts
```

### `src/cli`

Owns command parsing, help text, exit codes, and top-level process behavior. It should not
know about GitHub response shapes or model prompts.

Recommended types:

```ts
export interface ReviewCliOptions {
  repo: RepoSlug;
  since: DurationWindow;
  outputDir: string;
  format: "markdown" | "json" | "all";
  issuesFile?: string;
  comments: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  jsonSummary: boolean;
}
```

### `src/core/review.ts`

Orchestrates the review:

1. Resolve source issues from GitHub or `--issues-file`.
2. Build duplicate candidate sets.
3. Analyze each issue.
4. Build the report model.
5. Write requested reports.
6. Return a terminal summary.

Proposed entrypoint:

```ts
export interface ReviewOptions {
  repo: RepoSlug;
  since: DurationWindow;
  outputDir: string;
  format: ReportFormat;
  issuesFile?: string;
  comments: number;
  reportId?: string;
  captureDir?: string;
  model?: string;
  clock?: () => Date;
}

export async function reviewRepository(options: ReviewOptions): Promise<ReviewResult>;
```

The optional `clock` exists for deterministic tests.

### `src/core/schemas.ts`

Owns Zod schemas for internal and report models. All AI output should be parsed through
these schemas before report rendering.

Keep schema names stable and boring:

```ts
export const repoSlugSchema = z.object({
  owner: z.string(),
  name: z.string(),
});

export const triageIssueSchema = z.object({ ... });
export const issueRecommendationSchema = z.object({ ... });
export const reviewReportSchema = z.object({ ... });
```

The schemas should be the single source of truth for JSON report rendering and fixture
validation.

## GitHub Integration

### Authentication

`github/auth.ts` should resolve a token in this order:

1. `GITHUB_TOKEN`
2. `gh auth token`

Do not print token values. If `gh` is unavailable, unauthenticated, or returns a non-zero
exit code, surface a concise message:

```text
GitHub authentication is required. Set GITHUB_TOKEN or run `gh auth login`.
```

The MVP should require authentication even for public repositories. This avoids surprising
rate-limit behavior and keeps issue/comment pagination predictable.

### REST Calls

Use `@octokit/rest` with a custom user agent:

```text
github-triage/0.1.0
```

Required requests:

- `GET /repos/{owner}/{repo}/issues`
- `GET /repos/{owner}/{repo}/labels`
- `GET /repos/{owner}/{repo}/issues/{issue_number}/comments`

Issue query:

```ts
{
  state: "open",
  since: sinceDate.toISOString(),
  per_page: 100,
  sort: "updated",
  direction: "desc"
}
```

Filter out pull requests by excluding any returned item with a `pull_request` field.

Fetch comments only after issue filtering. For each issue, request comments sorted by
creation order and keep the latest `options.comments` locally. If `comments` is `0`, skip
comment requests entirely.

### Normalized Source Model

Convert GitHub API responses immediately into a small internal model:

```ts
export interface SourceIssue {
  number: number;
  title: string;
  body: string;
  author: string;
  state: "open" | "closed";
  labels: SourceLabel[];
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  url: string;
  comments: SourceComment[];
}

export interface SourceLabel {
  name: string;
  color?: string;
  description?: string;
}

export interface SourceComment {
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}
```

The rest of the system should not consume raw Octokit response objects.

## Fixture Input

`--issues-file` should read a deterministic issue-source document:

```json
{
  "schemaVersion": 1,
  "repository": {
    "owner": "jeremyaaron",
    "name": "pkg-guard"
  },
  "labels": [
    {
      "name": "bug",
      "description": "Something is not working"
    }
  ],
  "issues": [
    {
      "number": 12,
      "title": "Exports map missing types",
      "body": "The package fails TypeScript resolution...",
      "author": "octocat",
      "state": "open",
      "labels": [],
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T00:00:00.000Z",
      "commentCount": 0,
      "url": "https://github.com/jeremyaaron/pkg-guard/issues/12",
      "comments": []
    }
  ]
}
```

Fixture input should use the same Zod schemas as GitHub-normalized data. This gives tests
a no-network path without introducing a second shape.

## Duplicate Candidate Prepass

Duplicate detection should be conservative and bounded.

Before AI analysis, build candidate lists from the loaded issue set:

1. Normalize title and body text to lowercase ASCII-ish tokens.
2. Remove short words and common stop words.
3. Weight title tokens higher than body tokens.
4. Compute simple overlap scores for each issue pair.
5. Keep the top 5 candidates per issue above a small threshold.

Proposed type:

```ts
export interface DuplicateCandidate {
  issueNumber: number;
  title: string;
  url: string;
  reason: string;
  score: number;
}
```

Only the top candidates should be included in the model prompt. The final report should
show duplicate relationships only when the model returns `likely-duplicate` or `related`
with at least medium confidence.

Do not call GitHub search in v0.1.0. Searching older open and closed issues belongs in a
future release after the basic workflow is proven.

## AI Analysis

### Provider Boundary

The OpenAI implementation should sit behind a small interface:

```ts
export interface IssueAnalyzer {
  analyzeIssue(input: AnalyzeIssueInput): Promise<IssueRecommendation>;
}

export interface AnalyzeIssueInput {
  repository: RepoSlug;
  repositoryLabels: SourceLabel[];
  issue: SourceIssue;
  duplicateCandidates: DuplicateCandidate[];
}
```

The v0.1.0 implementation is `OpenAIResponsesIssueAnalyzer`. Tests can use a fake
analyzer that returns deterministic recommendations.

### Model Configuration

Resolve the model in this order:

1. `--model`
2. `OPENAI_MODEL`
3. `DEFAULT_OPENAI_MODEL`

`DEFAULT_OPENAI_MODEL` should live in one module, for example:

```ts
export const DEFAULT_OPENAI_MODEL = "gpt-5.5";
```

If implementation validation shows the default model is unavailable or impractical for
routine local use, change only this constant before release. The CLI and tests should not
hard-code the model name elsewhere.

### Prompt Strategy

Analyze one issue per model call. This is less token-efficient than batch analysis, but it
has clearer failure isolation, simpler captures, and easier per-issue retries.

Each call should include:

- repository owner/name;
- existing repository labels;
- issue title/body/metadata;
- latest bounded comments;
- duplicate candidates from the prepass;
- triage taxonomy;
- instructions to stay conservative;
- instructions not to claim GitHub state changed;
- instructions to avoid public troubleshooting replies for security-sensitive issues.

Do not ask the model to fetch data, browse GitHub, or infer hidden repository history.

### Structured Tool Calls

Use `tool-call-contract` to define internal decision tools:

- `classify_issue`
- `suggest_labels`
- `find_duplicate`
- `request_reproduction`
- `draft_reply`
- `escalate_security`

These tools are not GitHub mutation tools. They are structured recommendation channels.
The application records the model's calls, validates their arguments, and composes the
final `IssueRecommendation`.

Recommended contract module:

```text
src/analysis/tool-contracts.ts
```

Example contract shape:

```ts
export const classifyIssueContract = defineToolContract({
  name: "classify_issue",
  description: "Classify a GitHub issue for maintainer triage.",
  parameters: z.object({
    classification: z.enum([
      "bug",
      "feature",
      "support",
      "documentation",
      "dependency",
      "security",
      "maintenance",
      "unclear",
    ]),
    confidence: confidenceSchema,
    rationale: z.string(),
  }),
});
```

The OpenAI adapter should export these contracts as provider tool definitions. It should
then normalize and validate returned tool calls using `tool-call-contract` before turning
them into the application recommendation model.

If the model omits a required decision tool, produce a per-issue warning and synthesize a
safe fallback:

- classification: `unclear`
- confidence: `low`
- no label suggestions;
- draft reply asking for clarification;
- security flag only from deterministic keyword precheck.

### Deterministic Security Precheck

Before calling the model, run a simple local precheck over title/body/comments for obvious
security indicators:

- `vulnerability`
- `exploit`
- `CVE`
- `token`
- `secret`
- `credential`
- `authentication bypass`
- `authorization bypass`
- `private disclosure`

The precheck does not determine the final recommendation, but it should be passed to the
prompt and used as a fallback if model analysis fails. Security-sensitive false positives
are acceptable in v0.1.0; missed obvious indicators are not.

## Recommendation Model

The application should compose validated tool calls into one recommendation per issue:

```ts
export type IssueClassification =
  | "bug"
  | "feature"
  | "support"
  | "documentation"
  | "dependency"
  | "security"
  | "maintenance"
  | "unclear";

export type Confidence = "low" | "medium" | "high";

export interface IssueRecommendation {
  issueNumber: number;
  classification: IssueClassification;
  confidence: Confidence;
  signals: RecommendationSignal[];
  suggestedLabels: LabelSuggestion[];
  missingInformation: MissingInformation[];
  relatedIssues: RelatedIssue[];
  draftReply: DraftReply | null;
  security: SecurityRecommendation;
  rationale: string;
  warnings: RecommendationWarning[];
}
```

Supporting types:

```ts
export interface LabelSuggestion {
  name: string;
  confidence: Confidence;
  rationale: string;
  exists: boolean;
}

export interface MissingInformation {
  kind:
    | "reproduction"
    | "expected-behavior"
    | "actual-behavior"
    | "version"
    | "runtime"
    | "operating-system"
    | "logs"
    | "minimal-reproduction";
  question: string;
}

export interface RelatedIssue {
  issueNumber: number;
  title: string;
  url: string;
  relationship: "likely-duplicate" | "related";
  confidence: Confidence;
  rationale: string;
}

export interface DraftReply {
  body: string;
  rationale: string;
}

export interface SecurityRecommendation {
  sensitive: boolean;
  confidence: Confidence;
  rationale: string;
  publicReplyAllowed: boolean;
}
```

All strings emitted by the model should be trimmed. Empty strings in required model fields
should fail validation.

## Reports

### JSON Report

The JSON report is the stable machine-readable artifact for v0.1.x.

Top-level shape:

```ts
export interface ReviewReport {
  schemaVersion: 1;
  repository: {
    owner: string;
    name: string;
  };
  generatedAt: string;
  reviewWindow: {
    since: string;
    sinceDate: string;
  };
  source: {
    kind: "github" | "fixture";
    issueCount: number;
    labelCount: number;
    commentsPerIssue: number;
  };
  summary: ReviewSummary;
  issues: ReportIssue[];
  warnings: ReportWarning[];
}
```

`generatedAt` is wall-clock time by default. Tests should inject `clock` and `reportId` to
make reports deterministic.

JSON rendering should use two-space indentation and a trailing newline.

### Markdown Report

The Markdown report should be rendered from the same `ReviewReport` object as JSON.

Required sections:

```text
# GitHub Triage Report: owner/repo

## Summary
## Security-Sensitive Issues
## Needs Maintainer Response
## Possible Duplicates And Related Issues
## Issue Recommendations
## Warnings
```

Per-issue entries should include:

- linked title;
- classification and confidence;
- current labels;
- suggested labels;
- missing information;
- related issues;
- draft reply in a fenced block;
- rationale;
- warnings.

Markdown should avoid saying changes were applied. Use wording such as "Suggested labels"
and "Draft reply".

### Terminal Summary

Default terminal output should be concise:

```text
Reviewed 12 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 2
Needs maintainer reply: 8
Missing reproduction: 4

Reports:
  .github-triage/reports/jeremyaaron-pkg-guard-20260627-153000Z.md
  .github-triage/reports/jeremyaaron-pkg-guard-20260627-153000Z.json
```

`--json` should print a small summary object, not the full report. The full report already
has a JSON file.

## Report Paths

Default report path plan:

```text
.github-triage/
  reports/
    jeremyaaron-pkg-guard-20260627-153000Z.md
    jeremyaaron-pkg-guard-20260627-153000Z.json
```

Basename format:

```text
<owner>-<repo>-<report-id>
```

Default `report-id`:

```text
YYYYMMDD-HHmmssZ
```

Validate explicit `--report-id` with:

```text
^[A-Za-z0-9._-]+$
```

This keeps paths shell-friendly and avoids accidental directory traversal.

## Capture And Regression Design

### Runtime Capture

`--capture-dir <path>` enables explicit capture output for AI calls. Without this option,
the CLI should not write raw model responses.

Recommended capture layout:

```text
captures/
  raw/
    clear-bug.json
  regression/
    clear-bug.json
```

For local dogfood runs:

1. Write raw OpenAI Responses payloads under `captures/raw`.
2. Normalize with `tool-call-contract normalize --format openai-responses`.
3. Redact with `tool-call-contract redact`.
4. Validate with `tool-call-contract validate`.
5. Generate Vitest regression tests with `tool-call-contract generate-tests`.

The repo should commit only redacted fixtures and generated regression tests. Raw captures
should be committed only when they are deliberately sanitized.

### Tool Contract Config

Add a `tool-call-contract.config.ts` during implementation with contracts from
`src/analysis/tool-contracts.ts`.

Recommended suite names:

```ts
export default defineConfig({
  contracts: triageToolContracts,
  captures: {
    raw: ["captures/raw/*.json"],
    regression: ["captures/regression/*.json"],
  },
  redaction: {
    paths: [
      "input.*.content",
      "output.*.content",
      "messages.*.content",
      "body",
      "comments.*.body",
      "author",
    ],
  },
});
```

Exact redaction paths should be validated against real OpenAI response captures during
implementation. The goal is to keep committed fixtures representative without preserving
personal data, access tokens, private issue text, or unnecessary prompt content.

### Regression Fixture Set

Add fixture cases for:

- clear bug report;
- vague bug report;
- feature request;
- duplicate report;
- support request;
- security-looking report;
- dependency/update issue;
- issue with missing reproduction steps.

Each fixture should include:

- issue-source JSON;
- expected report JSON snapshot or focused assertions;
- normalized tool-call capture fixture where useful.

Prefer focused assertions over large brittle snapshots for prose fields. Snapshot stable
schema structure and categorical decisions; assert draft replies for safety constraints
instead of exact wording where possible.

## Error Handling

Use typed operational errors rather than throwing raw library errors through the CLI.

Recommended type:

```ts
export class GithubTriageError extends Error {
  readonly code: string;
  readonly exitCode: 1 | 2;
  readonly details?: unknown;
}
```

Initial error codes:

```text
cli.invalid-command
cli.invalid-repo
cli.invalid-duration
cli.invalid-format
cli.invalid-comments
cli.invalid-report-id
github.auth-missing
github.repo-not-found
github.rate-limited
github.api-failed
fixture.invalid-json
fixture.invalid-shape
analysis.auth-missing
analysis.model-failed
analysis.output-invalid
report.write-failed
```

Human errors should be concise and actionable. JSON summary errors can include `code`,
`message`, and optional `details`.

## Testing Strategy

### Unit Tests

Add focused unit tests for:

- repo slug parsing;
- duration parsing;
- report-id validation;
- output path generation;
- GitHub response normalization;
- fixture-file parsing;
- duplicate candidate scoring;
- security precheck;
- recommendation schema validation;
- Markdown rendering;
- JSON rendering;
- CLI option parsing.

### Integration Tests

Use fixture input and fake analyzers to test the full review flow without network or
model calls:

```text
fixture issue source
  -> reviewRepository(...)
  -> JSON report
  -> Markdown report
  -> terminal summary
```

These tests should verify that report files are written correctly and that operational
failures return the expected typed error.

### Contract Tests

Use `tool-call-contract` to validate representative captured tool calls for each internal
decision tool.

Generated regression tests should run as part of `npm test` once capture fixtures exist.
Do not require live OpenAI or GitHub credentials for the default test suite.

### Manual Smoke Tests

Before v0.1.0 release, run:

```sh
npm run build
node dist/cli/index.js review jeremyaaron/tool-call-contract --since 30d
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d
npm run verify:release
```

Live smoke tests require `GITHUB_TOKEN` or `gh auth login` and `OPENAI_API_KEY`.

## Documentation

Initial docs should include:

- README quick start.
- Required environment variables.
- Read-only behavior guarantee.
- Example Markdown/JSON report paths.
- Fixture-mode usage for local testing.
- Explanation that suggestions are not applied to GitHub.
- Contributor notes for capture/regression workflows.

User-facing docs should not position the product around `tool-call-contract`. Contributor
docs may explain how internal tool contracts and captures keep the assistant testable.

## Security And Privacy

- Never request GitHub write scopes.
- Never print GitHub or OpenAI tokens.
- Do not write raw model captures unless `--capture-dir` is explicitly set.
- Redact committed captures.
- Treat issue bodies and comments as user content.
- Do not send more issue context to the model than needed for triage.
- Flag security-looking issues conservatively.
- Avoid draft replies that reproduce exploit instructions, secrets, or private details.

## Future Extensions

Explicitly defer:

- GitHub write modes for labels or comments.
- GitHub Actions or GitHub App execution.
- Multi-repo review.
- Historical duplicate search across closed issues.
- Embedding-backed repository memory.
- Non-OpenAI providers.
- Pull request review.
- Organization dashboards.
- Config files for project-specific label policies.

The v0.1.0 module boundaries should make these possible later, but no future extension
should complicate the first read-only CLI.
