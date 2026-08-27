import type { EventSource } from "./EventSource.js";

export type IoTEventData = {
  /** Concrete topic / address when the protocol has one (not a subscription filter). */
  topic?: string;
  /** Optional inferred or declared metric name — never required. */
  metric?: string;
  value: unknown;
  unit?: string;
};

export type IoTEvent = {
  id: string;
  timestamp: string;
  source: EventSource;
  data: IoTEventData;
  metadata: Record<string, unknown>;
};
