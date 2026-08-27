import type { EventSource } from "./EventSource.js";

export type IoTEventData = {
  topic?: string;
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
