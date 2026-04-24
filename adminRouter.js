const express = require("express");
const {
  SUPPORTED_SERVICES,
  listClients,
  createClient,
  updateClient,
  deleteClient
} = require("./clientStore");

const router = express.Router();

router.get("/clients", (_req, res) => {
  res.status(200).json({
    services: SUPPORTED_SERVICES,
    data: listClients()
  });
});

router.post("/clients", (req, res) => {
  try {
    const client = createClient(req.body);
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put("/clients/:id", (req, res) => {
  try {
    const client = updateClient(req.params.id, req.body);
    res.status(200).json(client);
  } catch (error) {
    if (error.message === "Client not found") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(400).json({ error: error.message });
  }
});

router.delete("/clients/:id", (req, res) => {
  const deleted = deleteClient(req.params.id);
  if (!deleted) {
    return res.status(404).json({ error: "Client not found" });
  }

  return res.status(204).send();
});

module.exports = router;
