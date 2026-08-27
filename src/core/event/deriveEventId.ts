import { createHash } from "node:crypto";

/** Deterministic event id derived from stable content. */
export function deriveEventId(parts: readonly string[]): string {
  const hash = createHash("sha256");
  for (const part of parts) {
    hash.update(part);
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 32);
}
