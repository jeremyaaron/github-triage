# github-triage v0.2.0 PRD

## Summary

`github-triage` v0.2.0 should turn the v0.1.0 proof-of-concept into a usable
project-local maintainer tool.

The v0.1.0 release proved that the assistant can fetch GitHub issues, analyze them, and
write read-only triage reports. It also exposed the biggest product gap: the tool is too
awkward to fit naturally into another repository's workflow. A maintainer should not need
to clone `github-triage`, build it from source, pass a repository slug every time, and
treat generated report files as the primary interface.

The v0.2.0 release should make this the natural usage:

```sh
npx github-triage review --since 30d
```

When run from a GitHub-backed repository, `github-triage` should infer the target
repository, review recent issues, and present a terminal-first summary. Markdown and JSON
reports should remain available, but they should be optional artifacts rather than the
center of the default experience.

The product direction remains:

> Review GitHub issues faster without letting automation act before the maintainer does.

## Background

The v0.1.0 MVP intentionally kept the surface area small:

- explicit `owner/repo` input;
- local source checkout usage;
- Markdown and JSON report files;
- read-only GitHub access;
- no GitHub mutations;
- fixture and contract regression coverage.

That was appropriate for proving the analysis path, but it is not yet a practical
maintainer workflow. A useful issue triage assistant should fit where maintainers already
work:

- inside the repository they maintain;
- as an npm/npx command;
- as a package that can be pinned in `devDependencies`;
- with terminal output that is useful immediately;
- with optional files for audit, sharing, or automation.

The v0.2.0 release should focus on this workflow shift. It should not expand into a bot,
GitHub App, or write-capable automation yet.

## Problem

The current user experience makes adoption harder than the triage problem itself.

Current friction:

- users must run the tool from the `github-triage` source repository during development;
- the target repository is always an explicit argument, even when the current directory is
  already a GitHub repository;
- generated reports are the main output, which makes quick triage feel heavier than
  necessary;
- there is no project-local configuration for common preferences;
- `npx` and dev-dependency usage are not the documented primary workflow;
- README guidance is still release-local rather than consumer-project-oriented.

The result is a tool that technically reviews issues, but does not yet feel like something
a maintainer would add to their regular workflow.

## Goals

- Support running `github-triage` from the repository being triaged.
- Infer `owner/repo` from the current git remote when the repository argument is omitted.
- Keep explicit `owner/repo` usage for automation and cross-repository review.
- Make terminal output the default primary interface.
- Keep Markdown and JSON output available through explicit options.
- Support `npx github-triage review --since 30d` as a first-class usage path.
- Support project-local dev-dependency usage through npm scripts.
- Add lightweight project configuration for recurring options if it can remain simple.
- Improve user-facing documentation around using the tool in another project.
- Preserve v0.1.0 read-only guarantees.
- Preserve testability and fixture-based regression coverage.

## Non-Goals

- Publishing the package during implementation.
- Building a GitHub App.
- Building a GitHub Action.
- Building a VS Code extension.
- Adding scheduled or webhook-driven execution.
- Applying labels, posting comments, closing issues, assigning issues, or otherwise
  mutating GitHub.
- Building a hosted dashboard.
- Supporting organization-wide or multi-repository triage in a single command.
- Replacing the existing explicit `owner/repo` command form.
- Reworking the model analysis taxonomy unless required by workflow changes.

## Target Users

### Primary User

An open-source maintainer working inside one of their project repositories who wants a
quick issue triage pass without leaving the terminal.

They want to run:

```sh
npx github-triage review --since 30d
```

or:

```sh
npm run triage
```

and immediately see which issues need attention.

### Secondary Users

- Maintainers who want to pin `github-triage` as a dev dependency in each project.
- Small teams that want a repeatable local triage command before issue cleanup sessions.
- Maintainers who still prefer explicit `owner/repo` review from outside the target repo.
- Future GitHub Action or GitHub App users whose workflow needs a cleaner CLI foundation.

## Positioning

`github-triage` should be positioned as a project-local maintainer assistant.

Suggested tagline:

> Triage GitHub issues from the repository you already work in.

Suggested short description:

> `github-triage` reviews recent GitHub issues and prints read-only recommendations for
> labels, duplicates, missing details, draft replies, and security-sensitive escalation.

