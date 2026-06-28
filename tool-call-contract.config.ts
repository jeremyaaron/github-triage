import { defineConfig } from "tool-call-contract";

import { triageToolContracts } from "./src/analysis/tool-contracts.js";

export default defineConfig({
  contracts: triageToolContracts,
  captures: {
    raw: ["captures/raw/*.json"],
    regression: ["captures/regression/*.json"],
  },
  redaction: {
    paths: [
      "input.*.content",
      "output.*.content",
      "messages.*.content",
      "comments.*.body",
      "author",
    ],
  },
});
