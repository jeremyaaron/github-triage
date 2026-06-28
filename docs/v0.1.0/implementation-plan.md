# github-triage v0.1.0 Implementation Plan

## Purpose

This plan breaks the v0.1.0 PRD and technical design into phases sized for one focused
Codex implementation turn. Each phase should leave the repository buildable, tested, and
easy to review.

v0.1.0 ships a local, read-only GitHub issue triage CLI:

- one `github-triage review <owner>/<repo>` command;
- fixture-mode input for no-network development and tests;
- GitHub REST issue collection;
- OpenAI Responses API analysis;
- structured recommendations;
- Markdown and JSON reports;
- explicit capture support for internal regression work;
- no GitHub mutation behavior.

The release should stay narrow. The MVP is a maintainer review assistant, not a GitHub
bot, hosted dashboard, multi-repo analytics system, or write automation layer.

## Phase Sizing

A phase should usually fit in one focused implementation pass when:

- it changes one primary subsystem;
- it has direct tests;
- it keeps default tests free of live GitHub or OpenAI credentials;
- it avoids mixing code implementation with broad product scope changes;
- it leaves `npm test`, `npm run typecheck`, and targeted tests in a meaningful state.

If a phase starts touching CLI parsing, GitHub pagination, OpenAI prompts, report
rendering, and capture generation at once, split it before continuing.

## Phase 0: Project Scaffold

Goal: create the TypeScript CLI package foundation without product behavior.

Scope:

- Add `package.json` for the unscoped `github-triage` package and `github-triage` binary.
- Add npm scripts:
  - `build`;
  - `typecheck`;
  - `test`;
  - `lint`;
  - `verify:release`.
- Add TypeScript config files.
- Add ESLint config.
- Add Vitest config if needed.
- Add `src/index.ts`.
- Add `src/cli/index.ts` with a minimal binary entrypoint.
- Add `scripts/mark-bin-executable.mjs`.
- Add initial `.gitignore`.
- Add dependencies and dev dependencies from the technical design.
- Update README with a short placeholder matching the approved positioning.

Out of scope:

- Real CLI parsing.
- GitHub access.
- OpenAI access.
- Report generation.
- `tool-call-contract` configuration.

Acceptance criteria:

- `npm install` succeeds.
- `npm run build` produces `dist`.
- `node dist/cli/index.js --version` or an equivalent placeholder command works.
- `npm run typecheck` passes.
- `npm test` passes with at least one smoke test.

Suggested commands:

```sh
npm install
npm run build
npm run typecheck
npm test
```

Status:

- Completed on 2026-06-28.
- Added the initial npm package scaffold for `github-triage` v0.1.0.
- Added TypeScript, ESLint, Vitest, build, typecheck, test, lint, and release verification
  plumbing.
- Added the initial `github-triage` binary entrypoint with placeholder help and
  `--version` support.
- Added `scripts/mark-bin-executable.mjs`.
- Added `.gitignore`.
- Added a README placeholder matching the approved local, read-only maintainer-assistant
  positioning.
- Added one scaffold smoke test.
- `npm install` completed successfully and created `package-lock.json`.
- `npm run build` passed.
- `npm run typecheck` passed.
- `npm test` passed: 1 test in 1 test file.
- `npm run lint` passed.
- `node dist/cli/index.js --version` printed `0.1.0`.

## Phase 1: Core Types, Schemas, And Errors

Goal: add the core data model and validation helpers without IO or network behavior.

Scope:

- Add `src/core/schemas.ts`.
- Add `src/core/errors.ts`.
- Add `src/core/duration.ts`.
- Define Zod schemas and TypeScript types for:
  - repo slugs;
  - duration windows;
  - source labels;
  - source comments;
  - source issues;
  - issue-source fixture documents;
  - recommendation confidence;
  - issue classifications;
  - missing information;
  - related issues;
  - security recommendations;
  - issue recommendations;
  - review reports.
- Add `GithubTriageError` with documented error codes and exit codes.
- Implement parsing for repo slugs.
- Implement parsing for day-based durations such as `7d`, `30d`, and `90d`.
- Implement report-id validation.
- Add unit tests for schemas, repo parsing, duration parsing, report-id validation, and
  typed errors.

Out of scope:

- CLI option parsing.
- File reading.
- Report rendering.
- GitHub normalization.
- AI analysis.

Acceptance criteria:

- Invalid repo slugs, durations, report ids, and fixture shapes fail with stable errors.
- All schemas are exported from one internal module for later phases.
- No live credentials or network are required.
- Typecheck passes.

