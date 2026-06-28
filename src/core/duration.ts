import { createUsageError } from "./errors.js";
import { durationWindowSchema, type DurationWindow } from "./schemas.js";

const dayDurationPattern = /^([1-9][0-9]*)d$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function parseDurationWindow(input: string, now = new Date()): DurationWindow {
  const match = dayDurationPattern.exec(input);

  if (!match) {
    throw createUsageError(
      "cli.invalid-duration",
      `Invalid --since value "${input}". Use a day-based duration such as 7d, 30d, or 90d.`,
    );
  }

  const days = Number(match[1]);

  if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
    throw createUsageError(
      "cli.invalid-duration",
      `Invalid --since value "${input}". Use a duration between 1d and 3650d.`,
    );
  }

  const sinceDate = new Date(now.getTime() - days * millisecondsPerDay).toISOString();
  return durationWindowSchema.parse({ input, days, sinceDate });
}
