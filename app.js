// app.js — IMaster v5 (Híbrido)
require("./dotenv-load");
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const routes  = require("./routes");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", routes);
app.use(express.static(path.join(__dirname, "public")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("=================================");
  console.log("  IMaster RPG v5 — Motor Groq");
  console.log("  http://localhost:" + PORT);
  console.log("  Com IA Interpretativa — Groq");
  console.log("=================================");
});