const fs = require("fs");
const path = require("path");

const { processWebhookPayload } = require("./processor");
const { logError, logInfo, logWarn } = require("./logger");

const queue = [];
let processing = false;

const MAX_JOB_ATTEMPTS = Number(process.env.QUEUE_MAX_ATTEMPTS || 5);
const BASE_RETRY_DELAY_MS = Number(process.env.QUEUE_BASE_RETRY_DELAY_MS || 500);

const dataDir = path.join(__dirname, "data");
const failedEventsFilePath = path.join(dataDir, "failed-events.log");

function ensureFailedEventsStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function persistFailedEvent(job, error) {
  ensureFailedEventsStorage();
  const record = {
    failedAt: new Date().toISOString(),
    traceId: job.traceId,
    attempts: job.attempts,
    error: error?.message || "Unknown processing error",
    payload: job.payload
  };
  fs.appendFileSync(failedEventsFilePath, `${JSON.stringify(record)}\n`, "utf8");
}

function getBackoffMs(attempts) {
  return BASE_RETRY_DELAY_MS * Math.pow(2, Math.max(attempts - 1, 0));
}

function scheduleRetry(job) {
  const delayMs = getBackoffMs(job.attempts);
  setTimeout(() => {
    queue.push(job);
    processQueue().catch((error) => {
      console.error("[queue] unexpected queue processing failure", error.message);
    });
  }, delayMs);
}

async function processQueue() {
  if (processing) {
    return;
  }

  processing = true;

  try {
    while (queue.length > 0) {
      const job = queue.shift();
      logInfo(job.traceId, "[queue] starting job", {
        attempts: job.attempts,
        queuedJobsRemaining: queue.length
      });
      try {
        await processWebhookPayload(job.payload, job.requestHeaders, job.traceId);
        logInfo(job.traceId, "[queue] job processed successfully");
      } catch (error) {
        job.attempts += 1;
        if (job.attempts >= MAX_JOB_ATTEMPTS) {
          logError(job.traceId, "[queue] job permanently failed", {
            error: error.message,
            attempts: job.attempts
          });
          persistFailedEvent(job, error);
        } else {
          logWarn(job.traceId, "[queue] job failed, scheduling retry", {
            error: error.message,
            attempt: job.attempts,
            maxAttempts: MAX_JOB_ATTEMPTS
          });
          scheduleRetry(job);
        }
      }
    }
  } finally {
    processing = false;
  }
}

function enqueueWebhookJob(payload, requestHeaders, traceId) {
  queue.push({
    payload,
    requestHeaders,
    traceId,
    attempts: 0
  });

  logInfo(traceId, "[queue] job enqueued", { queueLength: queue.length });

  processQueue().catch((error) => {
    logError(traceId, "[queue] unexpected queue processing failure", {
      error: error.message
    });
  });
}

module.exports = {
  enqueueWebhookJob
};
