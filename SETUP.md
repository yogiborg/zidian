# Zìdiǎn — Setup Guide

## What you need first
- [Node.js](https://nodejs.org) — download the LTS version and install it
- A [GitHub](https://github.com) account
- A [Cloudflare](https://cloudflare.com) account (free)
- An [Anthropic API key](https://console.anthropic.com) — get one from console.anthropic.com

---

## Step 1 — Deploy the Cloudflare Worker (the API proxy)

This is the middleman that holds your secret API key.

1. Go to [workers.cloudflare.com](https://workers.cloudflare.com) and log in
2. Click **Create application** → **Create Worker**
3. Give it a name like `zidian-proxy`
4. Delete everything in the editor and paste in the contents of `worker.js`
5. Click **Deploy**
6. Go to **Settings** → **Variables** → **Add variable**
   - Variable name: `ANTHROPIC_API_KEY`
   - Value: your Anthropic API key
   - Click **Encrypt** (keeps it secret), then **Save**
7. Copy your Worker URL — it'll look like `https://zidian-proxy.your-name.workers.dev`

---

## Step 2 — Put the project on GitHub

1. Go to github.com → **New repository**
2. Name it `zidian`, set it to Public or Private (either works)
3. Don't initialize with a README
4. Open Terminal (Mac) or Command Prompt (Windows)
5. Run these commands one at a time:

```bash
cd path/to/your/zidian/folder
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/zidian.git
git push -u origin main
```

---

## Step 3 — Deploy to Cloudflare Pages

1. Go to [pages.cloudflare.com](https://pages.cloudflare.com)
2. Click **Create a project** → **Connect to Git**
3. Connect your GitHub account and select the `zidian` repo
4. Build settings:
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Under **Environment variables**, add:
   - `VITE_API_URL` = your Worker URL from Step 1
6. Click **Save and Deploy**

Cloudflare will build and give you a URL like `https://zidian.pages.dev`. Done.

---

## Making updates (this is the normal workflow)

1. Edit `src/App.jsx` however you want
2. Open Terminal in the zidian folder and run:
```bash
git add .
git commit -m "describe what you changed"
git push
```
3. Cloudflare Pages detects the push and rebuilds automatically — takes about 30 seconds

That's it. You never have to touch the Cloudflare dashboard again unless you want to change settings.

---

## Running it locally (optional)

If you want to preview changes before pushing:

```bash
# First time only:
npm install
cp .env.example .env
# Edit .env and paste your Worker URL

# Every time:
npm run dev
```

Then open `http://localhost:5173` in your browser.