The user-facing product should emphasize workflow fit, read-only safety, and fast review.
Internal testing infrastructure should remain contributor-facing.

## Product Principles

- Make the common path short.
- Infer safely, but let users override explicitly.
- Default to terminal output that is useful without opening another file.
- Keep file artifacts available for audit and automation.
- Never mutate GitHub state by default or by accident.
- Prefer transparent source resolution over surprising magic.
- Make ambiguous repository detection fail with clear instructions.
- Keep configuration small enough to understand at a glance.
- Preserve compatibility for v0.1.0 command users.

## v0.2.0 Scope

The v0.2.0 release targets:

- npm/npx CLI usage;
- current-repository detection from git remotes;
- one repository per command invocation;
- public GitHub repositories and authenticated API access;
- terminal-first output;
- optional Markdown and JSON report output;
- optional project-local configuration;
- read-only review behavior.

The primary command becomes:

```sh
github-triage review --since 30d
```

The existing explicit form remains supported:

```sh
github-triage review jeremyaaron/pkg-guard --since 30d
```

### Repository Detection

When `owner/repo` is omitted, the CLI should detect the repository from the current
working directory.

Expected behavior:

- Discover the nearest git repository from the current directory.
- Read configured git remotes.
- Prefer a GitHub remote named `origin` when it maps cleanly to `owner/repo`.
- Support common HTTPS and SSH GitHub remote formats.
- If `origin` is not usable and there is exactly one GitHub remote, use it.
- If multiple GitHub remotes are plausible, fail with a clear error and list explicit
  choices.
- If no GitHub remote is found, fail with a clear error explaining how to pass
  `owner/repo` explicitly.

Examples of supported remotes:

```text
https://github.com/owner/repo.git
git@github.com:owner/repo.git
ssh://git@github.com/owner/repo.git
https://github.com/owner/repo
```

### Terminal-First Output

The default command should print enough information to act without opening a report file.

Expected terminal output should include:

- repository reviewed;
- issue count reviewed;
- security-sensitive count;
- likely duplicate count;
- missing reproduction count;
- needs maintainer reply count;
- a compact issue list with issue number, classification, key flags, and suggested labels;
- report paths only when files are written.

Example:

```text
Reviewed 12 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 2
Needs maintainer reply: 8
Missing reproduction: 4

Issues:
  #42 bug        needs reproduction      labels: bug, needs reproduction
  #43 feature    ready for review        labels: enhancement
  #44 security   avoid public reply      labels: security
```

Exact formatting belongs in technical design, but the default output should remain plain
text and script-friendly.

### Output Modes

v0.1.0 writes Markdown and JSON by default. v0.2.0 should make output behavior more
intentional.

Required behavior:

- Default output should be terminal-only unless configuration says otherwise.
- Markdown and JSON reports should be available through CLI options.
- Existing report rendering should be reused.
- Report paths should continue to default under `.github-triage/reports` when files are
  requested.
- `--json` should continue to mean terminal summary as JSON, unless technical design
  identifies a clearer flag migration.

Candidate options for technical design:

```sh
github-triage review --since 30d --report markdown
github-triage review --since 30d --report json
github-triage review --since 30d --report all
github-triage review --since 30d --output-dir .github-triage/reports
```

The exact option names should be chosen during technical design with backward
compatibility in mind.

### Project Configuration

v0.2.0 should include lightweight configuration only if it does not delay the main
workflow improvements.

Candidate config file:

```json
{
  "since": "30d",
  "comments": 5,
  "reports": "markdown",
  "model": "gpt-5.5"
}
```

Expected behavior if included:

- Look for `.github-triage.json` in the current repository root.
- CLI flags override config values.
- Config is optional.
- Invalid config fails with clear errors.
- Config should not include secrets.

If configuration creates too much implementation risk, it should be deferred before
weakening repository inference or terminal-first output.

### npm And Dev Dependency Usage

Documentation should show both ad hoc and pinned usage.

Ad hoc:

```sh
npx github-triage review --since 30d
```

Pinned:

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

Then:

```sh
npm run triage
```

This workflow should be the center of the v0.2.0 README.

## Compatibility

v0.2.0 should preserve the v0.1.0 command:

```sh
github-triage review owner/repo --since 30d
```

Behavior that may change:

