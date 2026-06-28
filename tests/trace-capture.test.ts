import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { writeAnalysisTrace } from "../src/analysis/trace-capture.js";

describe("writeAnalysisTrace", () => {
  it("writes raw and normalized trace files", async () => {
    const captureDir = await mkdtemp(path.join(os.tmpdir(), "github-triage-trace-"));

    const paths = await writeAnalysisTrace({
      captureDir,
      issueNumber: 42,
      rawResponse: { output: [{ type: "function_call" }] },
      normalizedCalls: [{ name: "classify_issue", arguments: { classification: "bug" } }],
    });

    expect(paths).toEqual({
      rawPath: path.join(captureDir, "raw", "issue-42.json"),
      normalizedPath: path.join(captureDir, "regression", "issue-42.json"),
    });
    await expect(readFile(paths.rawPath, "utf8")).resolves.toContain('"output"');
    await expect(readFile(paths.normalizedPath, "utf8")).resolves.toContain(
      '"name": "classify_issue"',
    );
  });
});
