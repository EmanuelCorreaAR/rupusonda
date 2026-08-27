import mqtt from "mqtt";
import { createWriteStream } from "node:fs";
import { finished } from "node:stream/promises";
import { MqttAdapter } from "../../protocols/mqtt/MqttAdapter.js";
import { RupuSondaError } from "../../core/errors.js";
import type { IoTEvent } from "../../core/event/IoTEvent.js";

export type MqttSubscribeOptions = {
  url: string;
  topic: string;
  output?: string;
  maxMessages?: number;
  timeoutMs?: number;
};

export type MqttSubscribeSummary = {
  url: string;
  topic: string;
  received: number;
  output: string | null;
};

function payloadFromMqtt(payload: Buffer | string): unknown {
  if (typeof payload === "string") {
    return payload;
  }
  // Prefer UTF-8 text when valid; otherwise keep binary.
  const asText = payload.toString("utf8");
  const roundTrip = Buffer.from(asText, "utf8");
  if (roundTrip.equals(payload)) {
    return asText;
  }
  return payload;
}

export async function runMqttSubscribe(
  options: MqttSubscribeOptions,
  onEvent?: (event: IoTEvent) => void,
): Promise<MqttSubscribeSummary> {
  const adapter = new MqttAdapter();
  const client = mqtt.connect(options.url);

  let outputStream: ReturnType<typeof createWriteStream> | undefined;
  if (options.output) {
    outputStream = createWriteStream(options.output, { flags: "a", encoding: "utf8" });
  }

  let received = 0;

  const summary = await new Promise<MqttSubscribeSummary>((resolve, reject) => {
    let settled = false;
    let timer: NodeJS.Timeout | undefined;

    const finish = async (error?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      client.end(true);
      if (outputStream) {
        outputStream.end();
        try {
          await finished(outputStream);
        } catch {
          // ignore close errors after write path
        }
      }
      if (error) {
        reject(error);
        return;
      }
      resolve({
        url: options.url,
        topic: options.topic,
        received,
        output: options.output ?? null,
      });
    };

    client.on("connect", () => {
      client.subscribe(options.topic, (err) => {
        if (err) {
          void finish(
            new RupuSondaError("protocol", `MQTT subscribe failed: ${err.message}`),
          );
        }
      });
    });

    client.on("message", (topic, payload) => {
      const event = adapter.decode({
        topic,
        payload: payloadFromMqtt(payload),
        timestamp: new Date().toISOString(),
      });
      received += 1;
      onEvent?.(event);
      if (outputStream) {
        outputStream.write(`${JSON.stringify(event)}\n`);
      }

      if (options.maxMessages !== undefined && received >= options.maxMessages) {
        void finish();
      }
    });

    client.on("error", (err) => {
      void finish(new RupuSondaError("protocol", `MQTT error: ${err.message}`));
    });

    if (options.timeoutMs !== undefined && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        void finish();
      }, options.timeoutMs);
    }
  });

  return summary;
}
