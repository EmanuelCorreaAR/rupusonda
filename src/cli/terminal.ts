import pc from "picocolors";
import type { InspectResult } from "../core/inspect/Inspector.js";
import { TAGLINE, TOOL, VERSION } from "../brand.js";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pct(part: number, total: number): string {
  if (total === 0) {
    return "0.0%";
  }
  return `${((part / total) * 100).toFixed(1)}%`;
}

function visibleWidth(text: string): number {
  // eslint-disable-next-line no-control-regex -- strip ANSI color codes for box sizing
  return text.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function boxLine(content: string, width: number): string {
  const pad = Math.max(0, width - visibleWidth(content));
  return `${pc.cyan("│")} ${content}${" ".repeat(pad)} ${pc.cyan("│")}`;
}

/** Rich-style panel header aligned with RupuData / RupuContext. */
export function renderHeader(out: NodeJS.WritableStream = process.stderr): void {
  const line1 = `${pc.bold(TOOL)} v${VERSION}`;
  const line2 = pc.dim(TAGLINE);
  const width = Math.max(visibleWidth(line1), visibleWidth(line2));
  const edge = "─".repeat(width + 2);

  out.write(`${pc.cyan(`╭${edge}╮`)}\n`);
  out.write(`${boxLine(line1, width)}\n`);
  out.write(`${boxLine(line2, width)}\n`);
  out.write(`${pc.cyan(`╰${edge}╯`)}\n`);
}

function section(title: string, out: NodeJS.WritableStream): void {
  out.write(`\n${pc.bold(pc.cyan(title))}\n`);
  out.write(`${"─".repeat(30)}\n`);
}

function kv(label: string, value: string, out: NodeJS.WritableStream): void {
  out.write(`  ${pc.bold(label.padEnd(12))} ${value}\n`);
}

export function renderInspectHuman(path: string, result: InspectResult): void {
  const out = process.stderr;
  renderHeader(out);
  out.write(`\nInspect: ${pc.bold(path)}\n`);

  section("Dataset", out);
  kv("Events", fmt(result.events), out);
  kv("Protocols", String(Object.keys(result.protocols).length), out);
  kv("Devices", fmt(result.devices), out);
  kv(
    "Time range",
    `${result.timeRange.start ?? "—"} → ${result.timeRange.end ?? "—"}`,
    out,
  );
  if (result.issues > 0) {
    kv("Issues", pc.yellow(fmt(result.issues)), out);
  }

  section("Protocols", out);
  for (const [protocol, count] of Object.entries(result.protocols)) {
    out.write(`  ${protocol.padEnd(12)} ${fmt(count ?? 0)}\n`);
  }

  section("Topics", out);
  for (const [topic, count] of Object.entries(result.topics)) {
    out.write(`  ${topic.padEnd(32)} ${fmt(count)}\n`);
  }

  section("Payloads", out);
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
  renderHeader(process.stderr);
}
