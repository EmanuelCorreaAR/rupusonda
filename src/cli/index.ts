#!/usr/bin/env node
import { Command } from "commander";
import { TOOL, VERSION } from "../brand.js";
import { EXIT_ERROR, toRupuSondaError } from "../core/errors.js";
import { runInspect } from "./commands/inspect.js";
import { runIngest } from "./commands/ingest.js";
import { runMqttSubscribe } from "./commands/mqtt.js";
import { runMqttReplay } from "./commands/mqtt-replay.js";
import { renderBanner, renderInspectHuman } from "./terminal.js";
import pc from "picocolors";

async function main(): Promise<void> {
  const program = new Command();

  program
    .name(TOOL)
    .description(
      [
        "Local-first CLI for probing and inspecting IoT protocol data.",
        "",
        "See also:",
        "  rupusonda inspect --help",
        "  rupusonda ingest --help",
        "  rupusonda mqtt --help",
      ].join("\n"),
    )
    .version(VERSION, "-V, --version", "Show version and exit")
    .helpOption("-h, --help", "Show this message and exit")
    .showHelpAfterError()
    .showSuggestionAfterError();

  program
    .command("inspect")
    .description("Inspect a JSONL capture (protocols, devices, topics, payloads)")
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
          `Wrote ${audit.result.written} events to ${pc.bold(opts.output)}` +
            (audit.result.issues ? ` (${audit.result.issues} issues)` : "") +
            "\n",
        );
      }
    });

  const mqtt = program
    .command("mqtt")
    .description("MQTT protocol utilities (first adapter — not the product)");

  mqtt
    .command("subscribe")
    .description("Record: subscribe to a broker and write IoTEvent JSONL")
    .requiredOption("--url <url>", "MQTT broker URL (e.g. mqtt://localhost:1883)")
    .requiredOption("--topic <topic>", "Topic filter (e.g. sensors/#)")
    .option("-o, --output <path>", "Append IoTEvent JSONL to file (record)")
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
        process.stderr.write(`\nRecording ${pc.bold(opts.topic)} @ ${opts.url}\n\n`);

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

        process.stderr.write(`\nRecorded ${summary.received} messages`);
        if (summary.output) {
          process.stderr.write(` → ${pc.bold(summary.output)}`);
        }
        process.stderr.write("\n");
      },
    );

  mqtt
    .command("replay")
    .description("Replay an IoTEvent JSONL capture back to an MQTT broker")
    .argument("<path>", "IoTEvent JSONL capture (from subscribe/ingest)")
    .requiredOption("--url <url>", "MQTT broker URL (e.g. mqtt://localhost:1883)")
    .option("--delay-ms <ms>", "Fixed delay between publishes", (v: string) => Number(v))
    .option("--preserve-timing", "Honor original inter-event timestamp deltas", false)
    .option("--max-messages <n>", "Publish at most N events", (v: string) => Number(v))
    .option("--dry-run", "Plan publishes without connecting", false)
    .option("--json", "Emit deterministic JSON audit envelope", false)
    .action(
      async (
        path: string,
        opts: {
          url: string;
          delayMs?: number;
          preserveTiming: boolean;
          maxMessages?: number;
          dryRun: boolean;
          json: boolean;
        },
      ) => {
        if (!opts.json) {
          renderBanner();
          process.stderr.write(
            `\nReplaying ${pc.bold(path)} → ${opts.url}` +
              (opts.dryRun ? " (dry-run)" : "") +
              "\n\n",
          );
        }

        const audit = await runMqttReplay(
          {
            path,
            url: opts.url,
            ...(opts.delayMs !== undefined ? { delayMs: opts.delayMs } : {}),
            preserveTiming: opts.preserveTiming,
            ...(opts.maxMessages !== undefined ? { maxMessages: opts.maxMessages } : {}),
            dryRun: opts.dryRun,
            json: opts.json,
          },
          (item) => {
            if (!opts.json) {
              process.stderr.write(
                `${pc.dim(item.event.timestamp)} ${item.topic} → ${typeof item.payload === "string" ? item.payload : `<binary ${item.payload.length}B>`}\n`,
              );
            }
          },
        );

        if (opts.json) {
          process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);
        } else {
          process.stderr.write(
            `\nPublished ${audit.result.published}` +
              (audit.result.skipped ? `, skipped ${audit.result.skipped}` : "") +
              (audit.result.issues ? `, issues ${audit.result.issues}` : "") +
              "\n",
          );
        }
      },
    );

  // Match Rupu family: no args → help (not an opaque error).
  if (process.argv.slice(2).length === 0) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error: unknown) => {
  const err = toRupuSondaError(error);
  process.stderr.write(`${pc.red("error")}: [${err.kind}] ${err.message}\n`);
  process.exit(err.exitCode || EXIT_ERROR);
});
