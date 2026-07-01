# github-triage v0.2.0 Implementation Plan

## Purpose

This plan breaks the v0.2.0 PRD and technical design into phases sized for one focused
implementation turn. Each phase should leave the repository buildable, tested, and easy
to review.

v0.2.0 turns `github-triage` from a source-checkout MVP into a project-local maintainer
tool:

- `github-triage review --since 30d` works from inside the target repository;
- explicit `github-triage review owner/repo --since 30d` remains supported;
- repository detection uses local git remotes;
- default output is terminal-first;
- Markdown and JSON report files become opt-in artifacts;
- lightweight `.github-triage.json` config is supported;
- read-only behavior is preserved.

The release should avoid widening into a bot, GitHub Action, GitHub App, VS Code
extension, multi-repo dashboard, or write-capable automation. Those are future interface
directions, not v0.2.0 scope.

## Baseline

Development starts from the tagged v0.1.0 baseline on `main`.

Current baseline expectations:

- `git status --short --branch` is clean on `main`.
- `HEAD` is tagged `v0.1.0`.
- `package.json` version is `0.1.0` until the release-prep phase.
- Existing v0.1.0 regression fixtures and contract checks remain valid.

Housekeeping note: the repository currently has both a branch and a tag named `v0.1.0`,
which makes Git report the refname as ambiguous. That does not block implementation, but
it should be cleaned up outside this plan if the release branch is no longer needed.

## Phase Sizing

A phase should usually fit in one focused implementation pass when:

- it changes one primary subsystem;
- it has direct tests;
- it keeps default tests free of live GitHub or OpenAI credentials;
- it avoids mixing product behavior changes with broad documentation updates;
- it leaves `npm test`, `npm run typecheck`, and targeted tests in a meaningful state.

If a phase starts touching git detection, config loading, CLI parsing, report rendering,
and README migration all at once, split it before continuing.

## Phase 0: v0.2.0 Version And Planning Scaffold

Goal: prepare the release line without changing runtime behavior.

Scope:

- Update package version from `0.1.0` to `0.2.0`.
- Update lockfile package metadata.
- Update `CHANGELOG.md` with an unreleased `0.2.0` section.
- Ensure `docs/v0.2.0/` contains:
  - PRD;
  - technical design;
  - implementation plan.
- Verify current behavior still passes before feature work begins.

Out of scope:

- CLI behavior changes.
- Repository detection.
- Config support.
- README rewrite.

Acceptance criteria:

- Package metadata consistently reports `0.2.0`.
- Existing tests pass before functional changes begin.
- Release docs exist in `docs/v0.2.0`.

Suggested commands:

```sh
npm install --package-lock-only --ignore-scripts
npm run typecheck
npm test
npm run build
```

Status:

- Completed.
- Updated `package.json` version to `0.2.0`.
- Refreshed `package-lock.json` package metadata with `npm install --package-lock-only
  --ignore-scripts`.
- Added a `0.2.0` planning entry to `CHANGELOG.md`.
- Confirmed `docs/v0.2.0/` contains the PRD, technical design, and implementation plan.
- Verification passed:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`

## Phase 1: Repository Detection

Goal: add local GitHub repository detection without wiring it into the CLI yet.

Scope:

- Add `src/repository/detect.ts`.
- Implement pure remote URL parsing:
  - `https://github.com/owner/repo.git`;
  - `https://github.com/owner/repo`;
  - `http://github.com/owner/repo.git`;
  - `git@github.com:owner/repo.git`;
  - `ssh://git@github.com/owner/repo.git`.
- Implement git root discovery with:
  - `git rev-parse --show-toplevel`.
- Implement remote discovery with:
  - `git remote -v`.
- De-duplicate fetch/push remote rows.
- Select repository using v0.2.0 rules:
  - prefer parseable `origin`;
  - otherwise use the only parseable GitHub remote;
  - otherwise fail clearly.
- Add error codes:
  - `repo.detect-missing`;
  - `repo.detect-ambiguous`;
  - `repo.git-failed`.
- Export repository detection types and helpers from `src/index.ts`.
- Add `tests/repository-detect.test.ts`.

Out of scope:

- CLI parsing changes.
- Config loading.
- Calling detection from `runCli`.
- GitHub Enterprise remotes.
- `gh repo view` fallback.

Acceptance criteria:

- Supported remote URL formats parse to `RepoSlug`.
- Non-GitHub remotes return `null`.
- Detection selects `origin` when available.
- Detection selects a single non-origin GitHub remote when unambiguous.
- Detection fails on ambiguous remotes with actionable choices.
- Detection fails outside a git repo with `repo.detect-missing`.
- Tests use injected `execFile`; no real git repo setup is required.

