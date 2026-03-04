type LogLevel = "INFO" | "WARN" | "ERROR";

type LogContext = Record<string, unknown>;

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "Failed to serialize log payload" });
  }
}

function emit(level: LogLevel, event: string, context?: LogContext) {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...(context ?? {}),
  };
  console.log(safeStringify(payload));
}

export function logInfo(event: string, context?: LogContext) {
  emit("INFO", event, context);
}

export function logWarn(event: string, context?: LogContext) {
  emit("WARN", event, context);
}

export function logError(event: string, context?: LogContext) {
  emit("ERROR", event, context);
}