- default file report generation may become opt-in;
- terminal output may become more detailed;
- README examples may shift from source-checkout usage to npm/npx usage.

If changing default report generation is considered too disruptive, technical design
should introduce a deprecation path. Since v0.1.0 was an MVP and v0.2.0 is still early,
the product benefit likely justifies the change.

## Authentication

GitHub authentication should remain:

- `GITHUB_TOKEN`; or
- `gh auth login` fallback.

OpenAI authentication should remain:

- `OPENAI_API_KEY`;
- optional `OPENAI_MODEL`;
- optional CLI model override.

v0.2.0 should improve documentation and error messages where needed, but should not add a
new secret-management system.

## Read-Only Guarantee

v0.2.0 must preserve the read-only guarantee.

The tool may:

- read git config;
- read optional local configuration;
- read GitHub issues, labels, and comments;
- call the configured model provider;
- print terminal output;
- write local report files only when requested or configured.

The tool must not:

- post GitHub comments;
- apply labels;
- close or edit issues;
- change repository settings;
- create commits;
- stage files;
- push changes.

## User Experience

### Successful Implicit Review

```sh
$ npx github-triage review --since 30d

Reviewed 12 open issues in jeremyaaron/pkg-guard

Security-sensitive: 1
Likely duplicates: 2
Needs maintainer reply: 8
Missing reproduction: 4

Issues:
  #42 bug        needs reproduction      labels: bug, needs reproduction
  #43 feature    ready for review        labels: enhancement
  #44 security   avoid public reply      labels: security
```

### Ambiguous Remotes

```sh
$ github-triage review --since 30d

error repo.detect-ambiguous
  Multiple GitHub remotes were found: origin=owner/fork, upstream=owner/project.
  Run "github-triage review owner/project --since 30d" or configure the repository.
```

### No GitHub Remote

```sh
$ github-triage review --since 30d

error repo.detect-missing
  Could not infer a GitHub repository from this directory.
  Run "github-triage review owner/repo --since 30d" from any directory.
```

### Optional Report Files

```sh
$ github-triage review --since 30d --report all

Reviewed 12 open issues in jeremyaaron/pkg-guard

...

Reports:
  .github-triage/reports/jeremyaaron-pkg-guard-20260701-120000Z.md
  .github-triage/reports/jeremyaaron-pkg-guard-20260701-120000Z.json
```

## Documentation Requirements

README should be reorganized around:

- install-free `npx` usage;
- dev-dependency usage;
- implicit repository detection;
- explicit repository override;
- authentication;
- read-only behavior;
- terminal-first output;
- optional report files;
- config file if implemented;
- troubleshooting common repository detection errors.

Contributor docs should cover:

- how repository detection is tested;
- how terminal formatting is tested;
- how report output behavior differs from v0.1.0;
- release verification steps.

## Success Criteria

- A maintainer can run `npx github-triage review --since 30d` from a GitHub-backed repo.
- The CLI infers the correct repository or fails with a clear actionable error.
- Existing explicit `owner/repo` usage still works.
- Default output is useful in the terminal without opening Markdown or JSON files.
- Markdown and JSON reports can still be generated on demand.
- The README describes usage from a consumer project, not from the `github-triage` source
  checkout.
- The package remains read-only.
- No default tests require live GitHub or OpenAI credentials.
- Release verification passes.

## Open Questions

- Should the report option be named `--report`, `--reports`, `--format`, or should the
  existing `--format` be retained with changed defaults?
- Should default terminal output include draft reply snippets, or only issue-level
  summaries?
- Should `.github-triage.json` be included in v0.2.0 or deferred to v0.3.0?
- Should repository detection prefer `upstream` over `origin` when both exist and `origin`
  appears to be a fork?
- Should `gh repo view --json owner,name` be used as a fallback when git remote parsing is
  ambiguous, or should v0.2.0 stay purely local for repository detection?
- Should `--issues-file` continue to require a repository slug, or can it also use an
  inferred/current repo for report identity?

## Deferred Future Work

- GitHub Action for scheduled or manual workflow runs.
- GitHub App for hosted triage and review queues.
- VS Code extension for browsing recommendations in-editor.
- Optional write modes for applying labels or posting reviewed comments.
- Multi-repository portfolio triage.
- Persistent local history to compare issue triage changes across runs.
- Provider abstraction beyond the current model path.
