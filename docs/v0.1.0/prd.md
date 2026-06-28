# github-triage v0.1.0 PRD

## Summary

`github-triage` is a local-first command-line assistant for open-source maintainers who
need help reviewing GitHub issues across a growing project portfolio.

The v0.1.0 MVP should read issues from a single GitHub repository, analyze them, and
produce reviewable triage reports without changing GitHub state. It should help a
maintainer quickly identify unclear reports, likely duplicates, missing reproduction
details, label candidates, draft replies, and security-sensitive issues that deserve
careful handling.

The product direction is:

> Review GitHub issues faster without letting automation act before the maintainer does.

The first release should be useful as a standalone maintainer tool while also creating a
realistic agentic workflow that can be regression-tested. That implementation detail
belongs in contributor documentation and tests, not in the user-facing product
positioning.

## Background

Small open-source maintainers often handle issue triage manually. That work is manageable
for one quiet repository, but it becomes repetitive and easy to defer as the number of
repositories grows.

Common triage tasks include:

- deciding whether an issue is a bug, feature request, support question, documentation
  request, dependency update, or unclear report;
- checking whether the issue is missing reproduction steps, version information,
  environment details, logs, or expected behavior;
- identifying likely duplicate or related issues;
- selecting labels consistently;
- drafting a maintainer reply that is direct, useful, and polite;
- recognizing security-looking reports before they are handled in public like ordinary
  bugs.

Existing GitHub issue templates, labelers, stale bots, marketplace automations, and AI
coding assistants solve parts of this workflow, but they either require up-front repo
configuration, mutate GitHub state, or sit inside a broader coding workflow. The first
version of `github-triage` should stay narrow: read the current issue state, produce
recommendations, and leave the maintainer in control.

## Problem

Maintainers need a quick way to review open issues and decide what to do next without
opening every issue, rereading old context, or manually drafting the same clarifying
comments.

The workflow is currently expensive because:

- issue quality varies widely;
- labels drift across repositories;
- duplicate detection requires local project memory;
- security-sensitive reports can be easy to miss;
- reply tone and structure become inconsistent when triage is done in small fragments;
- the maintainer still needs a reviewable artifact before trusting automation.

Common failure modes:

- vague reports remain open because nobody asks for the missing reproduction details;
- duplicate or related issues are not connected;
- feature requests, support questions, and bug reports are mixed together;
- labels are applied inconsistently;
- maintainers spend time composing routine replies instead of making product decisions;
- automation is avoided entirely because write permissions feel too risky.

The MVP should reduce review effort while preserving maintainer judgment.

## Goals

- Provide a local CLI that reviews recent open issues for one GitHub repository.
- Fetch issue data directly from GitHub in read-only mode.
- Generate Markdown and JSON reports that can be reviewed, shared, and committed if useful.
- Classify issues into practical maintainer-facing categories.
- Suggest labels using repository labels when available.
- Identify missing reproduction, environment, log, or expected-behavior details.
- Find likely duplicate or related issues from the fetched issue set.
- Draft maintainer replies without posting them.
- Flag security-sensitive issues for careful manual review.
- Keep all default behavior non-mutating and transparent.
- Establish a regression suite from representative issue fixtures.

## Non-Goals

- Posting comments to GitHub.
- Applying labels.
- Closing, reopening, assigning, transferring, locking, or editing issues.
- Running as a GitHub App, GitHub Action, webhook service, or scheduled bot.
- Reviewing pull requests.
- Managing issue forms or repository settings.
- Building a hosted dashboard.
- Supporting organization-wide analytics.
- Guaranteeing duplicate detection across all historical issues.
- Guaranteeing security classification correctness.
- Replacing maintainer judgment.
- Marketing the tool as a contract-testing or dogfood application.

## Target Users

### Primary User

An independent open-source maintainer who manages several GitHub repositories and wants a
fast, reviewable first pass over incoming issues.

They are comfortable using a CLI, have a GitHub token available locally, and want help
prioritizing issue review without granting automation permission to act on their behalf.

### Secondary Users

- Small teams maintaining public developer tools.
- Maintainers preparing for a focused issue cleanup session.
- Project owners who want consistent issue triage across related repositories.
- Agentic-tool developers who need a realistic local workflow with reviewable outputs.

## Positioning

`github-triage` should be positioned as a local maintainer assistant, not as a bot.

Suggested tagline:

> Review GitHub issues with local, read-only triage reports.

Suggested short description:

> `github-triage` reads GitHub issues and produces Markdown and JSON recommendations for
> labels, duplicates, missing details, draft replies, and security-sensitive escalation.

Avoid user-facing positioning that centers implementation dependencies or internal
portfolio dogfooding. Those details may appear in contributor documentation, architecture
notes, and regression-test docs.

## Product Principles

