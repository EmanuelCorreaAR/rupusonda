import { access } from "node:fs/promises";
import { createDefaultRegistry } from "../../core/createRegistry.js";
import { collectJsonl } from "../../core/ingest/Ingestor.js";
import { inspectEvents, type InspectResult } from "../../core/inspect/Inspector.js";
import { normalizeRecord } from "../../core/normalize/Normalizer.js";
import { buildAudit, type AuditEnvelope } from "../../core/audit.js";
import { RupuSondaError } from "../../core/errors.js";
import type { IoTEvent } from "../../core/event/IoTEvent.js";

export type InspectOptions = Readonly<{
  path: string;
  json: boolean;
}>;

export type InspectOutput = AuditEnvelope<InspectResult>;

async function assertReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new RupuSondaError("usage", `File not found: ${path}`);
  }
}

/**
 * I/O boundary: read JSONL, then pure fold (normalize + inspect).
 */
export async function runInspect(options: InspectOptions): Promise<InspectOutput> {
  await assertReadable(options.path);

  const registry = createDefaultRegistry();
  const { records, issues } = await collectJsonl(options.path);

  const normalized = records.map((record) => normalizeRecord(registry, record));
  const events: IoTEvent[] = [];
  let normalizeIssues = 0;

  for (const result of normalized) {
    if (result.ok) {
      events.push(result.value);
    } else {
      normalizeIssues += 1;
    }
  }

  const result = inspectEvents(events, issues.length + normalizeIssues);

  return buildAudit(
    "inspect",
    {
      path: options.path,
      events: result.events,
      issues: result.issues,
    },
    {
      json: options.json,
    },
    result,
  );
}
