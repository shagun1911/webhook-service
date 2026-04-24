const axios = require("axios");

const { getMapping } = require("./mapping");

const INTERNAL_SECRET = String(process.env.INTERNAL_SECRET || "").trim();
const REQUEST_TIMEOUT_MS = Number(process.env.FORWARD_TIMEOUT_MS || 8000);
const MAX_FORWARD_ATTEMPTS = Number(process.env.FORWARD_MAX_ATTEMPTS || 3);
const PLACEHOLDER_INTERNAL_SECRET = "REPLACE_WITH_INTERNAL_SHARED_SECRET";

function assertInternalSecretConfigured() {
  if (!INTERNAL_SECRET || INTERNAL_SECRET === PLACEHOLDER_INTERNAL_SECRET) {
    throw new Error(
      "INTERNAL_SECRET is not configured. Set the same strong shared secret in webhook gateway and downstream backend."
    );
  }
}

function getMetaIdFromEntry(entry) {
  if (entry && entry.id) {
    return String(entry.id);
  }

  const phoneNumberId = entry?.changes?.[0]?.value?.metadata?.phone_number_id;
  if (phoneNumberId) {
    return String(phoneNumberId);
  }

  return null;
}

function getServiceKey(payload, entry) {
  const objectType = String(payload?.object || "").toLowerCase();
  if (objectType === "whatsapp_business_account") {
    return "service:whatsapp";
  }

  if (objectType === "instagram") {
    return "service:instagram";
  }

  if (objectType === "page") {
    const isInstagramScoped = Boolean(entry?.changes?.[0]?.value?.instagram_account_id);
    return isInstagramScoped ? "service:instagram" : "service:facebook";
  }

  return null;
}

async function forwardWithRetry(mapping, body, originalHeaders) {
  assertInternalSecretConfigured();

  const outgoingHeaders = {
    "Content-Type": "application/json",
    "x-client-id": mapping.client_id,
    "x-internal-secret": INTERNAL_SECRET
  };

  if (originalHeaders["x-request-id"]) {
    outgoingHeaders["x-request-id"] = originalHeaders["x-request-id"];
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_FORWARD_ATTEMPTS; attempt += 1) {
    try {
      await axios.post(mapping.forward_url, body, {
        headers: outgoingHeaders,
        timeout: REQUEST_TIMEOUT_MS
      });
      return;
    } catch (error) {
      lastError = error;
      console.error(
        `[forward] attempt ${attempt}/${MAX_FORWARD_ATTEMPTS} failed for client=${mapping.client_id} url=${mapping.forward_url}`,
        error.message
      );
    }
  }

  throw lastError;
}

async function processWebhookPayload(payload, requestHeaders) {
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  if (entries.length === 0) {
    console.warn("[webhook] payload has no entry array");
    return;
  }

  const tasks = entries.map(async (entry) => {
    const metaId = getMetaIdFromEntry(entry);
    const serviceKey = getServiceKey(payload, entry);
    const mapping = (metaId && getMapping(metaId)) || (serviceKey && getMapping(serviceKey));
    if (!mapping) {
      console.warn(
        `[webhook] no mapping found for meta_id=${metaId || "-"} service_key=${serviceKey || "-"}`
      );
      return;
    }

    await forwardWithRetry(mapping, payload, requestHeaders);
  });

  const results = await Promise.allSettled(tasks);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("[webhook] async processing failed", result.reason?.message);
    }
  });
}

module.exports = {
  processWebhookPayload
};
