export type CoapMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "FETCH"
  | "PATCH"
  | "iPATCH";

export type CoapMessageType = "CON" | "NON" | "ACK" | "RST";

/**
 * CoAP capture record (JSONL / library).
 * `path` is required after normalize (derived from `uri` when only URI is present).
 */
export type CoapMessage = Readonly<{
  /** Resource path, e.g. `/sensors/temperature` (MQTT-topic analogue). */
  path: string;
  payload?: unknown;
  timestamp?: string;
  /** Request method when the capture is a request. */
  method?: CoapMethod;
  /** CoAP code string, e.g. `0.01` (GET) or `2.05` (Content). */
  code?: string;
  /** Content-Format option (e.g. 0 text/plain, 50 application/json). */
  contentFormat?: number;
  deviceId?: string;
  /** Full URI when available (`coap://host/path`); host may map to deviceId. */
  uri?: string;
  messageType?: CoapMessageType;
  token?: string;
  metric?: string;
  unit?: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DecodedCoapPayload = Readonly<{
  value: unknown;
  unit?: string;
  metric?: string;
  kind: "json" | "text" | "number" | "boolean" | "null" | "binary" | "unknown";
  rawPreserved: boolean;
}>;
