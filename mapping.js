/**
 * In-memory mapping store.
 * Structure:
 * {
 *   [meta_id]: {
 *     client_id: string,
 *     forward_url: string
 *   }
 * }
 */
const mappingStore = {
  // Example values; replace or mutate at runtime.
  // "1234567890": {
  //   client_id: "client-a",
  //   forward_url: "https://example.com/webhooks/meta"
  // }
};

function getMapping(metaId) {
  if (!metaId) {
    return null;
  }

  return mappingStore[metaId] || null;
}

function setMapping(metaId, value) {
  if (!metaId || !value) {
    throw new Error("metaId and value are required");
  }

  mappingStore[metaId] = value;
  return mappingStore[metaId];
}

function removeMapping(metaId) {
  delete mappingStore[metaId];
}

function clearMappings() {
  Object.keys(mappingStore).forEach((metaId) => {
    delete mappingStore[metaId];
  });
}

module.exports = {
  mappingStore,
  getMapping,
  setMapping,
  removeMapping,
  clearMappings
};
