# github-triage

Local, read-only GitHub issue triage reports for open-source maintainers.

`github-triage` reviews open GitHub issues and writes Markdown and JSON reports with
suggested classifications, labels, likely duplicates, missing information, draft replies,
and security-sensitive escalation notes.

The v0.1.0 MVP is intentionally read-only. It does not post comments, apply labels, close
issues, or otherwise mutate GitHub state.

## Requirements

- Node.js 20.19 or newer.
- GitHub authentication through `GITHUB_TOKEN` or `gh auth login`.
- `OPENAI_API_KEY` for issue analysis.
- Optional `OPENAI_MODEL` to override the default model.

## Install And Build

For local development from this repository:

```sh
npm install
npm run build
```

Run the built CLI directly:

```sh
node dist/cli/index.js --help
```

After package installation, the binary name is:

```sh
github-triage --help
```

## First Run

Review issues updated in the last 30 days:

```sh
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d
```

By default, reports are written to `.github-triage/reports` using a timestamped basename:

```text
.github-triage/reports/jeremyaaron-pkg-guard-YYYYMMDD-HHMMSSZ.md
.github-triage/reports/jeremyaaron-pkg-guard-YYYYMMDD-HHMMSSZ.json
```

Use a deterministic report id when comparing runs:

```sh
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d --report-id smoke
```

That writes:

```text
.github-triage/reports/jeremyaaron-pkg-guard-smoke.md
.github-triage/reports/jeremyaaron-pkg-guard-smoke.json
```

## Options

```text
github-triage review <owner>/<repo> --since <duration> [options]

--since <duration>        Review open issues created or updated since duration ago.
--output-dir <path>       Report output directory. Default: .github-triage/reports.
--format <format>         markdown, json, or all. Default: all.
--issues-file <path>      Read issue-source JSON from disk instead of GitHub.
--comments <count>        Latest comments per issue to fetch. Default: 5. Range: 0..20.
--report-id <id>          Deterministic report id used as output basename suffix.
--capture-dir <path>      Write raw and normalized AI captures for regression work.
--model <name>            Override OPENAI_MODEL for this run.
--json                    Print terminal summary as JSON.
```

## Fixture Mode

`--issues-file` reads an issue-source JSON file from disk instead of GitHub. Analysis
still requires `OPENAI_API_KEY`.

```sh
node dist/cli/index.js review jeremyaaron/pkg-guard \
  --since 30d \
  --issues-file fixtures/issues/clear-bug.json \
  --report-id clear-bug
```

Expected report paths:

```text
.github-triage/reports/jeremyaaron-pkg-guard-clear-bug.md
.github-triage/reports/jeremyaaron-pkg-guard-clear-bug.json
```

## Report Contents

Markdown reports are meant for review by a maintainer before taking action. They include:

- summary counts;
- security-sensitive issue flags;
- issues that likely need a maintainer response;
- possible duplicates or related issues;
- per-issue recommendations, rationale, missing information, and draft replies;
- warnings when analysis output was incomplete or invalid.

JSON reports contain the same structured data for downstream scripts.

## Release Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run verify:release
```

Contributor notes for captures, redaction, and regression fixtures live in
[`docs/v0.1.0/contributor-notes.md`](docs/v0.1.0/contributor-notes.md).
