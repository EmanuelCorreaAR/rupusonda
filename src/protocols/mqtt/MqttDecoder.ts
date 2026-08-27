import type { DecodedPayload } from "./MqttMessage.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBinary(value: unknown): DecodedPayload | undefined {
  if (Buffer.isBuffer(value)) {
    return {
      value: {
        type: "binary",
        encoding: "base64",
        data: value.toString("base64"),
      },
      kind: "binary",
      rawPreserved: true,
    };
  }

  if (value instanceof Uint8Array) {
    return {
      value: {
        type: "binary",
        encoding: "base64",
        data: Buffer.from(value).toString("base64"),
      },
      kind: "binary",
      rawPreserved: true,
    };
  }

  if (
    isPlainObject(value) &&
    value["type"] === "binary" &&
    value["encoding"] === "base64" &&
    typeof value["data"] === "string"
  ) {
    return {
      value: {
        type: "binary",
        encoding: "base64",
        data: value["data"],
      },
      kind: "binary",
      rawPreserved: true,
    };
  }

  return undefined;
}

function extractFromJsonObject(obj: Record<string, unknown>): DecodedPayload {
  const unit = typeof obj["unit"] === "string" ? obj["unit"] : undefined;
  const metric = typeof obj["metric"] === "string" ? obj["metric"] : undefined;

  if ("value" in obj) {
    return {
      value: obj["value"],
      ...(unit !== undefined ? { unit } : {}),
      ...(metric !== undefined ? { metric } : {}),
      kind: "json",
      rawPreserved: false,
    };
  }

  return {
    value: obj,
    ...(unit !== undefined ? { unit } : {}),
    ...(metric !== undefined ? { metric } : {}),
    kind: "json",
    rawPreserved: false,
  };
}

export function decodeMqttPayload(payload: unknown): DecodedPayload {
  const binary = decodeBinary(payload);
  if (binary) {
    return binary;
  }

  if (payload === null) {
    return { value: null, kind: "null", rawPreserved: false };
  }

  if (typeof payload === "number") {
    return { value: payload, kind: "number", rawPreserved: false };
  }

  if (typeof payload === "boolean") {
    return { value: payload, kind: "boolean", rawPreserved: false };
  }

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (isPlainObject(parsed)) {
          return extractFromJsonObject(parsed);
        }
        return { value: parsed, kind: "json", rawPreserved: false };
      } catch {
        return { value: payload, kind: "text", rawPreserved: true };
      }
    }

    if (trimmed !== "" && !Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { value: Number(trimmed), kind: "number", rawPreserved: false };
    }

    return { value: payload, kind: "text", rawPreserved: false };
  }

  if (Array.isArray(payload)) {
    return { value: payload, kind: "json", rawPreserved: false };
  }

  if (isPlainObject(payload)) {
    return extractFromJsonObject(payload);
  }

  return { value: payload, kind: "unknown", rawPreserved: true };
}

export type InferredTopicSemantics = {
  deviceId?: string;
  metric?: string;
};

/**
 * Best-effort topic semantics. Never required.
 *
 * Only when the path looks like `…/<metric>/<deviceId>` (≥3 segments).
 * Arbitrary topics (e.g. `foo/bar`) stay as topic-only — no forced metric/deviceId.
 *
 * `#` / `+` filters belong to subscriptions, not to events — see
 * {@link subscriptionFilterFromTopic} for that concern.
 */
export function inferMqttTopicSemantics(topic: string): InferredTopicSemantics {
  const parts = topic.split("/").filter((p) => p.length > 0);
  // Wildcards are subscription filters, not event topics.
  if (parts.some((p) => p === "#" || p === "+")) {
    return {};
  }
  if (parts.length < 3) {
    return {};
  }
  const deviceId = parts[parts.length - 1];
  const metric = parts[parts.length - 2];
  return {
    ...(deviceId !== undefined ? { deviceId } : {}),
    ...(metric !== undefined ? { metric } : {}),
  };
}

/** @deprecated Use {@link inferMqttTopicSemantics} — kept for call-site clarity in tests. */
export function parseMqttTopic(topic: string): InferredTopicSemantics {
  return inferMqttTopicSemantics(topic);
}

/**
 * Derive a subscription-style filter from a concrete event topic
 * (e.g. sensors/temperature/device-01 → sensors/temperature/#).
 * This is for capture/subscribe metadata — not for inspect event counts.
 */
export function subscriptionFilterFromTopic(topic: string): string {
  const parts = topic.split("/").filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return [...parts.slice(0, -1), "#"].join("/");
  }
  return topic || "#";
}
