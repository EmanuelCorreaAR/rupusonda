import { deriveEventId } from "../../core/event/deriveEventId.js";
import type { IoTEvent } from "../../core/event/IoTEvent.js";
import type { ProtocolAdapter } from "../../core/protocol/ProtocolAdapter.js";
import { decodeMqttPayload, parseMqttTopic } from "./MqttDecoder.js";
import type { MqttMessage } from "./MqttMessage.js";

function payloadFingerprint(payload: unknown): string {
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
}

export class MqttAdapter implements ProtocolAdapter<MqttMessage> {
  readonly protocol = "mqtt" as const;

  decode(input: MqttMessage): IoTEvent {
    const decoded = decodeMqttPayload(input.payload);
    const topicInfo = parseMqttTopic(input.topic);
    const timestamp = input.timestamp ?? "1970-01-01T00:00:00.000Z";

    const metric = decoded.metric ?? topicInfo.metric;
    const id = deriveEventId([
      "mqtt",
      timestamp,
      input.topic,
      payloadFingerprint(input.payload),
    ]);

    const metadata: Record<string, unknown> = {
      payloadKind: decoded.kind,
      ...(decoded.rawPreserved ? { rawPreserved: true } : {}),
      ...(input.qos !== undefined ? { qos: input.qos } : {}),
      ...(input.retain !== undefined ? { retain: input.retain } : {}),
      ...(input.metadata ?? {}),
    };

    return {
      id,
      timestamp,
      source: {
        protocol: "mqtt",
        ...(topicInfo.deviceId !== undefined ? { deviceId: topicInfo.deviceId } : {}),
      },
      data: {
        topic: input.topic,
        ...(metric !== undefined ? { metric } : {}),
        value: decoded.value,
        ...(decoded.unit !== undefined ? { unit: decoded.unit } : {}),
      },
      metadata,
    };
  }
}
