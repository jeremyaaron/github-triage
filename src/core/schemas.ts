import { z } from "zod";

import { createUsageError } from "./errors.js";

const reportIdPattern = /^[A-Za-z0-9._-]+$/;
const repoPartPattern = /^[A-Za-z0-9_.-]+$/;

export const schemaVersionSchema = z.literal(1);

export const isoDateTimeStringSchema = z
  .string()
  .datetime({ offset: true })
  .describe("ISO 8601 timestamp with timezone offset.");

export const repoSlugSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
});

export type RepoSlug = z.infer<typeof repoSlugSchema>;

export const durationWindowSchema = z.object({
  input: z.string().min(1),
  days: z.number().int().positive().max(3650),
  sinceDate: isoDateTimeStringSchema,
});

export type DurationWindow = z.infer<typeof durationWindowSchema>;

export const reportIdSchema = z.string().regex(reportIdPattern);

export type ReportId = z.infer<typeof reportIdSchema>;

export const confidenceSchema = z.enum(["low", "medium", "high"]);

export type Confidence = z.infer<typeof confidenceSchema>;

export const issueClassificationSchema = z.enum([
  "bug",
  "feature",
  "support",
  "documentation",
  "dependency",
  "security",
  "maintenance",
  "unclear",
]);

export type IssueClassification = z.infer<typeof issueClassificationSchema>;

export const recommendationSignalSchema = z.object({
  kind: z.string().min(1),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
});

export type RecommendationSignal = z.infer<typeof recommendationSignalSchema>;

export const sourceLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type SourceLabel = z.infer<typeof sourceLabelSchema>;

export const sourceCommentSchema = z.object({
  author: z.string().min(1),
  body: z.string(),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  url: z.string().url(),
});

export type SourceComment = z.infer<typeof sourceCommentSchema>;

export const sourceIssueSchema = z.object({
  number: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string(),
  author: z.string().min(1),
  state: z.enum(["open", "closed"]),
  labels: z.array(sourceLabelSchema),
  createdAt: isoDateTimeStringSchema,
  updatedAt: isoDateTimeStringSchema,
  commentCount: z.number().int().nonnegative(),
  url: z.string().url(),
  comments: z.array(sourceCommentSchema),
});

export type SourceIssue = z.infer<typeof sourceIssueSchema>;

export const issueSourceDocumentSchema = z.object({
  schemaVersion: schemaVersionSchema,
  repository: repoSlugSchema,
  labels: z.array(sourceLabelSchema),
  issues: z.array(sourceIssueSchema),
});

export type IssueSourceDocument = z.infer<typeof issueSourceDocumentSchema>;

export const missingInformationKindSchema = z.enum([
  "reproduction",
  "expected-behavior",
  "actual-behavior",
  "version",
  "runtime",
  "operating-system",
  "logs",
  "minimal-reproduction",
]);

export type MissingInformationKind = z.infer<typeof missingInformationKindSchema>;

export const missingInformationSchema = z.object({
  kind: missingInformationKindSchema,
  question: z.string().min(1),
});

export type MissingInformation = z.infer<typeof missingInformationSchema>;

export const labelSuggestionSchema = z.object({
  name: z.string().min(1),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
  exists: z.boolean(),
});

export type LabelSuggestion = z.infer<typeof labelSuggestionSchema>;

export const relatedIssueSchema = z.object({
  issueNumber: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  relationship: z.enum(["likely-duplicate", "related"]),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
});

export type RelatedIssue = z.infer<typeof relatedIssueSchema>;

export const draftReplySchema = z.object({
  body: z.string().min(1),
  rationale: z.string().min(1),
});

export type DraftReply = z.infer<typeof draftReplySchema>;

export const securityRecommendationSchema = z.object({
  sensitive: z.boolean(),
  confidence: confidenceSchema,
  rationale: z.string().min(1),
  publicReplyAllowed: z.boolean(),
});

export type SecurityRecommendation = z.infer<typeof securityRecommendationSchema>;

export const recommendationWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export type RecommendationWarning = z.infer<typeof recommendationWarningSchema>;

export const issueRecommendationSchema = z.object({
  issueNumber: z.number().int().positive(),
  classification: issueClassificationSchema,
  confidence: confidenceSchema,
  signals: z.array(recommendationSignalSchema),
  suggestedLabels: z.array(labelSuggestionSchema),
  missingInformation: z.array(missingInformationSchema),
  relatedIssues: z.array(relatedIssueSchema),
  draftReply: draftReplySchema.nullable(),
  security: securityRecommendationSchema,
  rationale: z.string().min(1),
  warnings: z.array(recommendationWarningSchema),
});

export type IssueRecommendation = z.infer<typeof issueRecommendationSchema>;

export const reviewSummarySchema = z.object({
  issueCount: z.number().int().nonnegative(),
  securitySensitive: z.number().int().nonnegative(),
  likelyDuplicates: z.number().int().nonnegative(),
  needsMaintainerReply: z.number().int().nonnegative(),
  missingReproduction: z.number().int().nonnegative(),
});

export type ReviewSummary = z.infer<typeof reviewSummarySchema>;

export const reportWarningSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  issueNumber: z.number().int().positive().optional(),
});

export type ReportWarning = z.infer<typeof reportWarningSchema>;

export const reportIssueSchema = z.object({
  source: sourceIssueSchema,
  recommendation: issueRecommendationSchema,
});

export type ReportIssue = z.infer<typeof reportIssueSchema>;

export const reviewReportSchema = z.object({
  schemaVersion: schemaVersionSchema,
  repository: repoSlugSchema,
  generatedAt: isoDateTimeStringSchema,
  reviewWindow: z.object({
    since: z.string().min(1),
    sinceDate: isoDateTimeStringSchema,
  }),
  source: z.object({
    kind: z.enum(["github", "fixture"]),
    issueCount: z.number().int().nonnegative(),
    labelCount: z.number().int().nonnegative(),
    commentsPerIssue: z.number().int().min(0).max(20),
  }),
  summary: reviewSummarySchema,
  issues: z.array(reportIssueSchema),
  warnings: z.array(reportWarningSchema),
});

export type ReviewReport = z.infer<typeof reviewReportSchema>;

export function parseRepoSlug(input: string): RepoSlug {
  const parts = input.split("/");

  if (parts.length !== 2) {
    throw createUsageError(
      "cli.invalid-repo",
      `Invalid repository "${input}". Use the owner/repo format.`,
    );
  }

  const [owner, name] = parts;

  if (!isValidRepoPart(owner) || !isValidRepoPart(name)) {
    throw createUsageError(
      "cli.invalid-repo",
      `Invalid repository "${input}". Use only letters, numbers, dots, underscores, and hyphens in owner/repo.`,
    );
  }

  return repoSlugSchema.parse({ owner, name });
}

export function parseReportId(input: string): ReportId {
  const result = reportIdSchema.safeParse(input);

  if (!result.success) {
    throw createUsageError(
      "cli.invalid-report-id",
      `Invalid --report-id value "${input}". Use only letters, numbers, dots, underscores, and hyphens.`,
    );
  }

  return result.data;
}

function isValidRepoPart(input: string | undefined): input is string {
  return input !== undefined && repoPartPattern.test(input) && input.length > 0;
}
