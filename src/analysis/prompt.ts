import type { AnalyzeIssueInput } from "../core/review.js";
import type { SourceComment, SourceIssue, SourceLabel } from "../core/schemas.js";
import type { DuplicateCandidate } from "./duplicate-candidates.js";
import type { SecurityPrecheckResult } from "./security-precheck.js";

export function buildIssueAnalysisPrompt(input: AnalyzeIssueInput): string {
  return [
    "You are a read-only GitHub issue triage assistant.",
    "",
    "Use the available tools to return structured maintainer recommendations.",
    "Do not claim that comments, labels, or issue state have been changed.",
    "Stay conservative. If evidence is weak, use low confidence.",
    "For security-sensitive issues, avoid drafting public troubleshooting text that repeats exploit details or secrets.",
    "",
    "Repository:",
    `${input.repository.owner}/${input.repository.name}`,
    "",
    "Repository labels:",
    formatLabels(input.repositoryLabels),
    "",
    "Issue:",
    formatIssue(input.issue),
    "",
    "Duplicate candidates:",
    formatDuplicateCandidates(input.duplicateCandidates),
    "",
    "Security precheck:",
    formatSecurityPrecheck(input.securityPrecheck),
    "",
    "Required tool decisions:",
    "- classify_issue",
    "- suggest_labels",
    "- find_duplicate",
    "- request_reproduction",
    "- draft_reply, unless no reply should be suggested",
    "- escalate_security",
  ].join("\n");
}

function formatLabels(labels: readonly SourceLabel[]): string {
  if (labels.length === 0) {
    return "None.";
  }

  return labels
    .map((label) => {
      const description = label.description ? ` - ${label.description}` : "";
      return `- ${label.name}${description}`;
    })
    .join("\n");
}

function formatIssue(issue: SourceIssue): string {
  return [
    `#${issue.number}: ${issue.title}`,
    `Author: ${issue.author}`,
    `URL: ${issue.url}`,
    `Current labels: ${issue.labels.map((label) => label.name).join(", ") || "none"}`,
    "",
    "Body:",
    issue.body || "(empty)",
    "",
    "Latest comments:",
    formatComments(issue.comments),
  ].join("\n");
}

function formatComments(comments: readonly SourceComment[]): string {
  if (comments.length === 0) {
    return "None.";
  }

  return comments
    .map((comment) => `- ${comment.author} at ${comment.createdAt}: ${comment.body || "(empty)"}`)
    .join("\n");
}

function formatDuplicateCandidates(candidates: readonly DuplicateCandidate[]): string {
  if (candidates.length === 0) {
    return "None.";
  }

  return candidates
    .map(
      (candidate) =>
        `- #${candidate.issueNumber} ${candidate.title} (${candidate.score}): ${candidate.reason}`,
    )
    .join("\n");
}

function formatSecurityPrecheck(result: SecurityPrecheckResult): string {
  return [
    `Sensitive: ${result.sensitive}`,
    `Confidence: ${result.confidence}`,
    `Indicators: ${result.indicators.join(", ") || "none"}`,
    `Rationale: ${result.rationale}`,
  ].join("\n");
}
