import OpenAI from "openai";
import {
  createContractRegistry,
  exportOpenAITools,
  normalizeToolCallCaptures,
  validateToolCalls,
  type NormalizedToolCall,
  type ToolCallValidationResult,
} from "tool-call-contract";

import type { AnalyzeIssueInput, IssueAnalyzer } from "../core/review.js";
import type { IssueRecommendation, RecommendationWarning } from "../core/schemas.js";
import { composeIssueRecommendation } from "./recommendations.js";
import { buildIssueAnalysisPrompt } from "./prompt.js";
import {
  classifyIssueContract,
  draftReplyContract,
  escalateSecurityContract,
  findDuplicateContract,
  requestReproductionContract,
  suggestLabelsContract,
  triageToolContracts,
  type ClassifyIssueInput,
  type DraftReplyInput,
  type EscalateSecurityInput,
  type FindDuplicateInput,
  type RequestReproductionInput,
  type SuggestLabelsInput,
} from "./tool-contracts.js";
import { writeAnalysisTrace } from "./trace-capture.js";
import { GithubTriageError } from "../core/errors.js";

export const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export interface OpenAIResponseCreateInput {
  model: string;
  input: string;
  tools: readonly unknown[];
  tool_choice: "required";
}

export interface OpenAIResponsesClient {
  responses: {
    create(input: OpenAIResponseCreateInput): Promise<unknown>;
  };
}

export interface OpenAIResponsesIssueAnalyzerOptions {
  client: OpenAIResponsesClient;
  model: string;
  captureDir?: string;
}

export interface CreateOpenAIResponsesIssueAnalyzerOptions {
  env?: NodeJS.ProcessEnv;
  model?: string;
  captureDir?: string;
}

type ValidatedToolValue =
  | ClassifyIssueInput
  | SuggestLabelsInput
  | FindDuplicateInput
  | RequestReproductionInput
  | DraftReplyInput
  | EscalateSecurityInput;

export class OpenAIResponsesIssueAnalyzer implements IssueAnalyzer {
  private readonly tools: readonly unknown[];

  constructor(private readonly options: OpenAIResponsesIssueAnalyzerOptions) {
    const { registry, findings } = createContractRegistry({ contracts: triageToolContracts });
    const exported = exportOpenAITools(registry);
    const exportFindings = [...findings, ...exported.flatMap((item) => item.findings)];

    if (exportFindings.length > 0) {
      throw new GithubTriageError({
        code: "analysis.output-invalid",
        message: "Triage tool contracts cannot be exported for OpenAI.",
        exitCode: 1,
        details: exportFindings,
      });
    }

    this.tools = exported.flatMap((item) => (item.tool ? [item.tool] : []));
  }

  async analyzeIssue(input: AnalyzeIssueInput): Promise<IssueRecommendation> {
    let response: unknown;

    try {
      response = await this.options.client.responses.create({
        model: this.options.model,
        input: buildIssueAnalysisPrompt(input),
        tools: this.tools,
        tool_choice: "required",
      });
    } catch (error) {
      throw new GithubTriageError({
        code: "analysis.model-failed",
        message: "OpenAI issue analysis request failed.",
        exitCode: 1,
        cause: error,
      });
    }

    return await this.recommendFromResponse(input, response);
  }

