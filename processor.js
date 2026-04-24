const axios = require("axios");

const { resolveProjectWebhook } = require("./projectResolver");

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

function getRouteContext(payload, entry) {
  const objectType = String(payload?.object || "").toLowerCase();

  if (objectType === "instagram") {
    const receiverId = entry?.id ? String(entry.id) : null;
    return receiverId ? { platform: "instagram", receiverId } : null;
  }

  if (objectType === "whatsapp_business_account") {
    const phoneNumberId = entry?.changes?.[0]?.value?.metadata?.phone_number_id;
    const receiverId = phoneNumberId ? String(phoneNumberId) : null;
    return receiverId ? { platform: "whatsapp", receiverId } : null;
  }

  if (objectType === "page") {
    const isInstagramScoped = Boolean(entry?.changes?.[0]?.value?.instagram_account_id);
    const receiverId = entry?.id ? String(entry.id) : null;
    if (!receiverId) {
      return null;
    }
    return { platform: isInstagramScoped ? "instagram" : "facebook", receiverId };
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
    const routeContext = getRouteContext(payload, entry);
    if (!routeContext) {
      console.warn("[webhook] could not derive route context from payload entry");
      return;
    }

    const resolved = resolveProjectWebhook(routeContext.platform, routeContext.receiverId);
    if (!resolved) {
      console.warn(
        `[webhook] no routing target found for platform=${routeContext.platform} receiver_id=${routeContext.receiverId}`
      );
      return;
    }

    console.info(
      `[webhook] resolved project route project=${resolved.projectId} platform=${routeContext.platform} receiver_id=${routeContext.receiverId}`
    );

    await forwardWithRetry(
      {
        client_id: resolved.projectId,
        forward_url: resolved.forwardUrl
      },
      payload,
      requestHeaders
    );
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
