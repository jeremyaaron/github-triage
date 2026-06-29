import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  projectConfigFileName,
  projectConfigSchema,
  readProjectConfig,
} from "../src/config/project-config.js";

describe("projectConfigSchema", () => {
  it("parses supported configuration fields", () => {
    expect(
      projectConfigSchema.parse({
        since: "30d",
        comments: 5,
        report: "all",
        outputDir: ".github-triage/reports",
        reportId: "smoke",
        model: "gpt-test",
      }),
    ).toEqual({
      since: "30d",
      comments: 5,
      report: "all",
      outputDir: ".github-triage/reports",
      reportId: "smoke",
      model: "gpt-test",
    });
  });

  it("rejects unsupported keys", () => {
    expect(() =>
      projectConfigSchema.parse({
        since: "30d",
        token: "secret",
      }),
    ).toThrow();
  });
});

describe("readProjectConfig", () => {
  it("returns an empty config when .github-triage.json is absent", async () => {
    const root = await createProjectRoot();

    await expect(readProjectConfig({ root })).resolves.toEqual({});
  });

  it("reads valid project config", async () => {
    const root = await createProjectRoot({
      since: "14d",
      comments: 0,
      report: "markdown",
      outputDir: "reports",
      reportId: "weekly",
      model: "gpt-test",
    });

    await expect(readProjectConfig({ root })).resolves.toEqual({
      since: "14d",
      comments: 0,
      report: "markdown",
      outputDir: "reports",
      reportId: "weekly",
      model: "gpt-test",
    });
  });

  it("fails with config.invalid-json for invalid JSON", async () => {
    const root = await createProjectRoot();
    await writeFile(path.join(root, projectConfigFileName), "{", "utf8");

    await expect(readProjectConfig({ root })).rejects.toMatchObject({
      code: "config.invalid-json",
      exitCode: 2,
    });
  });

  it("fails with config.invalid-shape for invalid field values", async () => {
    const root = await createProjectRoot({
      comments: 21,
    });

    await expect(readProjectConfig({ root })).rejects.toMatchObject({
      code: "config.invalid-shape",
      exitCode: 2,
    });
  });

  it("fails with config.invalid-shape for invalid report ids", async () => {
    const root = await createProjectRoot({
      reportId: "../escape",
    });

    await expect(readProjectConfig({ root })).rejects.toMatchObject({
      code: "config.invalid-shape",
      exitCode: 2,
      message: expect.stringContaining("invalid reportId"),
    });
  });

  it("rejects unsupported secret and capture fields", async () => {
    for (const config of [
      { openaiApiKey: "secret" },
      { githubToken: "secret" },
      { captureDir: "captures" },
    ]) {
      const root = await createProjectRoot(config);

      await expect(readProjectConfig({ root })).rejects.toMatchObject({
        code: "config.invalid-shape",
        exitCode: 2,
      });
    }
  });
});

async function createProjectRoot(config?: unknown): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "github-triage-config-"));

  if (config !== undefined) {
    await writeFile(path.join(root, projectConfigFileName), JSON.stringify(config), "utf8");
  }

  return root;
}
