import { access } from "node:fs/promises";
import { createDefaultRegistry } from "../../core/createRegistry.js";
import { collectJsonl } from "../../core/ingest/Ingestor.js";
import { Inspector } from "../../core/inspect/Inspector.js";
import { Normalizer } from "../../core/normalize/Normalizer.js";
import { buildAudit } from "../../core/audit.js";
import { RupuSondaError } from "../../core/errors.js";
import type { InspectResult } from "../../core/inspect/Inspector.js";
import type { AuditEnvelope } from "../../core/audit.js";

export type InspectOptions = {
  path: string;
  json: boolean;
};

export type InspectOutput = AuditEnvelope<InspectResult>;

async function assertReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new RupuSondaError("usage", `File not found: ${path}`);
  }
}

export async function runInspect(options: InspectOptions): Promise<InspectOutput> {
  await assertReadable(options.path);

  const registry = createDefaultRegistry();
  const normalizer = new Normalizer(registry);
  const inspector = new Inspector();

  const { records, issues } = await collectJsonl(options.path);
  for (let i = 0; i < issues.length; i += 1) {
    inspector.addIssue();
  }

  for (const record of records) {
    try {
      const event = normalizer.normalize(record);
      inspector.add(event);
    } catch (error) {
      inspector.addIssue();
      if (error instanceof RupuSondaError) {
        // Keep going for inspect; issues are counted.
        continue;
      }
      throw error;
    }
  }

  const result = inspector.result();

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
