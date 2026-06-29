import path from "node:path";

import { describe, expect, it } from "vitest";

import { GithubTriageError } from "../src/core/errors.js";
import {
  createDefaultReportId,
  defaultReportOutputDir,
  planReportPaths,
} from "../src/reports/paths.js";

describe("report path planning", () => {
  const repo = {
    owner: "jeremyaaron",
    name: "pkg-guard",
  };

  it("creates default UTC report ids", () => {
    expect(createDefaultReportId(new Date("2026-06-28T15:30:05.000Z"))).toBe(
      "20260628-153005Z",
    );
  });

  it("plans Markdown and JSON paths by default output directory", () => {
    const plan = planReportPaths({
      repo,
      report: "all",
      reportId: "fixture",
    });

    expect(plan).toEqual({
      outputDir: defaultReportOutputDir,
      reportId: "fixture",
      baseName: "jeremyaaron-pkg-guard-fixture",
      markdownPath: path.join(defaultReportOutputDir, "jeremyaaron-pkg-guard-fixture.md"),
      jsonPath: path.join(defaultReportOutputDir, "jeremyaaron-pkg-guard-fixture.json"),
      files: [
        {
          format: "markdown",
          path: path.join(defaultReportOutputDir, "jeremyaaron-pkg-guard-fixture.md"),
        },
        {
          format: "json",
          path: path.join(defaultReportOutputDir, "jeremyaaron-pkg-guard-fixture.json"),
        },
      ],
    });
  });

  it("plans no report files when report output is none", () => {
    const plan = planReportPaths({
      repo,
      report: "none",
      outputDir: "reports",
      reportId: "terminal",
    });

    expect(plan.files).toEqual([]);
    expect(plan.markdownPath).toBeUndefined();
    expect(plan.jsonPath).toBeUndefined();
  });

  it("plans Markdown-only report paths", () => {
    const plan = planReportPaths({
      repo,
      report: "markdown",
      outputDir: "reports",
      reportId: "manual",
    });

    expect(plan.files).toEqual([
      {
        format: "markdown",
        path: path.join("reports", "jeremyaaron-pkg-guard-manual.md"),
      },
    ]);
    expect(plan.markdownPath).toBe(path.join("reports", "jeremyaaron-pkg-guard-manual.md"));
    expect(plan.jsonPath).toBeUndefined();
  });

  it("plans JSON-only report paths", () => {
    const plan = planReportPaths({
      repo,
      report: "json",
      outputDir: "reports",
      reportId: "machine",
    });

    expect(plan.files).toEqual([
      {
        format: "json",
        path: path.join("reports", "jeremyaaron-pkg-guard-machine.json"),
      },
    ]);
    expect(plan.markdownPath).toBeUndefined();
    expect(plan.jsonPath).toBe(path.join("reports", "jeremyaaron-pkg-guard-machine.json"));
  });

  it("uses the current time when report id is omitted", () => {
    const plan = planReportPaths({
      repo,
      report: "json",
      now: new Date("2026-06-28T15:30:05.000Z"),
    });

    expect(plan.reportId).toBe("20260628-153005Z");
    expect(plan.jsonPath).toBe(
      path.join(defaultReportOutputDir, "jeremyaaron-pkg-guard-20260628-153005Z.json"),
    );
  });

  it("rejects unsafe report ids before building paths", () => {
    expect(() =>
      planReportPaths({
        repo,
        report: "json",
        reportId: "../outside",
      }),
    ).toThrow(GithubTriageError);
  });
});
