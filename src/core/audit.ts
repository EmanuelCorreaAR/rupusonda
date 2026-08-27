import { FAMILY, METHOD, TOOL, VERSION } from "../brand.js";

export type AuditEnvelope<TResult> = Readonly<{
  tool: typeof TOOL;
  version: typeof VERSION;
  family: typeof FAMILY;
  command: string;
  input: Readonly<Record<string, unknown>>;
  configuration: Readonly<Record<string, unknown>>;
  method: typeof METHOD;
  result: TResult;
}>;

export function buildAudit<TResult>(
  command: string,
  input: Readonly<Record<string, unknown>>,
  configuration: Readonly<Record<string, unknown>>,
  result: TResult,
): AuditEnvelope<TResult> {
  return Object.freeze({
    tool: TOOL,
    version: VERSION,
    family: FAMILY,
    command,
    input,
    configuration,
    method: METHOD,
    result,
  });
}
