import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { formatJson } from "tool-call-contract";

export interface WriteAnalysisTraceOptions {
  captureDir: string;
  issueNumber: number;
  rawResponse: unknown;
  normalizedCalls: unknown;
}

export interface AnalysisTracePaths {
  rawPath: string;
  normalizedPath: string;
}

export async function writeAnalysisTrace(
  options: WriteAnalysisTraceOptions,
): Promise<AnalysisTracePaths> {
  const rawDir = path.join(options.captureDir, "raw");
  const normalizedDir = path.join(options.captureDir, "regression");
  const fileName = `issue-${options.issueNumber}.json`;
  const rawPath = path.join(rawDir, fileName);
  const normalizedPath = path.join(normalizedDir, fileName);

  await mkdir(rawDir, { recursive: true });
  await mkdir(normalizedDir, { recursive: true });
  await writeFile(rawPath, formatJson(options.rawResponse), "utf8");
  await writeFile(normalizedPath, formatJson(options.normalizedCalls), "utf8");

  return { rawPath, normalizedPath };
}
