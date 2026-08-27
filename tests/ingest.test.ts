import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectJsonl } from "../src/core/ingest/Ingestor.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures", "mqtt");

describe("JSONL ingestion", () => {
  it("streams records from simple fixture", async () => {
    const { records, issues } = await collectJsonl(path.join(fixtures, "simple.jsonl"));
    expect(records).toHaveLength(2);
    expect(issues).toHaveLength(0);
    expect(records[0]?.protocol).toBe("mqtt");
  });

  it("handles malformed lines and reports useful errors", async () => {
    const { records, issues } = await collectJsonl(path.join(fixtures, "malformed.jsonl"));
    expect(records.length).toBeGreaterThanOrEqual(2);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.message.includes("invalid JSON"))).toBe(true);
    expect(issues.some((i) => i.message.includes("unsupported protocol"))).toBe(true);
  });

  it("preserves line numbers for issues", async () => {
    const { issues } = await collectJsonl(path.join(fixtures, "malformed.jsonl"));
    const lineNumbers = issues.map((i) => i.lineNumber).sort((a, b) => a - b);
    expect(lineNumbers).toContain(2);
  });
});
