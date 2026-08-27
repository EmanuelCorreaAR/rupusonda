import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { IoTEvent } from "./IoTEvent.js";
import { parseIoTEvent } from "./parseIoTEvent.js";

export type IoTEventReadIssue = Readonly<{
  lineNumber: number;
  message: string;
}>;

/**
 * Stream canonical IoTEvent records from a JSONL capture.
 * I/O at the edges; parse steps are pure Results.
 */
export async function* readIoTEventJsonl(
  path: string,
): AsyncGenerator<IoTEvent, readonly IoTEventReadIssue[]> {
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
      issues.push(Object.freeze({ lineNumber, message: "invalid JSON" }));
      continue;
    }

    const event = parseIoTEvent(parsed, lineNumber);
    if (event.ok) {
      yield event.value;
    } else {
      issues.push(Object.freeze({ lineNumber, message: event.error.message }));
    }
  }

  return Object.freeze(issues);
}

export const collectIoTEventJsonl = async (
  path: string,
): Promise<Readonly<{ events: readonly IoTEvent[]; issues: readonly IoTEventReadIssue[] }>> => {
  const events: IoTEvent[] = [];
  const generator = readIoTEventJsonl(path);
  let next = await generator.next();
  while (!next.done) {
    events.push(next.value);
    next = await generator.next();
  }
  return Object.freeze({ events: Object.freeze(events), issues: next.value });
};
