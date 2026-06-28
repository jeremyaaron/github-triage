import { createContractRegistry, exportOpenAITools, validateToolCall } from "tool-call-contract";
import { describe, expect, it } from "vitest";

import { composeIssueRecommendation } from "../src/analysis/recommendations.js";
import {
  classifyIssueContract,
  draftReplyContract,
  escalateSecurityContract,
  findDuplicateContract,
  requestReproductionContract,
  suggestLabelsContract,
  triageToolContracts,
} from "../src/analysis/tool-contracts.js";

describe("triage tool contracts", () => {
  it("exports OpenAI-compatible tool definitions", () => {
    const { registry, findings } = createContractRegistry({
      contracts: triageToolContracts,
    });
    const exports = exportOpenAITools(registry);

    expect(findings).toEqual([]);
    expect(exports.map((item) => item.contractName)).toEqual([
      "classify_issue",
      "suggest_labels",
      "find_duplicate",
      "request_reproduction",
      "draft_reply",
      "escalate_security",
    ]);
    expect(exports.every((item) => item.tool?.type === "function")).toBe(true);
    expect(exports.flatMap((item) => item.findings)).toEqual([]);
  });

  it("validates representative normalized tool calls", () => {
    expect(
      validateToolCall(classifyIssueContract, {
        name: "classify_issue",
        arguments: {
          classification: "bug",
          confidence: "high",
          rationale: "The issue describes broken behavior.",
        },
      }).ok,
    ).toBe(true);
    expect(
      validateToolCall(suggestLabelsContract, {
        name: "suggest_labels",
        arguments: {
          labels: [
            {
              name: "bug",
              confidence: "high",
              rationale: "Broken behavior.",
              exists: true,
            },
          ],
        },
      }).ok,
    ).toBe(true);
    expect(
      validateToolCall(findDuplicateContract, {
        name: "find_duplicate",
        arguments: {
          relatedIssues: [
            {
              issueNumber: 7,
              title: "Types not found",
              url: "https://github.com/owner/repo/issues/7",
              relationship: "likely-duplicate",
              confidence: "medium",
              rationale: "Same exports failure.",
            },
          ],
        },
      }).ok,
    ).toBe(true);
    expect(
      validateToolCall(requestReproductionContract, {
        name: "request_reproduction",
        arguments: {
          missingInformation: [
            {
              kind: "minimal-reproduction",
              question: "Can you share a minimal reproduction?",
            },
          ],
        },
      }).ok,
    ).toBe(true);
    expect(
      validateToolCall(draftReplyContract, {
        name: "draft_reply",
        arguments: {
          body: "Thanks for the report. Can you share a reproduction?",
          rationale: "A reproduction is required before maintainer action.",
        },
      }).ok,
    ).toBe(true);
    expect(
      validateToolCall(escalateSecurityContract, {
        name: "escalate_security",
        arguments: {
          sensitive: true,
          confidence: "medium",
          rationale: "The issue mentions token exposure.",
          publicReplyAllowed: false,
        },
      }).ok,
    ).toBe(true);
  });

  it("rejects invalid normalized tool calls", () => {
    const result = validateToolCall(classifyIssueContract, {
      name: "classify_issue",
      arguments: {
        classification: "enhancement",
        confidence: "high",
        rationale: "Not a supported category.",
      },
    });

    expect(result.ok).toBe(false);
  });
});

describe("composeIssueRecommendation", () => {
  it("composes validated tool decisions into one recommendation", () => {
    expect(
      composeIssueRecommendation({
        issueNumber: 12,
        classification: {
          classification: "bug",
          confidence: "high",
          rationale: "The issue describes broken behavior.",
        },
        labels: {
          labels: [
            {
              name: "bug",
              confidence: "high",
              rationale: "Broken behavior.",
              exists: true,
            },
          ],
        },
        duplicates: {
          relatedIssues: [
            {
              issueNumber: 7,
              title: "Types not found",
              url: "https://github.com/owner/repo/issues/7",
              relationship: "related",
              confidence: "medium",
              rationale: "Same area.",
            },
          ],
        },
        reproduction: {
          missingInformation: [
            {
              kind: "minimal-reproduction",
              question: "Can you share a minimal reproduction?",
            },
          ],
        },
        draftReply: {
          body: "Thanks for the report. Can you share a reproduction?",
          rationale: "A reproduction is needed.",
        },
        security: {
          sensitive: false,
          confidence: "high",
          rationale: "No security-sensitive content.",
          publicReplyAllowed: true,
        },
      }),
    ).toMatchObject({
      issueNumber: 12,
      classification: "bug",
      confidence: "high",
      suggestedLabels: [{ name: "bug" }],
      missingInformation: [{ kind: "minimal-reproduction" }],
      relatedIssues: [{ issueNumber: 7 }],
      draftReply: {
        body: "Thanks for the report. Can you share a reproduction?",
      },
      security: {
        sensitive: false,
      },
      rationale: "The issue describes broken behavior.",
      warnings: [],
    });
  });

  it("uses conservative defaults for missing optional tool decisions", () => {
    expect(composeIssueRecommendation({ issueNumber: 12 })).toMatchObject({
      issueNumber: 12,
      classification: "unclear",
      confidence: "low",
      suggestedLabels: [],
      missingInformation: [],
      relatedIssues: [],
      draftReply: null,
      security: {
        sensitive: false,
        publicReplyAllowed: true,
      },
      warnings: [],
    });
  });
});
