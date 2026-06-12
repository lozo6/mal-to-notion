# Notion ↔ MyAnimeList Sync

A serverless cron job that automatically syncs your MyAnimeList to Notion. Your anime library is always up to date with the latest status, genres, and cover art.

---

## Features

- **Automated Sync** — Runs automatically on the 1st and 15th of each month
- **Manual Trigger** — Click a button in Notion to sync anytime
- **Full List Fetch** — Pulls your entire MAL library
- **Smart Sync** — Creates new pages for anime not in Notion, updates existing ones
- **Cover Art** — Fetches poster images and icons from MAL
- **Status Tracking** — Syncs your watch status (Watching, Completed, On Hold, etc.)
- **Genre Tags** — Auto-populates genres from MAL
- **Error Handling** — Tracks sync status and timestamps
- **TypeScript** — Fully typed for safety
- **Vercel Deployment** — One-click serverless deployment
- **Zero Config** — Just set environment variables and go

---

## What It Does

When you run the sync:

1. Fetches your entire MAL anime list
2. Filters to anime only (excludes manga)
3. For each anime:
   - **If it's new on MAL:** Creates a new Notion page with cover art, icons, genres, status
   - **If it already exists:** Updates status, genres, and metadata
4. Updates Notion "Last Synced" timestamp
5. Logs results: created, updated, failed

---

## Project Structure

```
notion-to-mal-webhook/
├── api/
│   └── cron-fetch-mal.ts           # Vercel cron job (runs 1st & 15th)
├── src/
│   ├── types.ts                    # TypeScript interfaces
│   ├── mal-api.ts                  # MAL API functions
│   └── notion-api.ts               # Notion API utilities
├── .env.example                    # Example environment variables
├── .env                            # Your secrets (LOCAL ONLY - gitignored)
├── .gitignore                      # Git ignore file
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── vercel.json                     # Vercel cron configuration
└── README.md                        # This file
```

---

## Prerequisites

- Node.js 24.x (verify with `node --version`)
- npm (comes with Node)
- MyAnimeList Account — With anime list
- Notion Account — With anime database
- Vercel Account (free tier works) — For deployment

---

## Setup Instructions

### Step 1: Clone & Install

```bash
git clone https://github.com/lozo6/notion-to-mal-webhook.git
cd notion-to-mal-webhook
npm install
```

### Step 2: Environment Variables

Copy .env.example to .env:

```bash
cp .env.example .env
```

Fill in your credentials:

```ini
MAL_CLIENT_ID=your_client_id_here
MAL_CLIENT_SECRET=your_client_secret_here
MAL_REFRESH_TOKEN=will_be_set_after_oauth_setup

NOTION_API_KEY=your_notion_api_key_here
NOTION_DATABASE_ID=your_anime_database_id_here

WEBHOOK_SECRET=your_random_secret_here

LOCAL_PORT=3000
NODE_ENV=development
```

### Step 3: Get MAL Client ID

