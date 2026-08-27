export const TOOL = "rupusonda";
export const VERSION = "0.3.0";
export const TAGLINE = "Probe the signal. Understand the data.";
export const FAMILY = "rupu";

export const METHOD = {
  unit: "iot_event",
  ingest: "jsonl_stream_v1",
  normalize: "protocol_adapter_v1",
  inspect: "dataset_summary_v1",
  replay: "mqtt_replay_v1",
} as const;
