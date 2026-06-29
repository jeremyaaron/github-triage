import { version } from "../version.js";

export function renderHelp(): string {
  return `github-triage ${version}

Local, read-only GitHub issue triage reports.

Usage:
  github-triage review [owner/repo] --since <duration> [options]
  github-triage --help
  github-triage --version

Options:
  --since <duration>        Review open issues created or updated since duration ago.
  --report <format>         none, markdown, json, or all. Default: all.
  --output-dir <path>       Report output directory. Default: .github-triage/reports.
  --format <format>         Deprecated alias for --report. Supports markdown, json, or all.
  --issues-file <path>      Read issue-source JSON from disk instead of GitHub.
  --comments <count>        Latest comments per issue to fetch. Default: 5. Range: 0..20.
  --report-id <id>          Deterministic report id used as output basename suffix.
  --capture-dir <path>      Write raw and normalized AI captures for regression work.
  --model <name>            Override OPENAI_MODEL for this run.
  --json                    Print terminal summary as JSON.
  --help                    Print help.
  --version                 Print package version.
`;
}
