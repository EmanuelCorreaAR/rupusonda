import { decodeMqttPayload } from "../mqtt/MqttDecoder.js";
import type { CoapMessage, CoapMethod, CoapMessageType, DecodedCoapPayload } from "./CoapMessage.js";

const METHODS: readonly CoapMethod[] = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "FETCH",
  "PATCH",
  "iPATCH",
];

const MESSAGE_TYPES: readonly CoapMessageType[] = ["CON", "NON", "ACK", "RST"];

export const isCoapMethod = (value: unknown): value is CoapMethod =>
  typeof value === "string" && (METHODS as readonly string[]).includes(value);

export const isCoapMessageType = (value: unknown): value is CoapMessageType =>
  typeof value === "string" && (MESSAGE_TYPES as readonly string[]).includes(value);

/** Reuse MQTT payload classification — same JSON/text/number/binary shapes. */
export const decodeCoapPayload = (payload: unknown): DecodedCoapPayload =>
  decodeMqttPayload(payload === undefined ? null : payload);

/**
 * Normalize a CoAP path: ensure leading `/`, strip trailing slash (except root).
 * Empty / missing → undefined.
 */
export const normalizeCoapPath = (path: unknown): string | undefined => {
  if (typeof path !== "string") {
    return undefined;
  }
  const trimmed = path.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1);
  }
  return withSlash;
};

/**
 * Parse `coap://` / `coaps://` URI into host + path.
 * Conservative: only absolute CoAP URIs; relative paths are not URIs here.
 */
export const parseCoapUri = (
  uri: string,
): { host?: string; path?: string } => {
  const trimmed = uri.trim();
  const match = /^coaps?:\/\/([^/?#]+)([^?#]*)/i.exec(trimmed);
  if (!match) {
    return {};
  }
  const hostPart = match[1] ?? "";
  const pathPart = match[2] ?? "";
  const host = hostPart.split(":")[0];
  const path = normalizeCoapPath(pathPart.length > 0 ? pathPart : "/");
  return {
    ...(host && host.length > 0 ? { host } : {}),
    ...(path !== undefined ? { path } : {}),
  };
};

/** Prefer explicit `path`; else derive from `uri`. */
export const resolveCoapPath = (
  message: Readonly<Pick<CoapMessage, "path" | "uri"> | { path?: string; uri?: string }>,
): string | undefined => {
  const fromPath = normalizeCoapPath(message.path);
  if (fromPath !== undefined) {
    return fromPath;
  }
  if (typeof message.uri === "string") {
    return parseCoapUri(message.uri).path;
  }
  return undefined;
};

/** Prefer explicit deviceId; else CoAP URI host (never invent from path). */
export const resolveCoapDeviceId = (
  message: Readonly<Pick<CoapMessage, "deviceId" | "uri"> | { deviceId?: string; uri?: string }>,
): string | undefined => {
  if (typeof message.deviceId === "string" && message.deviceId.length > 0) {
    return message.deviceId;
  }
  if (typeof message.uri === "string") {
    const host = parseCoapUri(message.uri).host;
    if (host && host.length > 0 && host !== "localhost" && host !== "127.0.0.1") {
      return host;
    }
  }
  return undefined;
};

export const valueFingerprint = (value: unknown): string => {
  if (value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
