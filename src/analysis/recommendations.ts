import type {
  IssueRecommendation,
  RecommendationWarning,
  SecurityRecommendation,
} from "../core/schemas.js";
import { issueRecommendationSchema } from "../core/schemas.js";
import type {
  ClassifyIssueInput,
  DraftReplyInput,
  EscalateSecurityInput,
  FindDuplicateInput,
  RequestReproductionInput,
  SuggestLabelsInput,
} from "./tool-contracts.js";

export interface ComposeIssueRecommendationInput {
  issueNumber: number;
  classification?: ClassifyIssueInput;
  labels?: SuggestLabelsInput;
  duplicates?: FindDuplicateInput;
  reproduction?: RequestReproductionInput;
  draftReply?: DraftReplyInput | null;
  security?: EscalateSecurityInput;
  warnings?: RecommendationWarning[];
}

export function composeIssueRecommendation(
  input: ComposeIssueRecommendationInput,
): IssueRecommendation {
  const classification = input.classification ?? {
    classification: "unclear" as const,
    confidence: "low" as const,
    rationale: "No classification tool call was provided.",
  };
  const security = input.security ?? createDefaultSecurityRecommendation();

  return issueRecommendationSchema.parse({
    issueNumber: input.issueNumber,
    classification: classification.classification,
    confidence: classification.confidence,
    signals: [],
    suggestedLabels: input.labels?.labels ?? [],
    missingInformation: input.reproduction?.missingInformation ?? [],
    relatedIssues: input.duplicates?.relatedIssues ?? [],
    draftReply: input.draftReply
      ? {
          body: input.draftReply.body,
          rationale: input.draftReply.rationale,
        }
      : null,
    security,
    rationale: classification.rationale,
    warnings: input.warnings ?? [],
  });
}

function createDefaultSecurityRecommendation(): SecurityRecommendation {
  return {
    sensitive: false,
    confidence: "low",
    rationale: "No security escalation tool call was provided.",
    publicReplyAllowed: true,
  };
}
