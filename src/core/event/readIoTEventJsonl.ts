import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { RupuSondaError } from "../errors.js";
import type { IoTEvent } from "./IoTEvent.js";
import { parseIoTEvent } from "./parseIoTEvent.js";

export type IoTEventReadIssue = {
  lineNumber: number;
  message: string;
};

/**
 * Stream canonical IoTEvent records from a JSONL capture (one event per line).
 */
export async function* readIoTEventJsonl(
  path: string,
): AsyncGenerator<IoTEvent, IoTEventReadIssue[]> {
  const issues: IoTEventReadIssue[] = [];
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
      continue;
    }

    try {
      yield parseIoTEvent(parsed, lineNumber);
    } catch (error) {
      const message =
        error instanceof RupuSondaError ? error.message : "invalid IoTEvent";
      issues.push({ lineNumber, message });
    }
  }

  return issues;
}

export async function collectIoTEventJsonl(
  path: string,
): Promise<{ events: IoTEvent[]; issues: IoTEventReadIssue[] }> {
  const events: IoTEvent[] = [];
  const generator = readIoTEventJsonl(path);
  let next = await generator.next();
  while (!next.done) {
    events.push(next.value);
    next = await generator.next();
  }
  return { events, issues: next.value };
}
