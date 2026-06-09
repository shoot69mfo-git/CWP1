const express = require("express");
const https = require("https");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const BEARER_TOKEN = process.env.BEARER_TOKEN || "extr_sk_v1.3L7Rf-2_oqQzWmeRFkTA_yq0Lp_Fe-ji.f1ffbd89018adffd";
const UPSTREAM = "https://api.extremecloudiq.com/pcgs/key-based/network-policy-392173463955102/users?async=false";

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/register", async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: "username and email are required" });
  }

  const body = JSON.stringify({ username, email });
  const url = new URL(UPSTREAM);

  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "Authorization": "Bearer " + BEARER_TOKEN,
    },
  };

  const upstream = https.request(options, (upRes) => {
    let data = "";
    upRes.on("data", (chunk) => (data += chunk));
    upRes.on("end", () => {
      res.status(upRes.statusCode).set("Content-Type", "application/json").send(data || "{}");
    });
  });

  upstream.on("error", (err) => {
    console.error("Upstream error:", err.message);
    res.status(502).json({ error: "Upstream request failed", detail: err.message });
  });

  upstream.write(body);
  upstream.end();
});

app.listen(PORT, () => {
  console.log(`Captive portal proxy running on http://localhost:${PORT}`);
});
