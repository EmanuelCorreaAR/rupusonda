import { createWriteStream } from "node:fs";
import { access } from "node:fs/promises";
import { finished } from "node:stream/promises";
import type { Writable } from "node:stream";
import { createDefaultRegistry } from "../../core/createRegistry.js";
import { buildAudit } from "../../core/audit.js";
import { RupuSondaError } from "../../core/errors.js";
import { ingestJsonl } from "../../core/ingest/Ingestor.js";
import { Normalizer } from "../../core/normalize/Normalizer.js";
import type { AuditEnvelope } from "../../core/audit.js";

export type IngestCliOptions = {
  path: string;
  output?: string;
  json: boolean;
};

export type IngestResult = {
  events: number;
  written: number;
  issues: number;
  output: string | null;
};

async function assertReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new RupuSondaError("usage", `File not found: ${path}`);
  }
}

export async function runIngest(
  options: IngestCliOptions,
): Promise<AuditEnvelope<IngestResult>> {
  await assertReadable(options.path);

  const registry = createDefaultRegistry();
  const normalizer = new Normalizer(registry);

  let events = 0;
  let written = 0;
  let issues = 0;

  const outputPath = options.output ?? null;
  let stream: Writable | undefined;
  if (!options.json) {
    stream = options.output
      ? createWriteStream(options.output, { encoding: "utf8" })
      : process.stdout;
  }

  const generator = ingestJsonl(options.path);
  let next = await generator.next();
  while (!next.done) {
    try {
      const event = normalizer.normalize(next.value);
      events += 1;
      if (stream) {
        const line = `${JSON.stringify(event)}\n`;
        const ok = stream.write(line);
        written += 1;
        if (!ok && stream !== process.stdout) {
          await new Promise<void>((resolve) => stream!.once("drain", resolve));
        }
      }
    } catch {
      issues += 1;
    }
    next = await generator.next();
  }
  issues += next.value.length;

  if (stream && stream !== process.stdout) {
    stream.end();
    await finished(stream);
  }

  return buildAudit(
    "ingest",
    {
      path: options.path,
      events,
      issues,
    },
    {
      output: outputPath,
      json: options.json,
    },
    {
      events,
      written,
      issues,
      output: outputPath,
    },
  );
}
