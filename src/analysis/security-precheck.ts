import type { SourceIssue } from "../core/schemas.js";

export interface SecurityPrecheckResult {
  sensitive: boolean;
  confidence: "low" | "medium" | "high";
  indicators: string[];
  rationale: string;
}

const highConfidencePatterns: Array<[RegExp, string]> = [
  [/\bCVE-\d{4}-\d{4,}\b/i, "CVE identifier"],
  [/\bauthentication bypass\b/i, "authentication bypass"],
  [/\bauthorization bypass\b/i, "authorization bypass"],
  [/\bprivate disclosure\b/i, "private disclosure"],
];

const mediumConfidencePatterns: Array<[RegExp, string]> = [
  [/\bvulnerability\b/i, "vulnerability"],
  [/\bexploit\b/i, "exploit"],
  [/\btoken\b/i, "token"],
  [/\bsecret\b/i, "secret"],
  [/\bcredential\b/i, "credential"],
];

export function runSecurityPrecheck(issue: SourceIssue): SecurityPrecheckResult {
  const text = [issue.title, issue.body, ...issue.comments.map((comment) => comment.body)].join("\n");
  const indicators = collectIndicators(text);

  if (indicators.high.length > 0) {
    return {
      sensitive: true,
      confidence: "high",
      indicators: indicators.high,
      rationale: `Matched high-confidence security indicator(s): ${indicators.high.join(", ")}.`,
    };
  }

  if (indicators.medium.length > 0) {
    return {
      sensitive: true,
      confidence: "medium",
      indicators: indicators.medium,
      rationale: `Matched security indicator(s): ${indicators.medium.join(", ")}.`,
    };
  }

  return {
    sensitive: false,
    confidence: "low",
    indicators: [],
    rationale: "No obvious security-sensitive indicators matched.",
  };
}

function collectIndicators(text: string): {
  high: string[];
  medium: string[];
} {
  return {
    high: collectPatternLabels(text, highConfidencePatterns),
    medium: collectPatternLabels(text, mediumConfidencePatterns),
  };
}

function collectPatternLabels(text: string, patterns: Array<[RegExp, string]>): string[] {
  return patterns
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label)
    .sort();
}
