import { createInterface } from "node:readline";
import { createReadStream } from "node:fs";
import { RupuSondaError } from "../errors.js";
import { isProtocol } from "../protocol/Protocol.js";
import type { Protocol } from "../protocol/Protocol.js";

export type RawIngestRecord = {
  protocol: Protocol;
  lineNumber: number;
  raw: Record<string, unknown>;
};

export type IngestIssue = {
  lineNumber: number;
  message: string;
};

export type IngestOptions = {
  /** Stop after this many hard parse failures (default: unlimited). */
  maxErrors?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function* ingestJsonl(
  path: string,
  options: IngestOptions = {},
): AsyncGenerator<RawIngestRecord, IngestIssue[]> {
  const issues: IngestIssue[] = [];
  const stream = createReadStream(path, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      issues.push({ lineNumber, message: "invalid JSON" });
      if (options.maxErrors !== undefined && issues.length >= options.maxErrors) {
        throw new RupuSondaError(
          "data",
          `Too many JSONL parse errors in ${path} (stopped at line ${lineNumber})`,
        );
      }
      continue;
    }

    if (!isRecord(parsed)) {
      issues.push({ lineNumber, message: "line must be a JSON object" });
      continue;
    }

    const protocol = parsed["protocol"];
    if (!isProtocol(protocol)) {
      issues.push({
        lineNumber,
        message: `missing or unsupported protocol (got ${JSON.stringify(protocol)})`,
      });
      continue;
    }

    yield { protocol, lineNumber, raw: parsed };
  }

  return issues;
}

/** Collect all records (and issues) from a JSONL file without loading the file as one blob. */
export async function collectJsonl(
  path: string,
  options: IngestOptions = {},
): Promise<{ records: RawIngestRecord[]; issues: IngestIssue[] }> {
  const records: RawIngestRecord[] = [];
  const generator = ingestJsonl(path, options);
  let next = await generator.next();
  while (!next.done) {
    records.push(next.value);
    next = await generator.next();
  }
  return { records, issues: next.value };
}