Suggested commands:

```sh
npm test -- tests/core-schemas.test.ts tests/duration.test.ts tests/errors.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Added `src/core/schemas.ts` with Zod schemas and exported TypeScript types for repo
  slugs, duration windows, source issues, fixture documents, recommendations, review
  summaries, report warnings, report issues, and full review reports.
- Added `src/core/errors.ts` with `GithubTriageError`, stable error codes, exit codes,
  usage-error helper, and typed-error detection.
- Added `src/core/duration.ts` with day-based duration parsing for values such as `7d`,
  `30d`, and `90d`.
- Added `parseRepoSlug` and `parseReportId` validation helpers.
- Exported the Phase 1 core helpers, schemas, and types from `src/index.ts`.
- Added unit tests for schemas, repo parsing, duration parsing, report-id validation, and
  typed errors.
- `npm test -- tests/core-schemas.test.ts tests/duration.test.ts tests/errors.test.ts`
  passed: 14 tests across 3 test files.
- `npm run typecheck` passed.
- `npm test` passed: 15 tests across 4 test files.
- `npm run build` passed.
- `npm run lint` passed.

## Phase 2: Report Paths And Renderers

Goal: render deterministic Markdown and JSON reports from an already-built report model.

Scope:

- Add `src/reports/paths.ts`.
- Add `src/reports/json.ts`.
- Add `src/reports/markdown.ts`.
- Add `src/reports/terminal.ts`.
- Implement default output directory `.github-triage/reports`.
- Implement default report id generation:
  - `YYYYMMDD-HHmmssZ`.
- Implement explicit `--report-id` basename behavior.
- Implement report path planning for:
  - Markdown only;
  - JSON only;
  - all formats.
- Implement deterministic JSON rendering:
  - two-space indentation;
  - trailing newline.
- Implement Markdown sections:
  - summary;
  - security-sensitive issues;
  - needs maintainer response;
  - possible duplicates and related issues;
  - per-issue recommendations;
  - warnings.
- Implement terminal human summary.
- Implement terminal JSON summary.
- Add unit tests for path planning, JSON rendering, Markdown rendering, and terminal
  summaries.

Out of scope:

- Writing files.
- CLI parsing.
- Review orchestration.
- Recommendation generation.

Acceptance criteria:

- Renderers consume only the `ReviewReport` model.
- Markdown never implies that GitHub was changed.
- JSON output is deterministic.
- Report paths cannot escape the configured output directory through report id input.

Suggested commands:

```sh
npm test -- tests/report-paths.test.ts tests/report-rendering.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Added `src/reports/paths.ts` with default output directory, UTC report-id generation,
  explicit report-id validation, and Markdown/JSON/all path planning.
- Added `src/reports/json.ts` with deterministic two-space JSON rendering and trailing
  newline.
- Added `src/reports/markdown.ts` with report sections for summary, security-sensitive
  issues, maintainer responses, duplicate/related issues, per-issue recommendations, and
  warnings.
- Added `src/reports/terminal.ts` with human and JSON terminal summaries.
- Exported the Phase 2 report helpers and types from `src/index.ts`.
- Added report path and rendering unit tests.
- `npm test -- tests/report-paths.test.ts tests/report-rendering.test.ts` passed: 11
  tests across 2 test files.
- `npm run typecheck` passed.
- `npm test` passed: 26 tests across 6 test files.
- `npm run build` passed.
- `npm run lint` passed.

## Phase 3: CLI Parsing And Help

Goal: implement the `github-triage review` command surface without doing real review work.

Scope:

- Add `src/cli/options.ts`.
- Add `src/cli/help.ts`.
- Add `src/cli/run.ts`.
- Parse:
  - `review <owner>/<repo>`;
  - `--since`;
  - `--output-dir`;
  - `--format`;
  - `--issues-file`;
  - `--comments`;
  - `--report-id`;
  - `--capture-dir`;
  - `--model`;
  - `--json`;
  - `--help`;
  - `--version`.
- Validate option combinations and values.
- Map usage errors to exit code `2`.
- Map operational errors to exit code `1`.
- Keep command execution behind an injectable `reviewRepository` dependency so tests can
  avoid network/model calls.
- Add CLI tests for:
  - help;
  - version;
  - valid review invocation;
  - invalid command;
  - invalid repo slug;
  - invalid duration;
  - invalid format;
  - invalid comments count;
  - invalid report id;
  - `--json` summary behavior.