  private async recommendFromResponse(
    input: AnalyzeIssueInput,
    response: unknown,
  ): Promise<IssueRecommendation> {
    const normalized = normalizeToolCallCaptures(response, {
      format: "openai-responses",
      includeSource: true,
    });
    const warnings: RecommendationWarning[] = normalized.issues.map((issue) => ({
      code: issue.code,
      message: issue.message,
    }));

    if (this.options.captureDir) {
      await writeAnalysisTrace({
        captureDir: this.options.captureDir,
        issueNumber: input.issue.number,
        rawResponse: response,
        normalizedCalls: normalized.calls,
      });
    }

    const parsed = parseValidatedToolCalls(validateToolCalls(triageToolContracts, normalized.calls));

    return composeIssueRecommendation({
      issueNumber: input.issue.number,
      ...(parsed.classification ? { classification: parsed.classification } : {}),
      ...(parsed.labels ? { labels: parsed.labels } : {}),
      ...(parsed.duplicates ? { duplicates: parsed.duplicates } : {}),
      ...(parsed.reproduction ? { reproduction: parsed.reproduction } : {}),
      ...(parsed.draftReply ? { draftReply: parsed.draftReply } : {}),
      security: parsed.security ?? {
        sensitive: input.securityPrecheck.sensitive,
        confidence: input.securityPrecheck.confidence,
        rationale: input.securityPrecheck.rationale,
        publicReplyAllowed: !input.securityPrecheck.sensitive,
      },
      warnings: [
        ...warnings,
        ...parsed.warnings,
        ...createMissingRequiredWarnings(parsed),
      ],
    });
  }
}

export function createOpenAIResponsesIssueAnalyzer(
  options: CreateOpenAIResponsesIssueAnalyzerOptions = {},
): OpenAIResponsesIssueAnalyzer {
  const env = options.env ?? process.env;
  const apiKey = env["OPENAI_API_KEY"]?.trim();

  if (!apiKey) {
    throw new GithubTriageError({
      code: "analysis.auth-missing",
      message: "OpenAI authentication is required. Set OPENAI_API_KEY to run model analysis.",
      exitCode: 1,
    });
  }

  const openai = new OpenAI({ apiKey });
  const client = openai as unknown as OpenAIResponsesClient;

  return new OpenAIResponsesIssueAnalyzer({
    client,
    model: options.model ?? env["OPENAI_MODEL"]?.trim() ?? DEFAULT_OPENAI_MODEL,
    ...(options.captureDir ? { captureDir: options.captureDir } : {}),
  });
}

interface ParsedToolCalls {
  classification?: ClassifyIssueInput;
  labels?: SuggestLabelsInput;
  duplicates?: FindDuplicateInput;
  reproduction?: RequestReproductionInput;
  draftReply?: DraftReplyInput;
  security?: EscalateSecurityInput;
  warnings: RecommendationWarning[];
}

function parseValidatedToolCalls(results: ToolCallValidationResult[]): ParsedToolCalls {
  const parsed: ParsedToolCalls = { warnings: [] };

  for (const result of results) {
    if (!result.ok) {
      parsed.warnings.push({
        code: "analysis.output-invalid",
        message: result.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    assignValidatedToolValue(parsed, result.contractName, result.value as ValidatedToolValue);
  }

  return parsed;
}

function assignValidatedToolValue(
  parsed: ParsedToolCalls,
  contractName: string,
  value: ValidatedToolValue,
): void {
  switch (contractName) {
    case classifyIssueContract.name:
      parsed.classification = value as ClassifyIssueInput;
      break;
    case suggestLabelsContract.name:
      parsed.labels = value as SuggestLabelsInput;
      break;
    case findDuplicateContract.name:
      parsed.duplicates = value as FindDuplicateInput;
      break;
    case requestReproductionContract.name:
      parsed.reproduction = value as RequestReproductionInput;
      break;
    case draftReplyContract.name:
      parsed.draftReply = value as DraftReplyInput;
      break;
    case escalateSecurityContract.name:
      parsed.security = value as EscalateSecurityInput;
      break;
  }
}

function createMissingRequiredWarnings(parsed: ParsedToolCalls): RecommendationWarning[] {
  const warnings: RecommendationWarning[] = [];

  if (!parsed.classification) {
    warnings.push({
      code: "analysis.output-missing",
      message: "Model output did not include classify_issue.",
    });
  }

  if (!parsed.security) {
    warnings.push({
      code: "analysis.output-missing",
      message: "Model output did not include escalate_security.",
    });
  }

  return warnings;
}

export function extractFunctionCallsForTest(response: unknown): NormalizedToolCall[] {
  return normalizeToolCallCaptures(response, {
    format: "openai-responses",
    includeSource: true,
  }).calls;
}
