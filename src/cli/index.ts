#!/usr/bin/env node
import { Command } from "commander";
import { TAGLINE, TOOL, VERSION } from "../brand.js";
import { EXIT_ERROR, toRupuSondaError } from "../core/errors.js";
import { runInspect } from "./commands/inspect.js";
import { runIngest } from "./commands/ingest.js";
import { runMqttSubscribe } from "./commands/mqtt.js";
import { renderBanner, renderInspectHuman } from "./terminal.js";
import pc from "picocolors";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name(TOOL)
    .description(
      `Local-first CLI for probing and inspecting IoT protocol data.\n\n${TAGLINE}\nPart of the Rupu family.`,
    )
    .version(VERSION)
    .showHelpAfterError()
    .showSuggestionAfterError();

  program
    .command("inspect")
    .description("Inspect a JSONL capture and summarize protocols, devices, and payloads")
    .argument("<path>", "JSONL input file")
    .option("--json", "Emit deterministic JSON audit envelope", false)
    .action(async (path: string, opts: { json: boolean }) => {
      const audit = await runInspect({ path, json: opts.json });
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
      } else {
        renderInspectHuman(path, audit.result);
      }
    });

  program
    .command("ingest")
    .description("Normalize a JSONL capture into canonical IoTEvent JSONL")
    .argument("<path>", "JSONL input file")
    .option("-o, --output <path>", "Write IoTEvent JSONL to file (default: stdout)")
    .option("--json", "Emit deterministic JSON audit envelope instead of events", false)
    .action(async (path: string, opts: { output?: string; json: boolean }) => {
      const audit = await runIngest({
        path,
        ...(opts.output !== undefined ? { output: opts.output } : {}),
        json: opts.json,
      });
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
      } else if (opts.output) {
        process.stderr.write(
          `Wrote ${audit.result.written} events to ${opts.output}` +
            (audit.result.issues ? ` (${audit.result.issues} issues)` : "") +
            "\n",
        );
      }
    });

  const mqtt = program.command("mqtt").description("MQTT protocol utilities");

  mqtt
    .command("subscribe")
    .description("Subscribe to an MQTT broker and normalize messages to IoTEvent")
    .requiredOption("--url <url>", "MQTT broker URL (e.g. mqtt://localhost:1883)")
    .requiredOption("--topic <topic>", "Topic filter (e.g. sensors/#)")
    .option("-o, --output <path>", "Append IoTEvent JSONL to file")
    .option("--max-messages <n>", "Stop after N messages", (v: string) => Number(v))
    .option("--timeout-ms <ms>", "Stop after timeout milliseconds", (v: string) => Number(v))
    .option("--json-events", "Print each IoTEvent as JSONL on stdout", false)
    .action(
      async (opts: {
        url: string;
        topic: string;
        output?: string;
        maxMessages?: number;
        timeoutMs?: number;
        jsonEvents: boolean;
      }) => {
        renderBanner();
        process.stderr.write(`Subscribing ${opts.topic} @ ${opts.url}\n`);

        const summary = await runMqttSubscribe(
          {
            url: opts.url,
            topic: opts.topic,
            ...(opts.output !== undefined ? { output: opts.output } : {}),
            ...(opts.maxMessages !== undefined ? { maxMessages: opts.maxMessages } : {}),
            ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
          },
          (event) => {
            process.stderr.write(
              `${pc.dim(event.timestamp)} ${event.data.topic ?? ""} → ${JSON.stringify(event.data.value)}\n`,
            );
            if (opts.jsonEvents) {
              process.stdout.write(`${JSON.stringify(event)}\n`);
            }
          },
        );

        process.stderr.write(`Received ${summary.received} messages\n`);
      },
    );

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const err = toRupuSondaError(error);
  process.stderr.write(`${pc.red("error")}: [${err.kind}] ${err.message}\n`);
  process.exit(err.exitCode || EXIT_ERROR);
});
