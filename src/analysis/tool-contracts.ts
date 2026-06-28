import { defineToolContract } from "tool-call-contract";
import { z } from "zod";

import {
  confidenceSchema,
  issueClassificationSchema,
  labelSuggestionSchema,
  missingInformationSchema,
  relatedIssueSchema,
  securityRecommendationSchema,
} from "../core/schemas.js";

export const classifyIssueInputSchema = z.object({
  classification: issueClassificationSchema,
  confidence: confidenceSchema,
  rationale: z.string().min(1),
});

export const suggestLabelsInputSchema = z.object({
  labels: z.array(labelSuggestionSchema),
});

export const findDuplicateInputSchema = z.object({
  relatedIssues: z.array(relatedIssueSchema),
});

export const requestReproductionInputSchema = z.object({
  missingInformation: z.array(missingInformationSchema),
});

export const draftReplyInputSchema = z.object({
  body: z.string().min(1),
  rationale: z.string().min(1),
});

export const escalateSecurityInputSchema = securityRecommendationSchema;

export type ClassifyIssueInput = z.infer<typeof classifyIssueInputSchema>;
export type SuggestLabelsInput = z.infer<typeof suggestLabelsInputSchema>;
export type FindDuplicateInput = z.infer<typeof findDuplicateInputSchema>;
export type RequestReproductionInput = z.infer<typeof requestReproductionInputSchema>;
export type DraftReplyInput = z.infer<typeof draftReplyInputSchema>;
export type EscalateSecurityInput = z.infer<typeof escalateSecurityInputSchema>;

export const classifyIssueContract = defineToolContract({
  name: "classify_issue",
  description: "Classify a GitHub issue into the primary maintainer triage category.",
  input: classifyIssueInputSchema,
});

export const suggestLabelsContract = defineToolContract({
  name: "suggest_labels",
  description: "Suggest repository labels for a GitHub issue without applying them.",
  input: suggestLabelsInputSchema,
});

export const findDuplicateContract = defineToolContract({
  name: "find_duplicate",
  description: "Identify likely duplicate or related issues from provided candidates.",
  input: findDuplicateInputSchema,
});

export const requestReproductionContract = defineToolContract({
  name: "request_reproduction",
  description: "Identify missing reproduction, environment, version, log, or behavior details.",
  input: requestReproductionInputSchema,
});

export const draftReplyContract = defineToolContract({
  name: "draft_reply",
  description: "Draft one maintainer reply for review without posting it to GitHub.",
  input: draftReplyInputSchema,
});

export const escalateSecurityContract = defineToolContract({
  name: "escalate_security",
  description: "Flag security-sensitive issue handling guidance for maintainer review.",
  input: escalateSecurityInputSchema,
});

export const triageToolContracts = [
  classifyIssueContract,
  suggestLabelsContract,
  findDuplicateContract,
  requestReproductionContract,
  draftReplyContract,
  escalateSecurityContract,
] as const;
