import { access, writeFile } from "node:fs/promises";
import { createDefaultRegistry } from "../../core/createRegistry.js";
import { collectJsonl } from "../../core/ingest/Ingestor.js";
import { normalizeRecord } from "../../core/normalize/Normalizer.js";
import { inferSchema, type SchemaResult } from "../../core/schema/inferSchema.js";
import { buildAudit, type AuditEnvelope } from "../../core/audit.js";
import { RupuSondaError } from "../../core/errors.js";
import type { IoTEvent } from "../../core/event/IoTEvent.js";

export type SchemaOptions = Readonly<{
  path: string;
  json: boolean;
  output?: string;
}>;

export type SchemaOutput = AuditEnvelope<SchemaResult>;

async function assertReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new RupuSondaError("usage", `File not found: ${path}`);
  }
}

/**
 * I/O boundary: read JSONL, then pure fold (normalize + schema inference).
 */
export async function runSchema(options: SchemaOptions): Promise<SchemaOutput> {
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

  const result = inferSchema(events, issues.length + normalizeIssues);

  if (options.output !== undefined) {
    await writeFile(options.output, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  }

  return buildAudit(
    "schema",
    {
      path: options.path,
      events: result.events,
      issues: result.issues,
      ...(options.output !== undefined ? { output: options.output } : {}),
    },
    {
      json: options.json,
      ...(options.output !== undefined ? { output: options.output } : {}),
    },
    result,
  );
}
