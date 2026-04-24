const { MongoClient } = require("mongodb");

function buildWebhookUrlsFromIndexedEnv(index) {
  const directJson = String(process.env[`PROJECT_BACKEND_WEBHOOK_URLS_${index}`] || "").trim();
  if (directJson) {
    try {
      const parsed = JSON.parse(directJson);
      return {
        instagram: String(parsed.instagram || "").trim(),
        facebook: String(parsed.facebook || "").trim(),
        whatsapp: String(parsed.whatsapp || "").trim()
      };
    } catch (error) {
      throw new Error(`PROJECT_BACKEND_WEBHOOK_URLS_${index} must be valid JSON`);
    }
  }

  const instagram = String(process.env[`INSTAGRAM_WEBHOOK_URL_${index}`] || "").trim();
  const facebook = String(process.env[`FACEBOOK_WEBHOOK_URL_${index}`] || "").trim();
  const whatsapp = String(process.env[`WHATSAPP_WEBHOOK_URL_${index}`] || "").trim();
  if (instagram || facebook || whatsapp) {
    return { instagram, facebook, whatsapp };
  }

  const baseUrl = String(process.env[`PROJECT_BACKEND_BASE_URL_${index}`] || "").trim();
  if (!baseUrl) {
    return { instagram: "", facebook: "", whatsapp: "" };
  }

  return {
    instagram: `${baseUrl}/api/v1/webhooks/instagram`,
    facebook: `${baseUrl}/api/v1/social-integrations/messenger/webhook`,
    whatsapp: `${baseUrl}/api/v1/social-integrations/whatsapp/webhook`
  };
}

function parseIndexedProjectConfig() {
  const indexedKeys = Object.keys(process.env)
    .map((key) => key.match(/^MONGODB_URI_(\d+)$/))
    .filter(Boolean)
    .map((match) => Number(match[1]))
    .sort((a, b) => a - b);

  return indexedKeys.map((index) => {
    const mongoUri = String(process.env[`MONGODB_URI_${index}`] || "").trim();
    const projectId = String(process.env[`PROJECT_ID_${index}`] || `project-${index}`).trim();
    if (!mongoUri) {
      throw new Error(`MONGODB_URI_${index} is empty`);
    }

    return {
      projectId,
      mongoUri,
      backendWebhookUrls: buildWebhookUrlsFromIndexedEnv(index)
    };
  });
}

function parseProjectDbsConfig() {
  const raw = String(process.env.PROJECT_DBS_JSON || "").trim();
  if (!raw) {
    return parseIndexedProjectConfig();
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
