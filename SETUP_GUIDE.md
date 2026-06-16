# Quick Setup Guide

Get your Notion to MyAnimeList sync running in 5 minutes.

---

## Prerequisites

- Node.js 24.x
- MyAnimeList Account
- Notion Account
- Vercel Account (free)

---

## 1. Clone & Install (2 min)

```bash
git clone https://github.com/lozo6/mal-to-notion.git
cd mal-to-notion
npm install
```

---

## 2. Get Credentials (3 min)

### MyAnimeList

1. Go to https://myanimelist.net/apiconfig
2. Click "Create ID"
3. Fill in:
   - App Name: `Notion to MAL Webhook`
   - App Type: `Web`
   - Redirect URL: `http://localhost:3000/oauth`
   - Homepage: Your GitHub/website
4. Copy **Client ID** and **Client Secret**

### Notion

1. Go to https://www.notion.so/profile/integrations
2. Click "Create New Integration"
3. Copy your **API Key**
4. Open your anime database, get **Database ID** from URL
5. Share database with your integration

---

## 3. Create .env File

```bash
cp .env.example .env
```

Fill it in:

```ini
MAL_CLIENT_ID=your_client_id
MAL_CLIENT_SECRET=your_client_secret
MAL_REFRESH_TOKEN=leave_blank_for_now

NOTION_API_KEY=your_notion_key
NOTION_DATABASE_ID=your_database_id

WEBHOOK_SECRET=any_random_string
```

---

## 4. Get MAL Token (1 min)

```bash
npm run oauth
```

1. Click the printed authorization URL
2. Click "Authorize" on MyAnimeList
3. Copy the code from redirect URL
4. Paste code back into terminal

Your `.env` will auto-update with `MAL_REFRESH_TOKEN`.

---

## 5. Test Locally

```bash
npm run test
```

Should see:

```
[INFO] Starting MAL to Notion sync...
[INFO] Fetching MAL list...
[INFO] Found 50 anime
[INFO] Created: 3, Updated: 5, Failed: 0
```

---

## 6. Deploy to Vercel

### Via GitHub

```bash
git remote add origin https://github.com/your-username/your-repo.git
git branch -M main
git push -u origin main
```

Then on Vercel:

1. Go to vercel.com
2. Click "Add New Project"
3. Select your GitHub repo
4. Add environment variables (same as `.env`)
5. Deploy

Your cron URL: `https://your-project.vercel.app/api/cron-fetch-mal`

---

## 7. Create Notion Button

In your Notion database:

1. Click + to add property
2. Name: "Sync from MAL"
3. Type: Button
4. Action: "Send web request"
5. URL: `https://your-project.vercel.app/api/cron-fetch-mal`
6. Method: POST
7. Header:
   - Key: `x-webhook-secret`
   - Value: Your `WEBHOOK_SECRET`

---

## 8. Done!

Your sync is now:

- Running automatically on 1st and 15th of each month
- Triggerable anytime via Notion button
- Pulling anime from MAL with cover art
- Updating your Notion database

---

## Troubleshooting

**Button doesn't work?**

- Check Vercel env variables match `.env`
- Verify webhook secret is correct
- Check Vercel logs

**Anime not syncing?**

- Make sure anime is on your MAL list
- Verify Notion database ID is correct
- Run `npm run test` locally to debug

**Need help?**

- Check full README.md
- See MAL/Notion API docs
- Open GitHub issue

---

Happy tracking!