Out of scope:

- Reading fixture files.
- GitHub access.
- Real report writing.
- Model analysis.

Acceptance criteria:

- CLI usage errors are deterministic and actionable.
- `reviewRepository` is called with parsed, typed options for valid invocations.
- `--comments` accepts only `0..20`.
- `--format` accepts only `markdown`, `json`, or `all`.
- Typecheck passes.

Suggested commands:

```sh
npm test -- tests/cli-options.test.ts tests/cli-run.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Added `src/cli/options.ts` with parsing and validation for `review <owner>/<repo>`,
  `--since`, `--output-dir`, `--format`, `--issues-file`, `--comments`, `--report-id`,
  `--capture-dir`, `--model`, `--json`, `--help`, and `--version`.
- Added `src/cli/help.ts` with user-facing command help.
- Added `src/cli/run.ts` with injectable review execution, stdout/stderr/exit-code
  results, usage-error mapping to exit code `2`, and operational-error mapping to exit
  code `1`.
- Updated `src/cli/index.ts` to adapt `runCli` to the Node process.
- Added `src/version.ts` to keep package version access out of CLI/index circular imports.
- Exported Phase 3 CLI helpers and types from `src/index.ts`.
- Added CLI option and run tests covering help, version, valid review parsing, invalid
  command, invalid repo slug, invalid duration, invalid format, invalid comments count,
  invalid report id, `--json` propagation, and review error mapping.
- `npm test -- tests/cli-options.test.ts tests/cli-run.test.ts` passed: 17 tests across
  2 test files.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm run lint` passed.
- `npm test` passed: 43 tests across 8 test files.
- `node dist/cli/index.js --version` printed `0.1.0`.
- `node dist/cli/index.js --help` printed the review command help.
- `node dist/cli/index.js review owner/repo --since 30d` returned exit code `1` with the
  expected placeholder operational error until Phase 4 implements review execution.

## Phase 4: Fixture Input And Offline Review Orchestration

Goal: make the full review pipeline work offline using `--issues-file` and a fake
analyzer.

Scope:

- Add `src/fixtures/issue-source.ts`.
- Add `src/core/review.ts`.
- Add `src/core/summary.ts`.
- Read and validate issue-source JSON files.
- Add injectable analyzer support:
  - production analyzer later;
  - fake analyzer for tests.
- Build a `ReviewReport` from:
  - repo slug;
  - duration window;
  - fixture source metadata;
  - source issues;
  - fake recommendations.
- Write requested report files to disk.
- Return terminal summary data to CLI.
- Wire CLI `review` to `reviewRepository`.
- Add integration tests that run:
  - fixture source;
  - fake analyzer;
  - report writing;
  - terminal summary.

Out of scope:

- GitHub API source.
- Duplicate scoring.
- Security precheck.
- OpenAI.
- Tool-call contracts.

Acceptance criteria:

- `github-triage review owner/repo --issues-file fixture.json --report-id test` writes
  Markdown and JSON reports.
- Fixture input uses the same schemas as later GitHub-normalized data.
- Tests do not require network or credentials.
- File write failures produce `report.write-failed`.

Suggested commands:

```sh
npm test -- tests/fixture-input.test.ts tests/review-offline.test.ts tests/cli-run.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Added `src/fixtures/issue-source.ts` to read and validate issue-source fixture JSON
  using the shared Phase 1 schemas.
- Added `src/core/summary.ts` to derive review summary counts from report issues.
- Added `src/core/review.ts` with offline review orchestration, injectable analyzer
  support, conservative fallback analyzer, report model construction, report file writes,
  and terminal summary output.
- Wired `src/cli/run.ts` to the real `reviewRepositoryFromCli` path.
- Kept live GitHub source out of scope for this phase; review without `--issues-file`
  returns a clear `github.api-failed` operational error telling the user to use
  `--issues-file`.
- Added fixture-input tests for valid fixtures, invalid JSON, and invalid fixture shapes.
- Added offline review tests for injected analyzer output, JSON terminal summaries,
  report write failures, real CLI fixture-mode execution, and the pre-Phase-5 GitHub
  source error.
- Updated CLI run tests for the new Phase 4 review behavior.
- `npm test -- tests/fixture-input.test.ts tests/review-offline.test.ts tests/cli-run.test.ts`
  passed: 15 tests across 3 test files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm test` passed: 51 tests across 10 test files.
