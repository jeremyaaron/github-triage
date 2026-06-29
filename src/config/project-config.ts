import { readFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { GithubTriageError } from "../core/errors.js";
import { parseReportId } from "../core/schemas.js";

export const projectConfigFileName = ".github-triage.json";

export const projectConfigSchema = z
  .object({
    since: z.string().min(1).optional(),
    comments: z.number().int().min(0).max(20).optional(),
    report: z.enum(["none", "markdown", "json", "all"]).optional(),
    outputDir: z.string().min(1).optional(),
    reportId: z.string().min(1).optional(),
    model: z.string().min(1).optional(),
  })
  .strict();

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export interface ReadProjectConfigOptions {
  root: string;
}

export async function readProjectConfig(
  options: ReadProjectConfigOptions,
): Promise<ProjectConfig> {
  const configPath = path.join(options.root, projectConfigFileName);
  let raw: string;

  try {
    raw = await readFile(configPath, "utf8");
  } catch (error) {
    if (isFileMissingError(error)) {
      return {};
    }

    throw new GithubTriageError({
      code: "config.invalid-json",
      message: `Could not read ${projectConfigFileName}.`,
      exitCode: 2,
      cause: error,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GithubTriageError({
      code: "config.invalid-json",
      message: `${projectConfigFileName} is not valid JSON.`,
      exitCode: 2,
      cause: error,
    });
  }

  const result = projectConfigSchema.safeParse(parsed);

  if (!result.success) {
    throw new GithubTriageError({
      code: "config.invalid-shape",
      message: `${projectConfigFileName} does not match the project config schema.`,
      exitCode: 2,
      details: result.error.issues,
    });
  }

  if (result.data.reportId) {
    try {
      parseReportId(result.data.reportId);
    } catch (error) {
      throw new GithubTriageError({
        code: "config.invalid-shape",
        message: `${projectConfigFileName} contains an invalid reportId.`,
        exitCode: 2,
        cause: error,
      });
    }
  }

  return result.data;
}

function isFileMissingError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
