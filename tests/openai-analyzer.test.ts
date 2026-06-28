import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_OPENAI_MODEL,
  OpenAIResponsesIssueAnalyzer,
  createOpenAIResponsesIssueAnalyzer,
  extractFunctionCallsForTest,
  type OpenAIResponseCreateInput,
  type OpenAIResponsesClient,
} from "../src/analysis/analyzer.js";
import type { AnalyzeIssueInput } from "../src/core/review.js";

describe("OpenAIResponsesIssueAnalyzer", () => {
  it("sends a Responses request with required tools and composes recommendations", async () => {
    const requests: OpenAIResponseCreateInput[] = [];
    const analyzer = new OpenAIResponsesIssueAnalyzer({
      model: "gpt-test",
      client: createFakeClient(requests, createValidResponse()),
    });

    const recommendation = await analyzer.analyzeIssue(createAnalyzeInput());

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      model: "gpt-test",
      tool_choice: "required",
    });
    expect(requests[0]?.input).toContain("Repository:");
    expect(requests[0]?.input).toContain("Duplicate candidates:");
    expect(requests[0]?.tools).toHaveLength(6);
    expect(recommendation).toMatchObject({
      issueNumber: 12,
      classification: "bug",
      confidence: "high",
      suggestedLabels: [{ name: "bug", exists: true }],
      missingInformation: [{ kind: "minimal-reproduction" }],
      relatedIssues: [{ issueNumber: 7, relationship: "related" }],
      draftReply: {
        body: "Thanks for the report. Can you share a minimal reproduction?",
      },
      security: {
        sensitive: false,
        publicReplyAllowed: true,
      },
      warnings: [],
    });
  });

  it("uses security precheck fallback and warnings for invalid model output", async () => {
    const analyzer = new OpenAIResponsesIssueAnalyzer({
      model: "gpt-test",
      client: createFakeClient([], {
        output: [
          {
            type: "function_call",
            call_id: "call_bad",
            name: "classify_issue",
            arguments: JSON.stringify({
              classification: "enhancement",
              confidence: "high",
              rationale: "Unsupported category.",
            }),
          },
        ],
      }),
    });

    const recommendation = await analyzer.analyzeIssue({
      ...createAnalyzeInput(),
      securityPrecheck: {
        sensitive: true,
        confidence: "medium",
        indicators: ["token"],
        rationale: "Matched security indicator(s): token.",
      },
    });

    expect(recommendation.classification).toBe("unclear");
    expect(recommendation.security).toMatchObject({
      sensitive: true,
      confidence: "medium",
      publicReplyAllowed: false,
    });
    expect(recommendation.warnings.map((warning) => warning.code)).toContain(
      "analysis.output-invalid",
    );
    expect(recommendation.warnings.map((warning) => warning.code)).toContain(
      "analysis.output-missing",
    );
  });

  it("writes raw and normalized captures when captureDir is configured", async () => {
    const captureDir = await mkdtemp(path.join(os.tmpdir(), "github-triage-captures-"));
    const analyzer = new OpenAIResponsesIssueAnalyzer({
      model: "gpt-test",
      client: createFakeClient([], createValidResponse()),
      captureDir,
    });

    await analyzer.analyzeIssue(createAnalyzeInput());

    const raw = await readFile(path.join(captureDir, "raw", "issue-12.json"), "utf8");
    const normalized = await readFile(
      path.join(captureDir, "regression", "issue-12.json"),
      "utf8",
    );

    expect(raw).toContain('"output"');
    expect(normalized).toContain('"name": "classify_issue"');
    expect(normalized).toContain('"name": "escalate_security"');
  });

  it("maps OpenAI request failures to analysis.model-failed", async () => {
    const analyzer = new OpenAIResponsesIssueAnalyzer({
      model: "gpt-test",
      client: {
        responses: {
          async create() {
            throw new Error("network failed");
          },
        },
      },
    });

    await expect(analyzer.analyzeIssue(createAnalyzeInput())).rejects.toMatchObject({
      code: "analysis.model-failed",
      exitCode: 1,
    });
  });
});

describe("createOpenAIResponsesIssueAnalyzer", () => {
  it("requires OPENAI_API_KEY", () => {
    expect(() => createOpenAIResponsesIssueAnalyzer({ env: {} })).toThrow(/OPENAI_API_KEY/);
  });

  it("exposes the documented default model constant", () => {
    expect(DEFAULT_OPENAI_MODEL).toBe("gpt-5.5");
  });
});

describe("extractFunctionCallsForTest", () => {
  it("normalizes OpenAI Responses function calls", () => {
    expect(extractFunctionCallsForTest(createValidResponse()).map((call) => call.name)).toEqual([
      "classify_issue",
      "suggest_labels",
      "find_duplicate",
      "request_reproduction",
      "draft_reply",
      "escalate_security",
    ]);
  });
});

function createFakeClient(
  requests: OpenAIResponseCreateInput[],
  response: unknown,
): OpenAIResponsesClient {
  return {
    responses: {
      async create(input) {
        requests.push(input);
        return response;
      },
    },
  };
}

function createAnalyzeInput(): AnalyzeIssueInput {
  return {
    repository: { owner: "jeremyaaron", name: "pkg-guard" },
    repositoryLabels: [{ name: "bug", description: "Something is not working" }],
    duplicateCandidates: [
      {
        issueNumber: 7,
        title: "Types not found",
        url: "https://github.com/owner/repo/issues/7",
        reason: "Shared terms: types, exports",
        score: 0.5,
      },
    ],
    securityPrecheck: {
      sensitive: false,
      confidence: "low",
      indicators: [],
      rationale: "No obvious security-sensitive indicators matched.",
    },
    issue: {
      number: 12,
      title: "Exports map missing types",
      body: "The package fails TypeScript resolution.",
      author: "octocat",
      state: "open",
      labels: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      commentCount: 0,
      url: "https://github.com/owner/repo/issues/12",
      comments: [],
    },
  };
}

function createValidResponse(): unknown {
  return {
    output: [
      createFunctionCall("classify_issue", {
        classification: "bug",
        confidence: "high",
        rationale: "The issue describes broken behavior.",
      }),
      createFunctionCall("suggest_labels", {
        labels: [
          {
            name: "bug",
            confidence: "high",
            rationale: "Broken behavior.",
            exists: true,
          },
        ],
      }),
      createFunctionCall("find_duplicate", {
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
      }),
      createFunctionCall("request_reproduction", {
        missingInformation: [
          {
            kind: "minimal-reproduction",
            question: "Can you share a minimal reproduction?",
          },
        ],
      }),
      createFunctionCall("draft_reply", {
        body: "Thanks for the report. Can you share a minimal reproduction?",
        rationale: "A reproduction is needed.",
      }),
      createFunctionCall("escalate_security", {
        sensitive: false,
        confidence: "high",
        rationale: "No security-sensitive content.",
        publicReplyAllowed: true,
      }),
    ],
  };
}

function createFunctionCall(name: string, args: unknown): unknown {
  return {
    type: "function_call",
    call_id: `call_${name}`,
    name,
    arguments: JSON.stringify(args),
  };
}
