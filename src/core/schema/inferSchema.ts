import type { IoTEvent } from "../event/IoTEvent.js";
import type { Protocol } from "../protocol/Protocol.js";

/** Observed JSON / IoTEvent value kinds (evidence only — no ML). */
export type ObservedType =
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "object"
  | "array"
  | "binary"
  | "unknown";

const MAX_ENUM_VALUES = 32;

export type FieldSchema = Readonly<{
  /** Dominant observed type (ties broken alphabetically). */
  type: ObservedType;
  /** Events where this field was present. */
  present: number;
  /** present / topic.events, rounded to 4 decimals. */
  observed: number;
  /** Per-type counts (sorted keys in output). */
  types: Readonly<Partial<Record<ObservedType, number>>>;
  min?: number;
  max?: number;
  /** Distinct string values when cardinality ≤ 32 (sorted). */
  values?: readonly string[];
  valuesTruncated?: boolean;
}>;

export type TopicSchema = Readonly<{
  events: number;
  protocols: Readonly<Partial<Record<Protocol, number>>>;
  fields: Readonly<Record<string, FieldSchema>>;
}>;

export type SchemaResult = Readonly<{
  events: number;
  protocols: Readonly<Partial<Record<Protocol, number>>>;
  /** Concrete event topics only — never subscription wildcards. */
  topics: Readonly<Record<string, TopicSchema>>;
  /**
   * Fraction of field type observations that match the dominant type
   * for that field (0–1). Pure evidence ratio, not a model score.
   */
  coverage: number;
  issues: number;
}>;

type MutableField = {
  present: number;
  types: Map<ObservedType, number>;
  min?: number;
  max?: number;
  stringValues: Set<string>;
  valuesTruncated: boolean;
};

type MutableTopic = {
  events: number;
  protocols: Map<Protocol, number>;
  fields: Map<string, MutableField>;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBinaryShape = (value: unknown): boolean =>
  isPlainObject(value) &&
  value["type"] === "binary" &&
  value["encoding"] === "base64" &&
  typeof value["data"] === "string";

export const classifyValue = (value: unknown): ObservedType => {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? "number" : "unknown";
  }
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (isBinaryShape(value)) {
    return "binary";
  }
  if (isPlainObject(value)) {
    return "object";
  }
  return "unknown";
};

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const eventTopic = (event: IoTEvent): string => event.data.topic ?? "(none)";

const ensureField = (topic: MutableTopic, name: string): MutableField => {
  let field = topic.fields.get(name);
  if (field === undefined) {
    field = {
      present: 0,
      types: new Map(),
      stringValues: new Set(),
      valuesTruncated: false,
    };
    topic.fields.set(name, field);
  }
  return field;
};

const observe = (topic: MutableTopic, name: string, value: unknown): void => {
  const field = ensureField(topic, name);
  field.present += 1;
  const kind = classifyValue(value);
  field.types.set(kind, (field.types.get(kind) ?? 0) + 1);

  if (kind === "number" && typeof value === "number") {
    field.min = field.min === undefined ? value : Math.min(field.min, value);
    field.max = field.max === undefined ? value : Math.max(field.max, value);
  }

  if (kind === "string" && typeof value === "string") {
    if (!field.valuesTruncated) {
      if (field.stringValues.size < MAX_ENUM_VALUES) {
        field.stringValues.add(value);
      } else if (!field.stringValues.has(value)) {
        field.valuesTruncated = true;
        field.stringValues.clear();
      }
    }
  }

  if (kind === "object" && isPlainObject(value) && !isBinaryShape(value)) {
    for (const key of Object.keys(value).sort()) {
      observe(topic, `${name}.${key}`, value[key]);
    }
  }
};