Suggested commands:

```sh
npm test -- tests/repository-detect.test.ts
npm run typecheck
```

Status:

- Completed.
- Added `src/repository/detect.ts` with local git repository detection using
  `git rev-parse --show-toplevel` and `git remote -v`.
- Added pure GitHub remote URL parsing for HTTPS, HTTP, SSH URL, and SCP-like SSH forms.
- Implemented deterministic remote selection:
  - parseable `origin` wins;
  - otherwise a single parseable GitHub remote wins;
  - otherwise detection fails with an actionable missing or ambiguous repo error.
- Added repository detection error codes:
  - `repo.detect-missing`;
  - `repo.detect-ambiguous`;
  - `repo.git-failed`.
- Exported repository detection helpers and types from `src/index.ts`.
- Added `tests/repository-detect.test.ts` covering remote parsing, origin selection,
  single-remote fallback, ambiguity, missing git repositories, no-GitHub-remote cases,
  unexpected git failures, and injected command `cwd` usage.
- Verification passed:
  - `npm test -- tests/repository-detect.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Phase 2: Project Configuration

Goal: add `.github-triage.json` parsing and validation without changing CLI execution.

Scope:

- Add `src/config/project-config.ts`.
- Add `projectConfigSchema`.
- Support config fields:
  - `since`;
  - `comments`;
  - `report`;
  - `outputDir`;
  - `reportId`;
  - `model`.
- Reject secrets and unsupported fields through strict schema parsing.
- Load config only from an explicit project root path.
- Return empty config when the file is absent.
- Add error codes:
  - `config.invalid-json`;
  - `config.invalid-shape`.
- Validate configured `reportId` with existing report-id rules.
- Export config helpers and types from `src/index.ts`.
- Add `tests/project-config.test.ts`.

Out of scope:

- Repository detection wiring.
- CLI precedence logic.
- README documentation.
- Supporting `captureDir` in config.

Acceptance criteria:

- Missing config returns an empty object.
- Valid config parses into typed values.
- Invalid JSON fails with `config.invalid-json`.
- Invalid shape fails with `config.invalid-shape`.
- Unsupported keys are rejected.
- Config cannot define secrets or capture directories.

Suggested commands:

```sh
npm test -- tests/project-config.test.ts
npm run typecheck
```

Status:

- Completed.
- Added `src/config/project-config.ts` with `.github-triage.json` loading from an
  explicit project root.
- Added strict `projectConfigSchema` support for:
  - `since`;
  - `comments`;
  - `report`;
  - `outputDir`;
  - `reportId`;
  - `model`.
- Added `projectConfigFileName`, `ProjectConfig`, and `ReadProjectConfigOptions`.
- Added config error codes:
  - `config.invalid-json`;
  - `config.invalid-shape`.
- Missing config files return an empty config.
- Invalid JSON, unsupported keys, invalid values, invalid report ids, secret-looking
  fields, and `captureDir` fail with config-specific errors.
- Exported project config helpers and types from `src/index.ts`.
- Added `tests/project-config.test.ts`.
- Verification passed:
  - `npm test -- tests/project-config.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Phase 3: CLI Parsing And Option Resolution

Goal: split syntactic CLI parsing from async option resolution.

Scope:

- Update `src/cli/options.ts` so `review [owner/repo]` parses successfully.
- Add `ParsedReviewArgs`.
- Add `--report <none|markdown|json|all>`.
- Keep `--format <markdown|json|all>` as a compatibility alias.
- Reject `--format none`.
- Keep `--json` as terminal JSON output.
- Add `src/cli/resolve-options.ts`.
- Resolve final `ReviewCliOptions` from:
  - parsed CLI args;
  - detected repository;
  - fixture repository metadata when needed;
  - project config;
  - defaults.
- Apply precedence:
  - CLI;
  - config;
  - defaults.
- Require `since` from either CLI or config.
- Preserve explicit `owner/repo` review from arbitrary directories.
- Let explicit `owner/repo` continue without config when repo detection fails.
- Update `src/cli/run.ts` to call the resolver before review execution.
- Update help text for optional repo and `--report`.
- Add `tests/cli-resolve-options.test.ts`.
- Update `tests/cli-options.test.ts` and `tests/cli-run.test.ts`.

Out of scope:

- Changing report file write behavior.
- Terminal row rendering.
- README rewrite.
- Live git, GitHub, or OpenAI calls in tests.

Acceptance criteria:

- `review --since 30d` resolves repo from injected git detection.
- `review owner/repo --since 30d` still resolves explicitly.
- `--issues-file` without repo can use fixture repository metadata when no git repo is
  available.
