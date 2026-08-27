import mqtt from "mqtt";
import { access } from "node:fs/promises";
import { buildAudit } from "../../core/audit.js";
import type { AuditEnvelope } from "../../core/audit.js";
import { RupuSondaError } from "../../core/errors.js";
import { readIoTEventJsonl } from "../../core/event/readIoTEventJsonl.js";
import type { IoTEvent } from "../../core/event/IoTEvent.js";
import {
  encodeMqttReplayPayload,
  requireReplayTopic,
} from "../../protocols/mqtt/MqttReplayCodec.js";

export type MqttReplayOptions = {
  path: string;
  url: string;
  /** Fixed pause between publishes (ms). Ignored when preserveTiming is true. */
  delayMs?: number;
  /** Replay using original inter-event timestamp deltas. */
  preserveTiming?: boolean;
  maxMessages?: number;
  /** Plan the replay without connecting to a broker. */
  dryRun?: boolean;
  json?: boolean;
};

export type MqttReplayResult = {
  path: string;
  url: string;
  published: number;
  skipped: number;
  issues: number;
  dryRun: boolean;
  preserveTiming: boolean;
  delayMs: number | null;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestampMs(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

async function assertReadable(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new RupuSondaError("usage", `File not found: ${path}`);
  }
}

export type ReplayPlanItem = {
  topic: string;
  payload: Buffer | string;
  event: IoTEvent;
};

/** Build an in-order publish plan from a capture (streaming). Pure planning aside from file I/O. */
export async function planMqttReplay(
  path: string,
  maxMessages?: number,
): Promise<{ plan: ReplayPlanItem[]; issues: number; skipped: number }> {
  const plan: ReplayPlanItem[] = [];
  let issues = 0;
  let skipped = 0;

  const generator = readIoTEventJsonl(path);
  let next = await generator.next();
  while (!next.done) {
    const event = next.value;
    if (event.source.protocol !== "mqtt") {
      skipped += 1;
      next = await generator.next();
      continue;
    }

    const topic = requireReplayTopic(event);
    if (!topic.ok) {
      issues += 1;
      next = await generator.next();
      continue;
    }

    plan.push({
      topic: topic.value,
      payload: encodeMqttReplayPayload(event),
      event,
    });

    if (maxMessages !== undefined && plan.length >= maxMessages) {
      break;
    }
    next = await generator.next();
  }
  if (next.done) {
    issues += next.value.length;
  }

  return { plan, issues, skipped };
}

export async function runMqttReplay(
  options: MqttReplayOptions,
  onPublish?: (item: ReplayPlanItem, index: number) => void,
): Promise<AuditEnvelope<MqttReplayResult>> {
  await assertReadable(options.path);

  const preserveTiming = options.preserveTiming === true;
  const delayMs = options.delayMs ?? 0;
  const dryRun = options.dryRun === true;

  const { plan, issues, skipped } = await planMqttReplay(
    options.path,
    options.maxMessages,
  );

  if (!dryRun) {
    const client = mqtt.connect(options.url);
    await new Promise<void>((resolve, reject) => {
      client.once("connect", () => resolve());
      client.once("error", (err) =>
        reject(new RupuSondaError("protocol", `MQTT connect failed: ${err.message}`)),
      );
    });

    try {
      let previousTs: number | null = null;
      for (let i = 0; i < plan.length; i += 1) {
        const item = plan[i];
        if (!item) {
          continue;
        }

        if (preserveTiming) {
          const current = timestampMs(item.event.timestamp);
          if (previousTs !== null && current !== null && current > previousTs) {
            await sleep(current - previousTs);
          }
          if (current !== null) {
            previousTs = current;
          }
        } else if (delayMs > 0 && i > 0) {
          await sleep(delayMs);
        }

        await new Promise<void>((resolve, reject) => {
          client.publish(item.topic, item.payload, (err) => {
            if (err) {
              reject(new RupuSondaError("protocol", `MQTT publish failed: ${err.message}`));
              return;
            }
            resolve();
          });
        });
        onPublish?.(item, i);
      }
    } finally {
      client.end(true);
    }
  } else {
    for (let i = 0; i < plan.length; i += 1) {
      const item = plan[i];
      if (item) {
        onPublish?.(item, i);
      }
    }
  }

  const result: MqttReplayResult = {
    path: options.path,
    url: options.url,
    published: plan.length,
    skipped,
    issues,
    dryRun,
    preserveTiming,
    delayMs: preserveTiming ? null : delayMs > 0 ? delayMs : null,
  };

  return buildAudit(
    "mqtt.replay",
    {
      path: options.path,
      events: plan.length,
      issues,
    },
    {
      url: options.url,
      dryRun,
      preserveTiming,
      delayMs: result.delayMs,
      maxMessages: options.maxMessages ?? null,
      json: options.json === true,
    },
    result,
  );
}
