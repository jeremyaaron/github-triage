import { readFile } from "node:fs/promises";

import { GithubTriageError } from "../core/errors.js";
import { issueSourceDocumentSchema, type IssueSourceDocument } from "../core/schemas.js";

export async function readIssueSourceFile(path: string): Promise<IssueSourceDocument> {
  let raw: string;

  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    throw new GithubTriageError({
      code: "fixture.invalid-json",
      message: `Could not read issue fixture file "${path}".`,
      exitCode: 1,
      cause: error,
    });
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new GithubTriageError({
      code: "fixture.invalid-json",
      message: `Issue fixture file "${path}" is not valid JSON.`,
      exitCode: 1,
      cause: error,
    });
  }

  const result = issueSourceDocumentSchema.safeParse(parsed);

  if (!result.success) {
    throw new GithubTriageError({
      code: "fixture.invalid-shape",
      message: `Issue fixture file "${path}" does not match the issue-source schema.`,
      exitCode: 1,
      details: result.error.issues,
    });
  }

  return result.data;
}
