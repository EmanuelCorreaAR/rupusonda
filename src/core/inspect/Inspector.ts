import type { IoTEvent } from "../event/IoTEvent.js";
import type { Protocol } from "../protocol/Protocol.js";

export type PayloadKindCount = {
  json: number;
  text: number;
  number: number;
  boolean: number;
  null: number;
  binary: number;
  unknown: number;
};

export type InspectResult = {
  events: number;
  protocols: Partial<Record<Protocol, number>>;
  devices: number;
  deviceIds: string[];
  timeRange: {
    start: string | null;
    end: string | null;
  };
  topics: Record<string, number>;
  payloads: PayloadKindCount;
  issues: number;
};

function emptyPayloads(): PayloadKindCount {
  return {
    json: 0,
    text: 0,
    number: 0,
    boolean: 0,
    null: 0,
    binary: 0,
    unknown: 0,
  };
}

function payloadKindFromEvent(event: IoTEvent): keyof PayloadKindCount {
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
}

function topicPattern(event: IoTEvent): string {
  const topic = event.data.topic;
  if (!topic) {
    return "(none)";
  }
  const parts = topic.split("/").filter((p) => p.length > 0);
  if (parts.length >= 3) {
    return [...parts.slice(0, -1), "#"].join("/");
  }
  if (parts.length === 2) {
    return `${parts[0]}/#`;
  }
  return topic;
}

export class Inspector {
  private events = 0;
  private issues = 0;
  private readonly protocolCounts = new Map<Protocol, number>();
  private readonly deviceIds = new Set<string>();
  private readonly topicCounts = new Map<string, number>();
  private readonly payloads = emptyPayloads();
  private start: string | null = null;
  private end: string | null = null;

  addIssue(): void {
    this.issues += 1;
  }

  add(event: IoTEvent): void {
    this.events += 1;

    const protocol = event.source.protocol;
    this.protocolCounts.set(protocol, (this.protocolCounts.get(protocol) ?? 0) + 1);

    if (event.source.deviceId) {
      this.deviceIds.add(event.source.deviceId);
    }

    const pattern = topicPattern(event);
    this.topicCounts.set(pattern, (this.topicCounts.get(pattern) ?? 0) + 1);

    this.payloads[payloadKindFromEvent(event)] += 1;

    if (this.start === null || event.timestamp < this.start) {
      this.start = event.timestamp;
    }
    if (this.end === null || event.timestamp > this.end) {
      this.end = event.timestamp;
    }
  }

  result(): InspectResult {
    const protocols: Partial<Record<Protocol, number>> = {};
    for (const protocol of [...this.protocolCounts.keys()].sort()) {
      const count = this.protocolCounts.get(protocol);
      if (count !== undefined) {
        protocols[protocol] = count;
      }
    }

    const topics: Record<string, number> = {};
    for (const topic of [...this.topicCounts.keys()].sort()) {
      const count = this.topicCounts.get(topic);
      if (count !== undefined) {
        topics[topic] = count;
      }
    }

    const deviceIds = [...this.deviceIds].sort();

    return {
      events: this.events,
      protocols,
      devices: deviceIds.length,
      deviceIds,
      timeRange: {
        start: this.start,
        end: this.end,
      },
      topics,
      payloads: { ...this.payloads },
      issues: this.issues,
    };
  }
}
