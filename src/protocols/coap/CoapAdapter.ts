import type { IoTEvent } from "../../core/event/IoTEvent.js";
import type { ProtocolAdapter } from "../../core/protocol/ProtocolAdapter.js";
import { deriveEventId } from "../../core/event/deriveEventId.js";
import {
  decodeCoapPayload,
  resolveCoapDeviceId,
  resolveCoapPath,
  valueFingerprint,
} from "./CoapDecoder.js";
import type { CoapMessage } from "./CoapMessage.js";

/** Pure CoAP record → IoTEvent (no I/O, no clocks, no UDP). */
export const decodeCoapMessage = (input: Readonly<CoapMessage>): IoTEvent => {
  const path = resolveCoapPath(input) ?? "/";
  const decoded = decodeCoapPayload(input.payload);
  const timestamp = input.timestamp ?? "1970-01-01T00:00:00.000Z";
  const deviceId = resolveCoapDeviceId(input);
  const metric = input.metric ?? decoded.metric;
  const unit = input.unit ?? decoded.unit;

  return Object.freeze({
    id: deriveEventId([
      "coap",
      timestamp,
      path,
      valueFingerprint(input.payload),
      ...(input.method !== undefined ? [input.method] : []),
      ...(input.code !== undefined ? [input.code] : []),
    ]),
    timestamp,
    source: Object.freeze({
      protocol: "coap" as const,
      ...(deviceId !== undefined ? { deviceId } : {}),
    }),
    data: Object.freeze({
      topic: path,
      ...(metric !== undefined ? { metric } : {}),
      value: decoded.value,
      ...(unit !== undefined ? { unit } : {}),
    }),
    metadata: Object.freeze({
      payloadKind: decoded.kind,
      ...(decoded.rawPreserved ? { rawPreserved: true } : {}),
      ...(input.method !== undefined ? { method: input.method } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.contentFormat !== undefined ? { contentFormat: input.contentFormat } : {}),
      ...(input.messageType !== undefined ? { messageType: input.messageType } : {}),
      ...(input.token !== undefined ? { token: input.token } : {}),
      ...(input.uri !== undefined ? { uri: input.uri } : {}),
      ...(input.metadata ?? {}),
    }),
  });
};

export const coapAdapter: ProtocolAdapter<CoapMessage> = Object.freeze({
  protocol: "coap",
  decode: decodeCoapMessage,
});
