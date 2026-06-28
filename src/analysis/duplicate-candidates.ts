import type { SourceIssue } from "../core/schemas.js";

export interface DuplicateCandidate {
  issueNumber: number;
  title: string;
  url: string;
  reason: string;
  score: number;
}

export interface DuplicateCandidateOptions {
  maxCandidates?: number;
  minScore?: number;
}

const defaultMaxCandidates = 5;
const defaultMinScore = 0.08;

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "can",
  "for",
  "from",
  "has",
  "have",
  "how",
  "in",
  "into",
  "is",
  "it",
  "not",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "this",
  "to",
  "when",
  "with",
]);

export function findDuplicateCandidates(
  issue: SourceIssue,
  issues: readonly SourceIssue[],
  options: DuplicateCandidateOptions = {},
): DuplicateCandidate[] {
  const maxCandidates = options.maxCandidates ?? defaultMaxCandidates;
  const minScore = options.minScore ?? defaultMinScore;
  const issueVector = createIssueTokenVector(issue);

  return issues
    .filter((candidate) => candidate.number !== issue.number)
    .map((candidate) => {
      const candidateVector = createIssueTokenVector(candidate);
      const sharedTokens = [...issueVector.keys()]
        .filter((token) => candidateVector.has(token))
        .sort();
      const score = scoreVectors(issueVector, candidateVector);

      return {
        issueNumber: candidate.number,
        title: candidate.title,
        url: candidate.url,
        score,
        reason:
          sharedTokens.length > 0
            ? `Shared terms: ${sharedTokens.slice(0, 5).join(", ")}`
            : "No strong shared terms.",
      };
    })
    .filter((candidate) => candidate.score >= minScore)
    .sort((a, b) => b.score - a.score || a.issueNumber - b.issueNumber)
    .slice(0, maxCandidates)
    .map((candidate) => ({
      ...candidate,
      score: roundScore(candidate.score),
    }));
}

export function createDuplicateCandidateMap(
  issues: readonly SourceIssue[],
  options: DuplicateCandidateOptions = {},
): Map<number, DuplicateCandidate[]> {
  return new Map(
    issues.map((issue) => [issue.number, findDuplicateCandidates(issue, issues, options)]),
  );
}

function createIssueTokenVector(issue: SourceIssue): Map<string, number> {
  const vector = new Map<string, number>();

  addWeightedTokens(vector, tokenize(issue.title), 3);
  addWeightedTokens(vector, tokenize(issue.body), 1);

  for (const comment of issue.comments) {
    addWeightedTokens(vector, tokenize(comment.body), 0.5);
  }

  return vector;
}

function addWeightedTokens(vector: Map<string, number>, tokens: readonly string[], weight: number): void {
  for (const token of tokens) {
    vector.set(token, (vector.get(token) ?? 0) + weight);
  }
}

function tokenize(input: string): string[] {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/g)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function scoreVectors(left: Map<string, number>, right: Map<string, number>): number {
  let shared = 0;
  let leftTotal = 0;
  let rightTotal = 0;

  for (const value of left.values()) {
    leftTotal += value;
  }

  for (const value of right.values()) {
    rightTotal += value;
  }

  for (const [token, leftWeight] of left.entries()) {
    const rightWeight = right.get(token);

    if (rightWeight !== undefined) {
      shared += Math.min(leftWeight, rightWeight);
    }
  }

  if (leftTotal === 0 || rightTotal === 0) {
    return 0;
  }

  return shared / Math.sqrt(leftTotal * rightTotal);
}

function roundScore(score: number): number {
  return Math.round(score * 1000) / 1000;
}