- Config values apply when CLI flags are absent.
- CLI flags override config values.
- Missing `since` fails after considering config.
- `--report` values parse correctly.
- `--format` compatibility is tested.

Suggested commands:

```sh
npm test -- tests/cli-options.test.ts tests/cli-resolve-options.test.ts tests/cli-run.test.ts
npm run typecheck
```

Status:

- Completed.
- Refactored `src/cli/options.ts` so parsing produces raw `ParsedReviewArgs` and allows
  `review [owner/repo]`.
- Added `--report <none|markdown|json|all>` parsing.
- Kept `--format <markdown|json|all>` as a compatibility alias and rejected
  `--format none`.
- Added `src/cli/resolve-options.ts` to combine parsed CLI args, repository detection,
  fixture repository fallback, project config, and defaults into `ReviewCliOptions`.
- Resolution behavior now supports:
  - implicit repo detection from git remotes;
  - explicit `owner/repo` from arbitrary directories;
  - fixture repository metadata fallback when no repo can be detected;
  - config values when CLI values are absent;
  - CLI values overriding config values;
  - `since` validation after config resolution.
- Updated `src/cli/run.ts` to resolve options before calling review execution.
- Updated help/version output for v0.2.0 and the optional repo syntax.
- Added `tests/cli-resolve-options.test.ts`.
- Updated `tests/cli-options.test.ts`, `tests/cli-run.test.ts`, and `tests/smoke.test.ts`.
- Exported resolver, parsed args, and report artifact types from `src/index.ts`.
- Added preliminary `ReportArtifactFormat` and `report` option plumbing while preserving
  v0.1 default report behavior until Phase 4 changes output defaults.
- Verification passed:
  - `npm test -- tests/cli-options.test.ts tests/cli-resolve-options.test.ts tests/cli-run.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Phase 4: Report Output Modes

Goal: make report files opt-in while preserving Markdown and JSON artifact support.

Scope:

- Rename or migrate internal report artifact field from `format` to `report`.
- Add `ReportArtifactFormat = "none" | "markdown" | "json" | "all"`.
- Update `src/reports/paths.ts` so `report: "none"` returns no files.
- Update `src/core/review.ts` so no output directory is created when no reports are
  requested.
- Update review option types.
- Update all tests and call sites from `format` to `report`.
- Keep Markdown and JSON rendering unchanged.
- Ensure `--report all` preserves v0.1.0 file output behavior.
- Ensure `--format all` compatibility still writes files.

Out of scope:

- Terminal compact issue rows.
- README rewrite.
- Config schema changes beyond already-added report support.

Acceptance criteria:

- Default resolved review options use `report: "none"`.
- Default review writes no report files.
- `--report markdown` writes only Markdown.
- `--report json` writes only JSON.
- `--report all` writes both files.
- Existing regression fixture tests that assert files request `report: "all"`.
- No tests require live credentials.

Suggested commands:

```sh
npm test -- tests/report-paths.test.ts tests/review-offline.test.ts tests/review-github.test.ts tests/regression-fixtures.test.ts
npm run typecheck
```

Status:

- Completed.
- Migrated review and report path planning from `format` inputs to `report` artifact
  mode.
- Added `ReportArtifactFormat = "none" | "markdown" | "json" | "all"`.
- Updated `planReportPaths` to accept `report` and return no files for `report: "none"`.
- Updated `ReviewCliOptions` and `ReviewOptions` to use `report` as the artifact field.
- Changed resolved default review behavior to `report: "none"`.
- Kept `--format` only as a CLI compatibility alias for `--report`.
- Updated review orchestration so `report: "none"` creates no report files and does not
  create the output directory.
- Updated tests and call sites to request `report: "all"`, `report: "json"`, or
  `report: "markdown"` when asserting file artifacts.
- Added coverage for terminal-only review output and no output directory creation.
- Verification passed:
  - `npm test -- tests/report-paths.test.ts tests/review-offline.test.ts tests/review-github.test.ts tests/regression-fixtures.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Phase 5: Terminal-First Output

Goal: make default terminal output useful without opening report files.

Scope:

- Update `src/reports/terminal.ts`.
- Add compact issue rows to plain text output.
- Add compact issue rows to terminal JSON output.
- Implement primary status selection:
  - avoid public reply for sensitive issues that disallow public replies;
  - security review;
  - likely duplicate;
  - needs reproduction;
  - needs reply;
  - ready for review.
- Keep output plain ASCII and non-colored.
- Include report paths only when reports are written.
- Add or update report rendering tests.
- Update regression fixture assertions where terminal output is relevant.

Out of scope:

- Markdown report changes.
- Full JSON report schema changes.
- Interactive review.
- Draft reply snippets in terminal output.

