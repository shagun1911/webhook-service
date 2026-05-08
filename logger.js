const crypto = require("crypto");

function createTraceId() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function log(level, traceId, message, metadata = undefined) {
  const prefix = traceId ? `[trace:${traceId}]` : "[trace:-]";
  if (metadata === undefined) {
    console[level](`${prefix} ${message}`);
    return;
  }
  console[level](`${prefix} ${message}`, metadata);
}

function logInfo(traceId, message, metadata = undefined) {
  log("info", traceId, message, metadata);
}

function logWarn(traceId, message, metadata = undefined) {
  log("warn", traceId, message, metadata);
}

function logError(traceId, message, metadata = undefined) {
  log("error", traceId, message, metadata);
}

module.exports = {
  createTraceId,
  logInfo,
  logWarn,
  logError
};