const dominantType = (types: Map<ObservedType, number>): ObservedType => {
  let best: ObservedType | undefined;
  let bestCount = -1;
  for (const key of [...types.keys()].sort()) {
    const count = types.get(key) ?? 0;
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best ?? "unknown";
};

const sortedTypeCounts = (
  types: Map<ObservedType, number>,
): Readonly<Partial<Record<ObservedType, number>>> => {
  const out: Partial<Record<ObservedType, number>> = {};
  for (const key of [...types.keys()].sort()) {
    const count = types.get(key);
    if (count !== undefined) {
      out[key] = count;
    }
  }
  return out;
};

const finalizeField = (field: MutableField, topicEvents: number): FieldSchema => {
  const type = dominantType(field.types);
  const base: {
    type: ObservedType;
    present: number;
    observed: number;
    types: Readonly<Partial<Record<ObservedType, number>>>;
    min?: number;
    max?: number;
    values?: readonly string[];
    valuesTruncated?: boolean;
  } = {
    type,
    present: field.present,
    observed: topicEvents === 0 ? 0 : round4(field.present / topicEvents),
    types: sortedTypeCounts(field.types),
  };

  if (field.min !== undefined) {
    base.min = field.min;
  }
  if (field.max !== undefined) {
    base.max = field.max;
  }
  if (!field.valuesTruncated && field.stringValues.size > 0) {
    base.values = [...field.stringValues].sort();
  }
  if (field.valuesTruncated) {
    base.valuesTruncated = true;
  }

  return Object.freeze(base);
};

const sortedProtocolCounts = (
  map: Map<Protocol, number>,
): Readonly<Partial<Record<Protocol, number>>> => {
  const out: Partial<Record<Protocol, number>> = {};
  for (const key of [...map.keys()].sort()) {
    const count = map.get(key);
    if (count !== undefined) {
      out[key] = count;
    }
  }
  return out;
};

/**
 * Pure schema inference fold.
 * Same events ⇒ same SchemaResult. Local accumulation only.
 * Groups by concrete topic — never invents `+` / `#` wildcards.
 */
export const inferSchema = (events: readonly IoTEvent[], issueCount = 0): SchemaResult => {
  const protocols = new Map<Protocol, number>();
  const topics = new Map<string, MutableTopic>();

  for (const event of events) {
    const protocol = event.source.protocol;
    protocols.set(protocol, (protocols.get(protocol) ?? 0) + 1);

    const topicKey = eventTopic(event);
    let topic = topics.get(topicKey);
    if (topic === undefined) {
      topic = {
        events: 0,
        protocols: new Map(),
        fields: new Map(),
      };
      topics.set(topicKey, topic);
    }

    topic.events += 1;
    topic.protocols.set(protocol, (topic.protocols.get(protocol) ?? 0) + 1);

    observe(topic, "value", event.data.value);

    if (event.data.unit !== undefined) {
      observe(topic, "unit", event.data.unit);
    }
    if (event.data.metric !== undefined) {
      observe(topic, "metric", event.data.metric);
    }
    if (event.source.deviceId !== undefined) {
      observe(topic, "deviceId", event.source.deviceId);
    }
  }

  let typeHits = 0;
  let typeTotal = 0;
  const topicOut: Record<string, TopicSchema> = {};

  for (const topicKey of [...topics.keys()].sort()) {
    const topic = topics.get(topicKey);
    if (topic === undefined) {
      continue;
    }

    const fields: Record<string, FieldSchema> = {};
    for (const fieldName of [...topic.fields.keys()].sort()) {
      const field = topic.fields.get(fieldName);
      if (field === undefined) {
        continue;
      }
      fields[fieldName] = finalizeField(field, topic.events);

      for (const count of field.types.values()) {
        typeTotal += count;
      }
      typeHits += Math.max(0, ...field.types.values());
    }

    topicOut[topicKey] = Object.freeze({
      events: topic.events,
      protocols: sortedProtocolCounts(topic.protocols),
      fields: Object.freeze(fields),
    });
  }

  return Object.freeze({
    events: events.length,
    protocols: sortedProtocolCounts(protocols),
    topics: Object.freeze(topicOut),
    coverage: typeTotal === 0 ? 1 : round4(typeHits / typeTotal),
    issues: issueCount,
  });
};
