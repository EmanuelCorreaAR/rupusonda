export type MqttPayload =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[]
  | { type: "binary"; encoding: "base64"; data: string };

export type MqttMessage = {
  topic: string;
  payload: unknown;
  timestamp?: string;
  qos?: number;
  retain?: boolean;
  metadata?: Record<string, unknown>;
};

export type DecodedPayload = {
  value: unknown;
  unit?: string;
  metric?: string;
  kind: "json" | "text" | "number" | "boolean" | "null" | "binary" | "unknown";
  rawPreserved: boolean;
};
