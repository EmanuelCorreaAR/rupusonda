import type { IoTEvent } from "../../core/event/IoTEvent.js";
import type { ProtocolAdapter } from "../../core/protocol/ProtocolAdapter.js";
import { deriveEventId } from "../../core/event/deriveEventId.js";
import { decodeMqttPayload, inferMqttTopicSemantics } from "./MqttDecoder.js";
import type { MqttMessage } from "./MqttMessage.js";

const payloadFingerprint = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  if (Buffer.isBuffer(payload)) {
    return payload.toString("base64");
  }
  if (payload instanceof Uint8Array) {
    return Buffer.from(payload).toString("base64");
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
};

/** Pure MQTT → IoTEvent decoder (no I/O, no clocks). */
export const decodeMqttMessage = (input: Readonly<MqttMessage>): IoTEvent => {
  const decoded = decodeMqttPayload(input.payload);
  const inferred = inferMqttTopicSemantics(input.topic);
  const timestamp = input.timestamp ?? "1970-01-01T00:00:00.000Z";
  const metric = decoded.metric ?? inferred.metric;

  return Object.freeze({
    id: deriveEventId(["mqtt", timestamp, input.topic, payloadFingerprint(input.payload)]),
    timestamp,
    source: Object.freeze({
      protocol: "mqtt" as const,
      ...(inferred.deviceId !== undefined ? { deviceId: inferred.deviceId } : {}),
    }),
    data: Object.freeze({
      topic: input.topic,
      ...(metric !== undefined ? { metric } : {}),
      value: decoded.value,
      ...(decoded.unit !== undefined ? { unit: decoded.unit } : {}),
    }),
    metadata: Object.freeze({
      payloadKind: decoded.kind,
      ...(decoded.rawPreserved ? { rawPreserved: true } : {}),
      ...(input.qos !== undefined ? { qos: input.qos } : {}),
      ...(input.retain !== undefined ? { retain: input.retain } : {}),
      ...(input.metadata ?? {}),
    }),
  });
};

export const mqttAdapter: ProtocolAdapter<MqttMessage> = Object.freeze({
  protocol: "mqtt",
  decode: decodeMqttMessage,
});
