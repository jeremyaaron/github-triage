#!/usr/bin/env node
import { version } from "../index.js";

const args = process.argv.slice(2);

if (args.includes("--version") || args.includes("-v")) {
  console.log(version);
  process.exitCode = 0;
} else {
  console.log("github-triage");
  console.log("");
  console.log("Usage:");
  console.log("  github-triage --version");
  console.log("");
  console.log("The review command will be implemented in the v0.1.0 MVP phases.");
  process.exitCode = 0;
}
