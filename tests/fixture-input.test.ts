import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import type { IssueSourceDocument } from "../src/core/schemas.js";
import { readIssueSourceFile } from "../src/fixtures/issue-source.js";

describe("readIssueSourceFile", () => {
  it("reads and validates issue-source JSON", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-fixture-"));
    const fixturePath = path.join(dir, "issues.json");
    await writeFile(fixturePath, JSON.stringify(createFixtureDocument()), "utf8");

    const document = await readIssueSourceFile(fixturePath);

    expect(document.repository).toEqual({
      owner: "jeremyaaron",
      name: "pkg-guard",
    });
    expect(document.issues).toHaveLength(1);
  });

  it("maps invalid JSON to fixture.invalid-json", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-fixture-"));
    const fixturePath = path.join(dir, "issues.json");
    await writeFile(fixturePath, "{ nope", "utf8");

    await expect(readIssueSourceFile(fixturePath)).rejects.toMatchObject({
      code: "fixture.invalid-json",
      exitCode: 1,
    } satisfies Partial<GithubTriageError>);
  });

  it("maps invalid fixture shapes to fixture.invalid-shape", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "github-triage-fixture-"));
    const fixturePath = path.join(dir, "issues.json");
    await writeFile(
      fixturePath,
      JSON.stringify({
        ...createFixtureDocument(),
        issues: [{ number: -1 }],
      }),
      "utf8",
    );

    await expect(readIssueSourceFile(fixturePath)).rejects.toMatchObject({
      code: "fixture.invalid-shape",
      exitCode: 1,
    } satisfies Partial<GithubTriageError>);
  });
});

function createFixtureDocument(): IssueSourceDocument {
  return {
    schemaVersion: 1,
    repository: {
      owner: "jeremyaaron",
      name: "pkg-guard",
    },
    labels: [{ name: "bug", description: "Something is not working" }],
    issues: [
      {
        number: 12,
        title: "Exports map missing types",
        body: "The package fails TypeScript resolution.",
        author: "octocat",
        state: "open",
        labels: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        commentCount: 0,
        url: "https://github.com/jeremyaaron/pkg-guard/issues/12",
        comments: [],
      },
    ],
  };
}
