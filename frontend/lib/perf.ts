export type PerfPayload = Record<string, unknown>;

export const logClientPerf = (event: string, payload: PerfPayload = {}) => {
  if (typeof window === "undefined") return;
  const entry = {
    ts: new Date().toISOString(),
    event,
    ...payload
  };
  console.info("[perf]", entry);
};