- Keep the maintainer in control.
- Read by default; never write by surprise.
- Prefer reviewable recommendations over hidden automation.
- Show enough evidence for each recommendation to be trusted or rejected.
- Keep reports useful in a terminal, editor, and CI artifact viewer.
- Favor predictable categories over clever but unstable taxonomy.
- Treat security-looking reports conservatively.
- Make model output structured enough to validate.
- Keep fixture captures redacted, deterministic, and safe to commit.
- Start narrow enough that the first release can be used on real repositories.

## MVP Scope

The v0.1.0 MVP targets:

- public GitHub repositories;
- open issues, excluding pull requests;
- one repository per command invocation;
- recent issue windows selected by `--since`;
- local CLI usage;
- Markdown and JSON report output;
- read-only GitHub API access;
- one model/provider path selected in technical design;
- fixture-based regression testing for representative issue scenarios.

The MVP exposes one primary command:

```sh
github-triage review jeremyaaron/pkg-guard --since 30d
```

### `github-triage review`

Reviews open issues for a single repository and writes triage recommendations.

Expected behavior:

- Parse a GitHub repository slug in `owner/repo` form.
- Accept a relative `--since` window such as `7d`, `30d`, or `90d`.
- Fetch open issues updated or created within the selected window.
- Exclude pull requests from the issue set.
- Fetch available repository labels.
- Analyze each issue independently and, where useful, compare it with the fetched issue
  set for likely duplicates or related issues.
- Print a concise terminal summary.
- Write a Markdown report for human review.
- Write a JSON report for automation, diffing, and tests.
- Exit non-zero only for operational failures, invalid input, or report generation
  failures, not because issues need attention.

Example:

```sh
$ github-triage review jeremyaaron/pkg-guard --since 30d

Reviewed 12 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 2
Needs maintainer reply: 8
Missing reproduction: 4

Reports:
  .github-triage/reports/pkg-guard-2026-06-27.md
  .github-triage/reports/pkg-guard-2026-06-27.json
```

Exact report paths, timestamp format, and default output directory should be finalized in
the technical design.

## Product Behavior

### Issue Collection

The CLI should collect enough issue context to support useful triage without becoming a
full GitHub mirror.

Required issue fields:

- issue number;
- title;
- body;
- author login;
- state;
- labels;
- creation timestamp;
- update timestamp;
- comment count;
- issue URL.

Useful optional fields:

- latest comments, bounded by a small limit;
- assignees;
- milestone;
- reactions;
- linked closing references if available from the API with low complexity.

The MVP should avoid expensive historical crawling. Duplicate detection may use only the
issues fetched for the current review window plus any explicitly fetched candidate issues
that the technical design justifies.

### Triage Categories

Each issue should receive one primary classification:

- `bug`
- `feature`
- `support`
- `documentation`
- `dependency`
- `security`
- `maintenance`
- `unclear`

An issue may also include secondary signals:

- `needs-reproduction`
- `needs-environment`
- `needs-logs`
- `possible-duplicate`
- `security-sensitive`
- `good-first-issue-candidate`
- `blocked-by-maintainer`

The technical design may refine names, but the taxonomy should remain small and stable for
v0.1.0.

### Label Suggestions

Label suggestions should prefer labels that already exist in the target repository.

For each suggested label, the report should include:

- label name;
- confidence level;
- short rationale;
- whether the label already exists.

If an obvious label does not exist, the report may suggest it as a new-label candidate,
but the MVP must not create labels.

### Missing Information Detection

The assistant should identify whether the issue is missing information commonly required
for maintainer action:

- reproduction steps;
- expected behavior;
- actual behavior;
- package or tool version;
- runtime version;
- operating system;
- logs or error output;
- minimal reproduction repository or snippet.

Missing information should feed into draft replies so the maintainer can ask for specific
details instead of a generic "please provide more information" response.

### Duplicate and Related Issue Detection

The MVP should identify likely duplicate or related issues from the available issue set.

For each candidate, the report should include:

- issue number;
- title;
- URL;
- relationship type: `likely-duplicate` or `related`;
- short rationale.

This feature should be conservative. It is better to miss a duplicate than to confidently
claim a weak match.

### Draft Replies

Each issue should include at most one draft maintainer reply.

The reply should:

- be concise;
- reference the specific missing details or next step;
- avoid promising implementation;
- avoid closing language unless the issue is a clear duplicate;
- avoid posting sensitive details for security-looking issues;
- be easy to copy into GitHub after review.

Security-sensitive issues should receive a cautious escalation note rather than a normal
public troubleshooting reply.

### Security-Sensitive Escalation

The assistant should flag issues that appear to contain:

- vulnerability reports;
- exploit descriptions;
- credential, token, or secret exposure;
- private infrastructure details;
- instructions for bypassing authentication or authorization;
- reports that request private disclosure handling.