- A built CLI smoke run with `node dist/cli/index.js review jeremyaaron/pkg-guard --since
  30d --issues-file <fixture> --output-dir <tmp>/reports --report-id smoke` wrote both
  Markdown and JSON reports.

## Phase 5: GitHub Source Integration

Goal: add read-only GitHub issue, label, and comment collection.

Scope:

- Add `src/github/auth.ts`.
- Add `src/github/client.ts`.
- Add `src/github/issues.ts`.
- Add `src/github/types.ts`.
- Resolve GitHub token from:
  - `GITHUB_TOKEN`;
  - `gh auth token`.
- Create an Octokit client with user agent `github-triage/0.1.0`.
- Fetch open issues updated or created since the selected window.
- Exclude pull requests.
- Fetch repository labels.
- Fetch latest bounded comments per issue.
- Normalize raw Octokit responses to `SourceIssue` and `SourceLabel`.
- Map common API failures to typed errors:
  - auth missing;
  - repo not found;
  - rate limited;
  - generic API failure.
- Wire `reviewRepository` to use GitHub source when `--issues-file` is absent.
- Add tests with mocked auth, mocked `gh`, and mocked Octokit calls.

Out of scope:

- GitHub GraphQL.
- GitHub search.
- Any GitHub write calls.
- Live smoke tests in the default test suite.

Acceptance criteria:

- Public repos still require authentication for predictable rate limits.
- No write API methods are called.
- Comment fetching is skipped when `--comments 0`.
- Pagination is handled for issue and label collection.
- Tests prove pull requests are excluded.

Suggested commands:

