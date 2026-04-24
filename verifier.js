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

function computeHmac(rawBody, appSecret, algorithm) {
  return crypto.createHmac(algorithm, appSecret).update(rawBody).digest("hex");
}

function validateMetaSignature(rawBody, signatureHeader256, signatureHeaderSha1, appSecret) {
  if (!appSecret) {
    return false;
  }

  if (signatureHeader256 && signatureHeader256.startsWith("sha256=")) {
    const expectedHash = computeHmac(rawBody, appSecret, "sha256");
    const providedHash = signatureHeader256.slice("sha256=".length);
    return safeCompareHex(expectedHash, providedHash);
  }

  // Backward compatibility for providers still sending legacy SHA1 signature header.
  if (signatureHeaderSha1 && signatureHeaderSha1.startsWith("sha1=")) {
    const expectedHash = computeHmac(rawBody, appSecret, "sha1");
    const providedHash = signatureHeaderSha1.slice("sha1=".length);
    return safeCompareHex(expectedHash, providedHash);
  }

  return false;
}

module.exports = {
  validateWebhookVerification,
  validateMetaSignature
};
