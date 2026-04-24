require("dotenv").config();

const express = require("express");
const path = require("path");
const webhookRouter = require("./router");
const adminRouter = require("./adminRouter");
const { initProjectResolver, shutdownProjectResolver } = require("./projectResolver");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Raw body is required for HMAC signature validation.
app.use(
  "/meta/webhook",
  express.raw({
    type: "application/json",
    limit: process.env.BODY_LIMIT || "1mb"
  })
);

app.use(express.json({ limit: process.env.BODY_LIMIT || "1mb" }));

app.use(webhookRouter);
app.use("/api", adminRouter);
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((err, _req, res, _next) => {
  console.error("[server] unhandled error", err);
  res.status(500).json({ error: "Internal Server Error" });
});

initProjectResolver()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] webhook gateway listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("[server] failed to initialize resolver", error.message);
    process.exit(1);
  });

process.on("SIGTERM", () => {
  shutdownProjectResolver()
    .catch(() => {})
    .finally(() => process.exit(0));
});
