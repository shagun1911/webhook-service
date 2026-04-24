const crypto = require("crypto");

function safeCompareHex(a, b) {
  try {
    const aBuffer = Buffer.from(a, "hex");
    const bBuffer = Buffer.from(b, "hex");

    if (aBuffer.length !== bBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(aBuffer, bBuffer);
  } catch (error) {
    return false;
  }
}

function validateWebhookVerification(query, verifyToken) {
  const mode = query["hub.mode"];
  const token = query["hub.verify_token"];
  const challenge = query["hub.challenge"];

  if (mode !== "subscribe") {
    return { ok: false, reason: "Unsupported hub.mode" };
  }

  if (!challenge) {
    return { ok: false, reason: "Missing hub.challenge" };
  }

  if (!verifyToken || token !== verifyToken) {
    return { ok: false, reason: "Invalid verify token" };
  }

  return { ok: true, challenge };
}

function validateMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!appSecret) {
    return false;
  }

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expectedHash = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");

  const providedHash = signatureHeader.slice("sha256=".length);
  return safeCompareHex(expectedHash, providedHash);
}

module.exports = {
  validateWebhookVerification,
  validateMetaSignature
};