```sh
npm test -- tests/github-auth.test.ts tests/github-issues.test.ts tests/review-github.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Added `src/github/auth.ts` with GitHub token resolution from `GITHUB_TOKEN`, then
  `gh auth token`, and `github.auth-missing` when neither is available.
- Added `src/github/client.ts` with an Octokit-backed read-only GitHub client and an
  injectable Octokit-like adapter for tests.
- Added `src/github/types.ts` with raw GitHub client and normalized issue-source types.
- Added `src/github/issues.ts` to fetch open issues, labels, and latest bounded comments;
  filter pull requests; normalize GitHub API responses to `SourceIssue`/`SourceLabel`;
  skip comment requests when `--comments 0`; and map common GitHub API failures.
- Mapped GitHub auth failures, missing repos, generic API failures, HTTP 429 rate limits,
  and GitHub's common HTTP 403 rate-limit responses.
- Wired `reviewRepository` to use GitHub source when `--issues-file` is absent, while
  preserving fixture mode when `--issues-file` is present.
- Added GitHub auth tests for environment token, `gh auth token`, and missing auth.
- Added Octokit adapter tests proving issue and label collection use pagination and
  comments use the REST comments endpoint.
- Added GitHub issue-source tests for label normalization, pull request exclusion, comment
  collection, comment skipping, and error mapping.
- Added review integration coverage for the GitHub source path using an injected fake
  GitHub client.
- Updated prior CLI/offline tests to expect `github.auth-missing` when GitHub source is
  requested without credentials.
- `npm test -- tests/github-auth.test.ts tests/github-issues.test.ts tests/github-client.test.ts tests/review-github.test.ts`
  passed: 10 tests across 4 test files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 61 tests across 14 test files.
- `npm run build` passed.
- Built CLI fixture-mode smoke still wrote both Markdown and JSON reports.
- Built CLI GitHub-mode smoke without `GITHUB_TOKEN` returned `github.auth-missing` with
  the expected authentication guidance.

## Phase 6: Local Analysis Primitives And Tool Contracts

Goal: add deterministic analysis helpers and internal tool contracts before making model
calls.

Scope:

- Add `src/analysis/duplicate-candidates.ts`.
- Add `src/analysis/recommendations.ts`.
- Add `src/analysis/tool-contracts.ts`.
- Add `src/analysis/prompt.ts` if prompt assembly helpers are useful before the OpenAI
  adapter.
- Implement duplicate candidate scoring:
  - normalized tokens;
  - stop-word removal;
  - title weighting;
  - top 5 candidates;
  - bounded threshold.
- Implement deterministic security precheck.
- Define `tool-call-contract` contracts for:
  - `classify_issue`;
  - `suggest_labels`;
  - `find_duplicate`;
  - `request_reproduction`;
  - `draft_reply`;
  - `escalate_security`.
- Add `tool-call-contract.config.ts`.
- Add unit tests for duplicate scoring, security precheck, contract exports, and
  recommendation composition.

Out of scope:

- OpenAI calls.
- Raw trace capture.
- Generated contract regression tests.
- Live issue analysis.

Acceptance criteria:

- Duplicate candidate output is deterministic.
- Security precheck catches obvious keywords from title, body, and comments.
- Tool contracts can be exported as OpenAI tool definitions.
- Representative normalized tool calls validate against the contracts.

Suggested commands:

```sh
npm test -- tests/duplicate-candidates.test.ts tests/security-precheck.test.ts tests/tool-contracts.test.ts
npm run typecheck
tool-call-contract validate --help
```

Status:

- Completed on 2026-06-28.
- Added `src/analysis/duplicate-candidates.ts` with deterministic token weighting,
  candidate scoring, top-N selection, and issue-to-candidates map creation.
- Added `src/analysis/security-precheck.ts` with deterministic high/medium confidence
  security indicator detection across issue title, body, and comments.
- Added `src/analysis/tool-contracts.ts` with `tool-call-contract` contracts for
  `classify_issue`, `suggest_labels`, `find_duplicate`, `request_reproduction`,
  `draft_reply`, and `escalate_security`.
- Added `src/analysis/recommendations.ts` to compose validated tool decisions into a
  single `IssueRecommendation` with conservative defaults for missing optional decisions.
- Added `tool-call-contract.config.ts` with triage contracts, raw/regression capture
  suites, and initial redaction paths.
- Exported Phase 6 helpers, contracts, schemas, and types from `src/index.ts`.
- Added duplicate candidate tests, security precheck tests, tool contract export and
  validation tests, and recommendation composition tests.
- `npm test -- tests/duplicate-candidates.test.ts tests/security-precheck.test.ts tests/tool-contracts.test.ts`
  passed: 10 tests across 3 test files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 71 tests across 17 test files.
- `npm run build` passed.
- `./node_modules/.bin/tool-call-contract validate --help` passed.
- `./node_modules/.bin/tool-call-contract check` passed with no findings.

## Phase 7: OpenAI Responses Analyzer

Goal: implement the production issue analyzer behind the provider boundary.

Scope:

- Add `src/analysis/analyzer.ts`.
- Add `src/analysis/trace-capture.ts`.
- Implement `IssueAnalyzer`.
- Implement `OpenAIResponsesIssueAnalyzer`.
- Resolve model from:
  - `--model`;
  - `OPENAI_MODEL`;
  - `DEFAULT_OPENAI_MODEL`.
- Before implementation, verify the default model against current official OpenAI docs and
  practical API access; update only the model constant if needed.
- Build one model request per issue.
- Export internal tool contracts to OpenAI tool definitions.
- Require structured decision tool calls.
- Normalize returned tool calls.
- Validate tool-call arguments through `tool-call-contract`.
- Compose validated calls into `IssueRecommendation`.
- Add safe fallback recommendations when required calls are missing or invalid.
- Implement explicit `--capture-dir` output for raw and normalized analysis traces.
- Add tests using a fake OpenAI client.

Out of scope:

- Streaming.
- Non-OpenAI providers.
- Batch issue analysis in one model call.
- Live OpenAI calls in default tests.

Acceptance criteria:

- Default tests do not require `OPENAI_API_KEY`.
- Missing `OPENAI_API_KEY` produces `analysis.auth-missing` only when production analyzer
  execution is required.
- Invalid model output produces per-issue warnings and safe fallback recommendations.
- `--capture-dir` writes only when explicitly provided.
- Captures are deterministic enough to feed `tool-call-contract normalize`.

Suggested commands:

```sh
npm test -- tests/openai-analyzer.test.ts tests/trace-capture.test.ts tests/review-offline.test.ts
npm run typecheck
```

Status:

- Completed on 2026-06-28.
- Verified the Responses API/tool-use direction against the official OpenAI Responses API
  reference and kept `DEFAULT_OPENAI_MODEL` at `gpt-5.5`.
- Added `src/analysis/analyzer.ts` with `OpenAIResponsesIssueAnalyzer`,
  `createOpenAIResponsesIssueAnalyzer`, `DEFAULT_OPENAI_MODEL`, fake-client-friendly
  OpenAI response client types, model resolution, OpenAI request construction, tool-call
  normalization, `tool-call-contract` validation, safe fallback warnings, and
  `analysis.auth-missing`/`analysis.model-failed` mapping.
- Added `src/analysis/prompt.ts` to build per-issue analysis prompts from repository
  labels, issue context, duplicate candidates, and security precheck output.
- Added `src/analysis/trace-capture.ts` to explicitly write raw and normalized captures
  under `--capture-dir`-compatible `raw` and `regression` folders.
- Wired `reviewRepository` to compute duplicate candidates and security precheck data for
  each issue and to use the OpenAI analyzer by default when no analyzer is injected.
- Preserved credential-free tests by keeping analyzer injection in review tests and using
  fake OpenAI clients in analyzer tests.
- Updated offline review CLI tests so default real execution without `OPENAI_API_KEY`
  returns `analysis.auth-missing`, while injected review execution remains credential-free.
- Added OpenAI analyzer tests for request shape, tool count, recommendation composition,
  invalid output fallback warnings, request failure mapping, default model constant, and
  capture writes.
- Added trace capture tests for raw and normalized capture file output.
- `npm test -- tests/openai-analyzer.test.ts tests/trace-capture.test.ts tests/review-offline.test.ts`
  passed: 14 tests across 3 test files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed: 80 tests across 19 test files.
- `npm run build` passed.
- `./node_modules/.bin/tool-call-contract validate --help` passed.
- `./node_modules/.bin/tool-call-contract check` passed with no findings.
- Built CLI fixture-mode smoke without `OPENAI_API_KEY` returned `analysis.auth-missing`
  with the expected authentication guidance.

## Phase 8: Contract Regression Fixtures

Goal: add representative issue fixtures and contract regression coverage.

Scope:

- Add issue-source fixtures for:
  - clear bug report;
  - vague bug report;
  - feature request;
  - duplicate report;
  - support request;
  - security-looking report;
  - dependency/update issue;
  - issue with missing reproduction steps.
- Add redacted normalized capture fixtures for internal tool calls where useful.
- Configure capture suites:
  - `raw`;
  - `regression`.
- Run `tool-call-contract validate` against regression captures.
- Run `tool-call-contract redact --check` once redaction paths are finalized.
- Generate Vitest regression tests if the generated output is stable enough for v0.1.0.
- Add focused report assertions for each fixture category.

Out of scope:

- Committing unsanitized raw OpenAI traces.
- Large snapshots of model prose.
- Live API calls during tests.

Acceptance criteria:

- Fixture suite covers every PRD scenario.
- Captures are redacted and safe to commit.
- Contract validation runs in the normal test or verification path.
- Tests assert categorical behavior and safety constraints without brittle prose
  snapshots.

Suggested commands:

```sh
tool-call-contract validate --suite regression
tool-call-contract redact --check --suite regression
npm test -- tests/regression-fixtures.test.ts
npm run typecheck
```

Status:

- Not started.

## Phase 9: README, Examples, And Manual Smoke

Goal: finish the v0.1.0 user-facing documentation and verify the CLI on real repositories.

Scope:

- Update README with:
  - positioning;
  - install/build instructions;
  - required environment variables;
  - read-only guarantee;
  - first-run examples;
  - fixture-mode example;
  - report output examples.
- Add contributor notes for:
  - capture workflow;
  - redaction;
  - contract regression tests.
- Confirm user-facing docs do not position the project around `tool-call-contract`.
- Run live manual smoke tests against:
  - `jeremyaaron/tool-call-contract`;
  - `jeremyaaron/pkg-guard`.
- Run full release verification.
- Record any deferred issues or follow-up release candidates.

Out of scope:

- Publishing to npm.
- Opening GitHub write modes.
- Adding a GitHub Action or GitHub App.

Acceptance criteria:

- README shows the real command and report paths.
- Live smoke tests complete with valid GitHub and OpenAI credentials.
- `npm run verify:release` passes.
- The repository is ready for v0.1.0 release review.

Suggested commands:

```sh
npm run build
node dist/cli/index.js review jeremyaaron/tool-call-contract --since 30d
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d
npm run verify:release
```

Status:

- Not started.

## Release Readiness Checklist

- `npm run lint` passes.
- `npm run typecheck` passes.
- `npm test` passes.
- `npm run build` passes.
- `pkg-guard check` passes.
- `npm pack --dry-run --ignore-scripts` passes.
- Fixture-mode review writes Markdown and JSON reports.
- Live GitHub/OpenAI smoke tests have been run manually.
- No default command mutates GitHub state.
- No default test requires live credentials.
- Captures committed to the repo are redacted.
- User-facing docs describe a maintainer assistant, not a dogfood harness.
