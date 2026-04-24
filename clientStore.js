const fs = require("fs");
const path = require("path");

const { clearMappings, setMapping } = require("./mapping");

const SUPPORTED_SERVICES = ["instagram", "facebook", "whatsapp"];
const dataDir = path.join(__dirname, "data");
const storageFilePath = path.join(dataDir, "clients.json");

/**
 * In-memory clients store.
 * Structure:
 * {
 *   id: string,
 *   name: string,
 *   services: {
 *     [service]: {
 *       enabled: boolean,
 *       meta_id: string,
 *       callback_url: string,
 *       token: string
 *     }
 *   }
 * }
 */
const clients = [];

function generateClientId() {
  return `client_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function ensureStorage() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(storageFilePath)) {
    fs.writeFileSync(storageFilePath, "[]", "utf8");
  }
}

function saveClientsToDisk() {
  ensureStorage();
  fs.writeFileSync(storageFilePath, JSON.stringify(clients, null, 2), "utf8");
}

function loadClientsFromDisk() {
  ensureStorage();

  const raw = fs.readFileSync(storageFilePath, "utf8").trim() || "[]";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Invalid clients.json format");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("clients.json must contain a JSON array");
  }

  parsed.forEach((inputClient) => {
    const normalized = normalizeClientInput(inputClient);
    clients.push({
      id: String(inputClient.id || generateClientId()),
      ...normalized
    });
  });
}

function normalizeServiceInput(service = {}) {
  return {
    enabled: Boolean(service.enabled),
    meta_id: String(service.meta_id || "").trim(),
    callback_url: String(service.callback_url || "").trim(),
    token: String(service.token || "").trim()
  };
}

function validateEnabledServiceConfig(serviceName, serviceConfig, clientName) {
  if (!serviceConfig.enabled) {
    return;
  }

  if (!serviceConfig.callback_url) {
    throw new Error(`${clientName}: ${serviceName} requires callback_url when enabled`);
  }

  if (!serviceConfig.token) {
    throw new Error(`${clientName}: ${serviceName} requires token when enabled`);
  }
}

function buildServiceFallbackKey(serviceName) {
  return `service:${serviceName}`;
}

function normalizeClientInput(input = {}) {
  const name = String(input.name || "").trim();
  if (!name) {
    throw new Error("Client name is required");
  }

  const services = {};
  SUPPORTED_SERVICES.forEach((serviceName) => {
    services[serviceName] = normalizeServiceInput(input.services?.[serviceName]);
    validateEnabledServiceConfig(serviceName, services[serviceName], name);
  });

  return { name, services };
}

function rebuildMappingsFromClients() {
  clearMappings();
  const seenRouteKeys = new Set();

  clients.forEach((client) => {
    SUPPORTED_SERVICES.forEach((serviceName) => {
      const config = client.services[serviceName];
      if (!config.enabled || !config.callback_url) {
        return;
      }

      const routeKey = config.meta_id || buildServiceFallbackKey(serviceName);
      if (seenRouteKeys.has(routeKey)) {
        if (!config.meta_id) {
          throw new Error(
            `Duplicate routing key for ${serviceName}. Add a unique Routing ID for each client on ${serviceName} to support multi-client routing.`
          );
        }
        throw new Error(`Duplicate routing key detected: ${routeKey}`);
      }
      seenRouteKeys.add(routeKey);

      setMapping(routeKey, {
        client_id: client.id,
        forward_url: config.callback_url
      });
    });
  });
}

function listClients() {
  return clients;
}

function createClient(input) {
  const normalized = normalizeClientInput(input);
  const client = {
    id: generateClientId(),
    ...normalized
  };

  clients.push(client);
  try {
    rebuildMappingsFromClients();
    saveClientsToDisk();
  } catch (error) {
    clients.pop();
    throw error;
  }
  return client;
}

function updateClient(clientId, input) {
  const index = clients.findIndex((item) => item.id === clientId);
  if (index === -1) {
    throw new Error("Client not found");
  }

  const normalized = normalizeClientInput(input);
  const previous = clients[index];

  clients[index] = {
    id: previous.id,
    ...normalized
  };

  try {
    rebuildMappingsFromClients();
    saveClientsToDisk();
  } catch (error) {
    clients[index] = previous;
    rebuildMappingsFromClients();
    throw error;
  }

  return clients[index];
}

function deleteClient(clientId) {
  const index = clients.findIndex((item) => item.id === clientId);
  if (index === -1) {
    return false;
  }

  clients.splice(index, 1);
  rebuildMappingsFromClients();
  saveClientsToDisk();
  return true;
}

function isKnownVerifyToken(token) {
  const verifyToken = String(token || "").trim();
  if (!verifyToken) {
    return false;
  }

  return clients.some((client) =>
    SUPPORTED_SERVICES.some((serviceName) => {
      const config = client.services[serviceName];
      return config.enabled && config.token && config.token === verifyToken;
    })
  );
}

loadClientsFromDisk();
rebuildMappingsFromClients();

module.exports = {
  SUPPORTED_SERVICES,
  listClients,
  createClient,
  updateClient,
  deleteClient,
  isKnownVerifyToken
};