Acceptance criteria:

- Plain terminal output includes aggregate counts and issue rows.
- Terminal JSON includes aggregate counts, issue rows, and report paths.
- Default terminal output contains no `Reports:` section when no reports are written.
- Report paths appear when `report` is not `none`.
- Output remains deterministic in tests.

Suggested commands:

```sh
npm test -- tests/report-rendering.test.ts tests/review-offline.test.ts tests/cli-run.test.ts
npm run typecheck
```

Status:

- Completed.
- Updated `src/reports/terminal.ts` so plain terminal output includes compact issue
  rows after the aggregate counts.
- Added terminal row status selection for:
  - avoid public reply;
  - security review;
  - likely duplicate;
  - needs reproduction;
  - needs reply;
  - ready for review.
- Kept terminal output plain ASCII and non-colored.
- Added the same compact issue rows to terminal JSON output with issue number, title,
  classification, status, labels, and URL.
- Preserved conditional report path rendering: terminal output includes `Reports:` only
  when report artifacts are written.
- Updated report rendering tests for issue rows, terminal JSON issue rows, status
  selection priority, and no-report-path behavior.
- Verification passed:
  - `npm test -- tests/report-rendering.test.ts tests/review-offline.test.ts tests/cli-run.test.ts`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
  - `npm run build`

## Phase 6: Package Consumer Documentation

Goal: update user-facing and contributor docs for the v0.2.0 workflow.

Scope:

- Rewrite README around consumer-project usage:
  - `npx github-triage review --since 30d`;
  - dev-dependency npm script usage;
  - implicit repo detection;
  - explicit repo override;
  - authentication;
  - read-only guarantee;
  - terminal-first output;
  - optional `--report` files;
  - `.github-triage.json`;
  - troubleshooting detection errors.
- Update `docs/v0.1.0/contributor-notes.md` or add v0.2.0 contributor notes covering:
  - repository detection tests;
  - config precedence;
  - report default migration;
  - manual smoke commands.
- Update `CHANGELOG.md` with v0.2.0 user-visible changes.
- Confirm user-facing docs do not center internal contract testing.

Out of scope:

- Runtime behavior changes.
- Publishing to npm.
- GitHub Actions or hosted workflows.

Acceptance criteria:

- README no longer implies the primary workflow is cloning and building this repo.
- README shows real implicit and explicit commands.
- README documents how to request report files.
- Contributor docs cover capture hygiene and new repo/config test strategy.
- Changelog includes compatibility and migration notes.

Suggested commands:

```sh
npm run typecheck
npm test
```

Status:

- Not started.

## Phase 7: v0.2.0 Regression And Release Readiness

Goal: verify v0.2.0 end-to-end and record any deferred live smoke work.

Scope:

- Run the full local verification suite.
- Run contract validation and redaction checks.
- Run package release verification.
- Run no-credential CLI smoke checks for:
  - help;
  - explicit repo auth failure;
  - implicit repo detection path from this repository;
  - fixture mode with and without report artifacts where possible.
- Run live smoke checks only if credentials are available:
  - implicit review from a GitHub-backed repository;
  - implicit review with `--report all`;
  - explicit `owner/repo` review.
- Confirm no default command mutates GitHub state.
- Confirm no default test requires live credentials.
- Update this implementation plan status and release readiness checklist.

Out of scope:

- Publishing to npm.
- Tagging the release.
- Creating a GitHub Action.

Acceptance criteria:

- `npm run verify:release` passes.
- `pkg-guard check` reports no issues.
- Contract regression captures validate and redact cleanly.
- Manual smoke results are recorded accurately, including credential gaps if any.
- Repository is ready for v0.2.0 release review.

Suggested commands:

```sh
npm run lint
npm run typecheck
npm test
npm run build
./node_modules/.bin/tool-call-contract validate --suite regression
./node_modules/.bin/tool-call-contract redact --check --suite regression
./node_modules/.bin/tool-call-contract check
npm run verify:release
node dist/cli/index.js --help
node dist/cli/index.js review --since 30d
node dist/cli/index.js review --since 30d --report all --report-id smoke
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d
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
- `tool-call-contract validate --suite regression` passes.
- `tool-call-contract redact --check --suite regression` passes.
- `tool-call-contract check` passes.
- `github-triage review --since 30d` resolves the current repository when run from a
  GitHub-backed checkout.
- `github-triage review owner/repo --since 30d` remains supported.
- Default review output is useful in the terminal without report files.
- Report files are written only when requested or configured.
- No default command mutates GitHub state.
- No default test requires live credentials.
- User-facing docs describe a project-local maintainer assistant, not a dogfood harness.
