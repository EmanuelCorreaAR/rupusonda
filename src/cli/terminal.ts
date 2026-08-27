import pc from "picocolors";
import type { InspectResult } from "../core/inspect/Inspector.js";
import { TAGLINE, TOOL } from "../brand.js";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(part: number, total: number): string {
  if (total === 0) {
    return "0.0%";
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

export function renderInspectHuman(path: string, result: InspectResult): void {
  const out = process.stderr;
  out.write(`\n${pc.bold(TOOL)}\n`);
  out.write(`${pc.dim(TAGLINE)}\n\n`);

  out.write(`${pc.bold("Dataset")}\n`);
  out.write(`  File         ${path}\n`);
  out.write(`  Events       ${fmt(result.events)}\n`);
  out.write(`  Protocols    ${Object.keys(result.protocols).length}\n`);
  out.write(`  Devices      ${fmt(result.devices)}\n`);
  out.write(
    `  Time range   ${result.timeRange.start ?? "—"} → ${result.timeRange.end ?? "—"}\n`,
  );
  if (result.issues > 0) {
    out.write(`  Issues       ${pc.yellow(fmt(result.issues))}\n`);
  }
  out.write("\n");

  out.write(`${pc.bold("Protocols")}\n`);
  for (const [protocol, count] of Object.entries(result.protocols)) {
    out.write(`  ${protocol.padEnd(12)} ${fmt(count ?? 0)}\n`);
  }
  out.write("\n");

  out.write(`${pc.bold("Topics")}\n`);
  for (const [topic, count] of Object.entries(result.topics)) {
    out.write(`  ${topic.padEnd(32)} ${fmt(count)}\n`);
  }
  out.write("\n");

  out.write(`${pc.bold("Payloads")}\n`);
  const total = result.events || 1;
  for (const [kind, count] of Object.entries(result.payloads)) {
    if (count === 0) {
      continue;
    }
    out.write(`  ${kind.padEnd(12)} ${pct(count, total).padStart(6)}  (${fmt(count)})\n`);
  }
  out.write("\n");
}

export function renderBanner(): void {
  process.stderr.write(`${pc.bold(TOOL)} — ${TAGLINE}\n`);
}
