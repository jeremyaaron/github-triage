# Contributor Notes

These notes cover v0.1.0 development workflows that are useful when changing analysis,
captures, or release packaging.

## Capture Workflow

Captures are opt-in. Normal CLI runs do not write model traces.

Use `--capture-dir` when a local run should save raw and normalized analysis output:

```sh
node dist/cli/index.js review jeremyaaron/pkg-guard \
  --since 30d \
  --report-id capture-smoke \
  --capture-dir captures
```

The capture layout is:

```text
captures/raw/
captures/regression/
```

`captures/raw/` is ignored by git and should not be committed. It may contain raw model
responses or source issue content.

`captures/regression/` is for normalized, redacted fixtures that are safe to review and
commit.

## Redaction

Before committing any normalized capture, run:

```sh
./node_modules/.bin/tool-call-contract redact --check --suite regression
```

If the check reports changes, inspect the modified files before committing them. The
redaction paths are configured in `tool-call-contract.config.ts`.

Do not commit:

- `captures/raw/`;
- API keys or `.env` files;
- private issue content;
- private author identities;
- raw OpenAI Responses payloads.

## Contract Regression Tests

Regression captures are validated in two places:

```sh
./node_modules/.bin/tool-call-contract validate --suite regression
npm test -- tests/regression-fixtures.test.ts
```

The Vitest regression suite also exercises report behavior for each committed issue
fixture. Add or update a fixture when a change affects issue classification, labels,
duplicates, missing reproduction handling, draft replies, or security escalation.

Keep regression assertions focused on categories and safety properties. Avoid snapshots of
long model prose unless a future change makes exact wording part of the product contract.

## Manual Smoke

Live smoke requires:

- GitHub authentication through `GITHUB_TOKEN` or `gh auth login`;
- `OPENAI_API_KEY`;
- optional `OPENAI_MODEL`.

Suggested smoke commands:

```sh
npm run build
node dist/cli/index.js review jeremyaaron/tool-call-contract --since 30d --report-id smoke-tool-call-contract
node dist/cli/index.js review jeremyaaron/pkg-guard --since 30d --report-id smoke-pkg-guard
npm run verify:release
```

Confirm that each run writes Markdown and JSON reports under `.github-triage/reports` and
does not mutate GitHub state.
