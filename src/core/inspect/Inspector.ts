import type { IoTEvent } from "../event/IoTEvent.js";
import type { Protocol } from "../protocol/Protocol.js";

export type PayloadKind = keyof PayloadKindCount;

export type PayloadKindCount = Readonly<{
  json: number;
  text: number;
  number: number;
  boolean: number;
  null: number;
  binary: number;
  unknown: number;
}>;

export type InspectResult = Readonly<{
  events: number;
  protocols: Readonly<Partial<Record<Protocol, number>>>;
  devices: number;
  deviceIds: readonly string[];
  timeRange: Readonly<{
    start: string | null;
    end: string | null;
  }>;
  topics: Readonly<Record<string, number>>;
  payloads: PayloadKindCount;
  issues: number;
}>;

const payloadKindFromEvent = (event: IoTEvent): PayloadKind => {
  const kind = event.metadata["payloadKind"];
  if (
    kind === "json" ||
    kind === "text" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "null" ||
    kind === "binary" ||
    kind === "unknown"
  ) {
    return kind;
  }
  return "unknown";
};

const eventTopic = (event: IoTEvent): string => event.data.topic ?? "(none)";

const sortedCountRecord = <K extends string>(
  map: Map<K, number>,
): Readonly<Partial<Record<K, number>>> => {
  const out: Partial<Record<K, number>> = {};
  for (const key of [...map.keys()].sort()) {
    const count = map.get(key);
    if (count !== undefined) {
      out[key] = count;
    }
  }
  return out;
};

/**
 * Pure inspection fold.
 * Referentially transparent: same inputs ⇒ same InspectResult.
 * Local accumulation only — no shared mutable state, no I/O, no clocks.
 */
export const inspectEvents = (
  events: readonly IoTEvent[],
  issueCount = 0,
): InspectResult => {
  const protocols = new Map<Protocol, number>();
  const deviceIds = new Set<string>();
  const topics = new Map<string, number>();
  const payloads: {
    -readonly [K in PayloadKind]: number;
  } = {
    json: 0,
    text: 0,
    number: 0,
    boolean: 0,
    null: 0,
    binary: 0,
    unknown: 0,
  };

  let start: string | null = null;
  let end: string | null = null;

  for (const event of events) {
    protocols.set(event.source.protocol, (protocols.get(event.source.protocol) ?? 0) + 1);

    if (event.source.deviceId) {
      deviceIds.add(event.source.deviceId);
    }

    const topic = eventTopic(event);
    topics.set(topic, (topics.get(topic) ?? 0) + 1);
    payloads[payloadKindFromEvent(event)] += 1;

    if (start === null || event.timestamp < start) {
      start = event.timestamp;
    }
    if (end === null || event.timestamp > end) {
      end = event.timestamp;
    }
  }

  const sortedDevices = Object.freeze([...deviceIds].sort()) as readonly string[];

  return Object.freeze({
    events: events.length,
    protocols: sortedCountRecord(protocols),
    devices: sortedDevices.length,
    deviceIds: sortedDevices,
    timeRange: Object.freeze({ start, end }),
    topics: sortedCountRecord(topics) as Readonly<Record<string, number>>,
    payloads: Object.freeze({ ...payloads }),
    issues: issueCount,
  });
};
