import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SITE_PORT = Number(process.env.WEBSITE_SERVER_PORT || 8788);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../dist");

const app = express();

app.use(express.static(DIST_DIR));
app.get("*", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(SITE_PORT, () => {
  console.log(`Website static server listening on port ${SITE_PORT}`);
});
