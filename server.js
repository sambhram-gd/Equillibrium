// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var port = Number(process.env.PORT) || 3e3;
var distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));
app.get("*", (req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});
app.listen(port, "0.0.0.0", () => {
  console.log(`Equilibrium production server running on port ${port}`);
});
