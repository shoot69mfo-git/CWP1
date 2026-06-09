# Captive Portal — Setup & Deployment

## Files

```
project/
├── proxy.js          ← Express proxy server
├── package.json      ← Node dependencies
├── railway.toml      ← Railway deployment config
├── public/
│   └── index.html    ← Splash page (served by the proxy)
└── README.md
```

## How it works

The browser loads `index.html` from the Express server. When the user
submits the form, the page POSTs to `/register` on the same origin.
The proxy forwards the request to ExtremeCloud with the Bearer token
attached server-side — the token is never exposed to the browser.

---

## Deploy to Railway

### 1. Push your files to a GitHub repo

```
captive-portal/
├── proxy.js
├── package.json
├── railway.toml
└── public/
    └── index.html
```

### 2. Create a new Railway project

- Go to https://railway.app and click **New Project**
- Choose **Deploy from GitHub repo** and select your repo
- Railway auto-detects Node.js via nixpacks — no extra config needed

### 3. Set the environment variable

In your Railway project → **Variables** tab, add:

| Name           | Value                  |
|----------------|------------------------|
| `BEARER_TOKEN` | your ExtremeCloud token |

Railway automatically injects `PORT` — the app reads it already.

### 4. Deploy

Railway deploys automatically on every push to your main branch.
Your portal will be live at the Railway-provided `.up.railway.app` URL.

---

## Local development

```bash
npm install
BEARER_TOKEN=your_actual_token node proxy.js
# → http://localhost:3000
```

## Environment variables

| Variable       | Default                  | Description                   |
|----------------|--------------------------|-------------------------------|
| `BEARER_TOKEN` | `YOUR_BEARER_TOKEN_HERE` | ExtremeCloud API bearer token  |
| `PORT`         | `3000`                   | Injected automatically by Railway |
