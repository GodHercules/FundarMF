type LogLevel = "info" | "warn" | "error";

export const logEvent = (level: LogLevel, event: string, payload: Record<string, unknown> = {}) => {
  const entry = {
    ts: new Date().toISOString(),
    level,
    event,
    ...payload
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
};
