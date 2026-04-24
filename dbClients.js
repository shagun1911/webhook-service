const { MongoClient } = require("mongodb");

function parseProjectDbsConfig() {
  const raw = String(process.env.PROJECT_DBS_JSON || "").trim();
  if (!raw) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("PROJECT_DBS_JSON must be valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("PROJECT_DBS_JSON must be an array");
  }

  return parsed.map((item) => {
    const projectId = String(item.projectId || "").trim();
    const mongoUri = String(item.mongoUri || "").trim();
    const backendWebhookUrls = item.backendWebhookUrls || {};

    if (!projectId || !mongoUri) {
      throw new Error("Each PROJECT_DBS_JSON item requires projectId and mongoUri");
    }

    return {
      projectId,
      mongoUri,
      backendWebhookUrls: {
        instagram: String(backendWebhookUrls.instagram || "").trim(),
        facebook: String(backendWebhookUrls.facebook || "").trim(),
        whatsapp: String(backendWebhookUrls.whatsapp || "").trim()
      }
    };
  });
}

function createProjectDbClients() {
  const configs = parseProjectDbsConfig();
  return configs.map((config) => {
    const client = new MongoClient(config.mongoUri, {
      maxPoolSize: 5
    });
    return { ...config, client };
  });
}

module.exports = {
  parseProjectDbsConfig,
  createProjectDbClients
};