The MVP should not determine exploitability. It should warn the maintainer to review the
issue carefully and avoid public follow-up that could amplify risk.

## Reports

### Markdown Report

The Markdown report should optimize for maintainer review.

Required sections:

- repository and review metadata;
- summary counts;
- security-sensitive issues;
- issues needing maintainer response;
- possible duplicates or related issues;
- per-issue recommendations.

Each per-issue entry should include:

- issue number and linked title;
- classification;
- current labels;
- suggested labels;
- missing information;
- duplicate or related candidates;
- draft reply;
- rationale.

### JSON Report

The JSON report should be deterministic and suitable for tests.

Required top-level fields:

- schema version;
- repository;
- review timestamp;
- review window;
- input issue count;
- summary counts;
- issues array;
- warnings array.

Each issue object should include structured versions of the Markdown fields. Exact schema
names should be finalized in the technical design and then treated as stable for the
v0.1.x line.

## Functional Requirements

### CLI

- Provide a `github-triage review <owner>/<repo>` command.
- Support `--since <duration>` with at least day-based durations.
- Support `--format markdown`, `--format json`, and `--format all`, or an equivalent
  output selection decided in technical design.
- Support `--output-dir <path>`.
- Support a no-network fixture mode if selected in technical design for testing and local
  development.
- Print actionable errors for missing GitHub authentication, invalid repo slugs, rate
  limits, and unavailable repositories.

### GitHub Access

- Use read-only GitHub API calls.
- Read authentication from standard local environment or GitHub CLI state, as finalized in
  technical design.
- Do not request or require write scopes for v0.1.0.
- Do not mutate labels, comments, issues, milestones, assignments, or repository settings.
- Handle API pagination for the selected issue window.

### Analysis

- Produce one structured recommendation per issue.
- Include confidence or severity where it helps review.
- Include short rationales for classifications, label suggestions, duplicate candidates,
  and security-sensitive flags.
- Continue processing other issues when one issue fails analysis, and report per-issue
  warnings where possible.
- Keep prompts, schemas, and output validation versioned in source.

### Regression Fixtures

The MVP should include representative fixtures for:

- clear bug report;
- vague bug report;
- feature request;
- duplicate report;
- support request;
- security-looking report;
- dependency/update issue;
- issue with missing reproduction steps.

Fixtures should be redacted and safe to commit.

## User Experience Requirements

- The default command should be understandable from terminal output alone.
- Reports should be easy to scan in a Markdown preview.
- Draft replies should be copyable without cleanup.
- Recommendations should never imply that GitHub has already been changed.
- Errors should distinguish configuration problems from GitHub API failures and model
  analysis failures.
- The README should show a complete first-run example.

## Technical Constraints

- Runtime target should be Node.js `>=20` unless technical design finds a reason to choose
  a higher baseline.
- The project should be implemented as a TypeScript CLI package.
- The package should be installable and runnable through npm-compatible workflows.
- Analysis output should be validated before reports are written.
- The implementation should keep provider-specific model code isolated behind a small
  boundary so future providers can be added without rewriting GitHub collection or report
  rendering.
- Default behavior must be local and read-only.

## Success Criteria

The MVP is successful when:

- a maintainer can run one command against `jeremyaaron/tool-call-contract` or
  `jeremyaaron/pkg-guard` and receive useful Markdown and JSON reports;
- the report identifies at least the major obvious triage actions for representative real
  issues;
- no command in v0.1.0 mutates GitHub state;
- report generation is repeatable enough for fixture-based regression tests;
- representative issue fixtures cover the core triage categories;
- documentation presents the product as a maintainer assistant, not as an implementation
  test harness.

## Risks

- Model recommendations may sound more confident than the evidence supports.
- Duplicate detection may be weak without broader historical context.
- Security-sensitive detection may produce false positives or miss subtle reports.
- GitHub API rate limits may surprise users reviewing larger repositories.
- Label suggestions may be noisy when repositories have inconsistent label sets.
- Report schemas may churn if the first implementation does not separate user-facing
  Markdown from structured analysis data.
- The project could become too broad if write automation or bot behavior enters the MVP.

## Open Questions

- Which model/provider should v0.1.0 use first?
- Should the CLI authenticate through `GITHUB_TOKEN`, GitHub CLI, or both?
- Should v0.1.0 support analyzing exported issue JSON as a no-network input mode?
- What default output directory should reports use?
- Should report filenames include wall-clock timestamps, commit SHAs, or deterministic
  review-window identifiers?
- How many comments per issue should the MVP fetch?
- Should duplicate detection use only the current review window or also search older open
  and closed issues?
- What confidence scale should JSON reports expose?
- Which parts of internal analysis should be captured as regression fixtures?