1. Go to MyAnimeList API Applications (https://myanimelist.net/apiconfig)
2. Click "Create ID" and fill in the form:
   - App Name: "Notion to MAL Webhook"
   - App Type: "Web"
   - Redirect URL: `http://localhost:3000/oauth`
   - Homepage URL: Your GitHub repo or personal website
3. Copy your **Client ID** to .env as `MAL_CLIENT_ID`
4. Copy your **Client Secret** to .env as `MAL_CLIENT_SECRET`

### Step 4: Get Notion API Key & Database ID

1. Go to Notion Developer Console (https://www.notion.so/profile/integrations)
2. Click "Create New Integration" and follow the prompts
3. Copy your **API Key** to .env as `NOTION_API_KEY`
4. Open your anime database in Notion
5. Copy the **Database ID** from the URL:
   - URL: `https://www.notion.so/{workspace}/{DATABASE_ID}?v=...`
   - Copy everything between `/` and `?`
   - Paste as `NOTION_DATABASE_ID`
6. Share your database with the integration:
   - Click the three dots in your Notion database
   - Click "Add Connections"
   - Select your integration

### Step 5: Run OAuth Setup (One-time)

This generates your MAL access & refresh tokens:

```bash
npm run oauth
```

Follow the prompts:

1. A URL will be printed — copy and open it in your browser
2. Click "Authorize" on MyAnimeList
3. You'll be redirected to a page with an authorization code
4. Copy the code and paste it back into the terminal
5. Your .env file will be automatically updated with `MAL_REFRESH_TOKEN`

### Step 6: Test Locally

Before deploying, test the cron locally:

```bash
npm run test
```

This simulates a sync run. Check for:

- ✅ "Starting MAL to Notion sync..."
- ✅ "Found X anime"
- ✅ "Created: X, Updated: Y, Failed: Z"

---

## Notion Database Setup

Your anime database needs these properties:

| Property         | Type         | Required | Notes                                               |
| ---------------- | ------------ | -------- | --------------------------------------------------- |
| Name             | Title        | ✅ Yes   | Anime title                                         |
| URL              | URL          | ✅ Yes   | MAL anime link (added by cron)                      |
| Alternative Name | Rich Text    | ❌ No    | English title if different                          |
| Status           | Status       | ✅ Yes   | Current watch status                                |
| Genre            | Multi-select | ❌ No    | Auto-populated from MAL                             |
| Sync Status      | Select       | ❌ No    | Internal tracking (Synced to MAL / Pending / Error) |
| Last Synced      | Date         | ❌ No    | When the page was last updated                      |

**Status Options** (exact names matter):

- Plan to Watch
- Watching
- Completed
- On Hold
- Dropped

**Sync Status Options:**

- Synced to MAL
- Pending
- Error

---

## How to Use

### Manual Sync (Anytime)

When you add a new anime to your MAL list:

1. Go to your Notion anime database
2. Click the "Sync from MAL" button (or automation button)
3. The cron job runs immediately
4. New anime appears in Notion within seconds

### Automatic Sync (Scheduled)

The cron runs automatically:

- **1st of the month** at 00:00 UTC
- **15th of the month** at 00:00 UTC

All your anime is synced without any action needed.

---

## Deploying to Vercel

### Option A: Via GitHub (Recommended)

1. Push to GitHub:

```bash
git remote add origin https://github.com/your-username/notion-to-mal-webhook.git
git branch -M main
git push -u origin main
```

2. Connect to Vercel:
   - Go to [Vercel.com](https://vercel.com)
   - Sign in with GitHub
   - Click "Add New Project"
   - Select `notion-to-mal-webhook` repository
   - Click "Import"

3. Set Environment Variables:
   - In Vercel dashboard, go to **Settings → Environment Variables**
   - Add all variables from your `.env` file:
     - `MAL_CLIENT_ID`
     - `MAL_CLIENT_SECRET`
     - `MAL_REFRESH_TOKEN`
     - `NOTION_API_KEY`
     - `NOTION_DATABASE_ID`
     - `WEBHOOK_SECRET`
   - Click "Save"

4. Deploy:
   - Vercel auto-deploys when you push to `main`
   - Your cron will be available at: `https://your-project-name.vercel.app/api/cron-fetch-mal`

---

## Setting Up the Automation Button in Notion

Once deployed, create a button in Notion that triggers manual sync:

1. Open your Notion anime database
2. Click the **+** icon to add a new property
3. Configure:
   - **Name:** "Sync from MAL" (or whatever you like)
   - **Type:** Button
   - **Button Text:** "Sync from MAL"
   - **Action:** "Send web request"
   - **URL:** `https://your-project-name.vercel.app/api/cron-fetch-mal`
   - **Method:** POST
   - **Headers:** Add custom header:
     - **Key:** `x-webhook-secret`
     - **Value:** Your `WEBHOOK_SECRET` from `.env`

4. Save

Now you can click the button anytime to trigger an immediate sync!

---

## MAL Status Mapping

The cron converts MAL statuses to Notion statuses:

| MAL Status    | Notion Status |
| ------------- | ------------- |
| watching      | Watching      |
| completed     | Completed     |
| on_hold       | On Hold       |
| dropped       | Dropped       |
| plan_to_watch | Plan to Watch |

---

## Troubleshooting

### Cron not running

- Check Vercel dashboard: Settings → Cron Jobs
- Verify `vercel.json` has correct cron schedule:
  ```json
  {
    "crons": [
      {
        "path": "/api/cron-fetch-mal",
        "schedule": "0 0 1,15 * *"
      }
    ]
  }
  ```

### Anime not syncing to Notion

- Make sure anime is on your MAL list
- Check "Last Synced" date on Notion page
- Verify `NOTION_DATABASE_ID` is correct in Vercel env
- Check Vercel logs: `vercel logs`

### Status not updating

- Verify status names match exactly (see table above)
- Make sure Status property is set to "Status" type in Notion
- Check anime is on your MAL list

### Token refresh failed

- Run `npm run oauth` locally to get a fresh token
- Update `MAL_REFRESH_TOKEN` in Vercel environment variables
- Verify `MAL_CLIENT_ID` is correct

### Missing cover art

- MAL returns `main_picture.large` and `main_picture.medium`
- If missing, Notion page will have no cover/icon (this is normal)
- Older anime may not have cover art on MAL

### Button says "Error"

- Click the Vercel logs to see details
- Most common: wrong URL or missing environment variables
- Verify webhook secret matches between Notion and Vercel

---

## Development

Useful Commands:

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run oauth        # One-time OAuth setup (generates tokens)
npm run test         # Test cron locally (simulate a run)
```

Debugging:

- **Local:** Use `npm run test` to simulate the cron
- **Production:** Check Vercel dashboard → Deployments → Runtime Logs
- **Notion:** Check "Sync Status" and "Last Synced" fields on each page

---

## Architecture

```
Your MAL List
     ↓
Cron Job (1st & 15th)
     ↓
Fetch Entire List
     ↓
Filter to Anime Only
     ↓
For Each Anime:
  - Build MAL URL
  - Check if exists in Notion
  - Create or Update page
     ↓
Update Sync Timestamps
     ↓
Log Results
```

---

## Rate Limiting

- MAL API: No strict limits for authenticated requests
- Notion API: 3-4 requests per second (cron respects this)
- Batch Size: 10 anime processed in parallel
- Delay Between Batches: 50ms

---

## License

MIT License — see LICENSE file for details

---

## Support

For help:

- Check the troubleshooting section above
- Open an issue on GitHub
- Check [MAL API Docs](https://myanimelist.net/apiconfig/references/api/v2)
- Check [Notion API Docs](https://developers.notion.com/)

---

**Built by lozo6** — Happy anime tracking! 🍿✨
