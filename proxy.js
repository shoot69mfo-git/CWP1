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
  const { username, email, usergroup } = req.body;

  if (!username || !email) {
    return res.status(400).json({ error: "username and email are required" });
  }

  const body = JSON.stringify({
    users: [{ name: username, email, user_group_name: usergroup }]
  });
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
      if (upRes.statusCode !== 200) {
        return res.status(upRes.statusCode).set("Content-Type", "application/json").send(data || "{}");
      }

      let created;
      try { created = JSON.parse(data); } catch (e) {
        return res.status(502).json({ error: "Invalid JSON from upstream" });
      }

      const userId = created.users && created.users[0] && created.users[0].id;
      if (!userId) {
        return res.json(created);
      }

      const encodedUsername = encodeURIComponent(username);
      const getOptions = {
        hostname: "api.extremecloudiq.com",
        path: `/endusers?page=1&limit=10&usernames=${encodedUsername}`,
        method: "GET",
        headers: { "Authorization": "Bearer " + BEARER_TOKEN }
      };

      const getReq = https.request(getOptions, (getRes) => {
        let userData = "";
        getRes.on("data", (chunk) => (userData += chunk));
        getRes.on("end", () => {
          console.log("Enduser response:", userData);
          let userDetail;
          try { userDetail = JSON.parse(userData); } catch (e) { userDetail = {}; }
          const enduser = userDetail.data && userDetail.data[0];
          created.users[0].password = enduser
            ? (enduser.password || enduser.ppsk || enduser.passphrase || enduser.user_password || enduser.key || null)
            : null;
          console.log("Enduser fields:", enduser ? Object.keys(enduser) : "none");
          res.json(created);
        });
      });

      getReq.on("error", (err) => {
        console.error("GET enduser error:", err.message);
        res.json(created);
      });

      getReq.end();
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
