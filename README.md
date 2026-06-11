# Notion to MyAnimeList Webhook

notion-to-mal-webhook is a TypeScript-powered serverless webhook that syncs your anime list from Notion to MyAnimeList (MAL) in real-time. Change a status or episode count in Notion, and it automatically updates on MAL.

---

## Features

- Real-time sync — Changes in Notion instantly update MAL
- Status updates — Plan to Watch, Watching, Completed, On Hold, Dropped
- Episode tracking — Sync episodes watched to MAL
- Error handling — Detailed error messages stored in Notion
- Token refresh — Automatic MAL OAuth token refresh
- Search fallback — If MAL URL is missing, searches by anime title
- TypeScript — Fully typed for safety
- Vercel deployment — One-click serverless deployment
- Local testing — Test your webhook before deploying

---

## Project Structure

```
notion-to-mal-webhook/
├── api/
│   ├── sync-mal.ts                 # Vercel serverless webhook function (Notion → MAL)
│   └── sync-from-mal.ts            # Vercel webhook for MAL → Notion sync
├── scripts/
│   ├── oauth-setup.ts              # One-time OAuth setup
│   └── test-webhook.ts             # Local webhook testing
├── src/
│   ├── types.ts                    # TypeScript types & interfaces
│   ├── mal-api.ts                  # MAL API functions
│   └── notion-api.ts               # Notion API utilities
├── .env.example                    # Example environment variables
├── .env                            # Your secrets (local only, gitignored)
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
└── README.md                        # This file
```

---

## Prerequisites

- Node.js 18+ (verify with `node --version`)
- npm (comes with Node)
- MyAnimeList Account — You'll need to register an API application
- Notion Account — With access to your anime database
- Vercel Account (optional, for deployment) — Free tier works fine

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
2. Click Create ID and fill in the form:
   - App Name: "Notion to MAL Webhook"
   - App Type: "Web"
   - Redirect URL: http://localhost/oauth
   - Homepage URL: Your GitHub repo or personal website
3. Copy your Client ID (and optionally Client Secret) to .env

### Step 4: Get Notion API Key & Database ID

1. Go to Notion Developer Console (https://www.notion.so/profile/integrations)
2. Click Create New Integration and follow the prompts
3. Copy your API Key to .env as NOTION_API_KEY
4. Open your anime database in Notion, copy the database ID from the URL:
   - URL: https://www.notion.so/{workspace}/{DATABASE_ID}?v=...
   - Copy everything between the slash and the question mark

### Step 5: Run OAuth Setup (One-time)

This generates your MAL access & refresh tokens:

```bash
npm run oauth
```

Follow the prompts:

1. Click the generated authorization URL
2. Authorize the application on MyAnimeList
3. Copy the authorization code from the redirect URL
4. Paste it back into the terminal

Your .env file will be automatically updated with the refresh token.

### Step 6: Test Locally

Before deploying, test the webhook locally:

```bash
npm run test
```

This runs three test scenarios:

1. Basic Status Update
2. Status + Episodes
3. Mark Completed

---

## Notion Database Setup

Your anime database needs these properties:

Name (Title) - Required - Anime title
URL (URL) - Optional - MAL anime link
Status (Status) - Required - Plan to Watch / Watching / Completed / On Hold / Dropped
Episodes Watched (Number) - Optional
Episodes Total (Number) - Optional
Genre (Multi-select) - Optional
Sync Status (Select) - Internal
Last Synced (Date) - Internal
Sync Error Message (Rich Text) - Internal

Status options:

- Plan to Watch
- Watching
- Completed
- On Hold
- Dropped

Sync Status options:

- Synced to MAL
- Pending
- Error

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
   - Go to Vercel.com
   - Sign in with GitHub
   - Click Add New Project
   - Select your notion-to-mal-webhook repository
   - Click Import

3. Set Environment Variables:
   - In Vercel dashboard, go to Settings → Environment Variables
   - Add all variables from your .env file

4. Deploy:
   - Vercel auto-deploys when you push to main
   - Your webhook URL will be: https://your-vercel-url.vercel.app/api/sync-mal

---

## Setting Up Notion Automation

Once your webhook is deployed to Vercel, create a Notion automation to trigger it:

1. Open your Notion anime database
2. Click the automation button (lightning icon, top right)
3. Create a new automation:
   - Trigger: "Database - Property of page changes"
   - Property: Select "Status" or "Episodes Watched"
   - Then: "Send webhook"
   - URL: Paste your Vercel webhook URL
   - Method: POST
   - Headers: Add custom header:
     - Key: x-webhook-secret
     - Value: Your WEBHOOK_SECRET from .env

4. Save & activate the automation

---

## How It Works

Flow Diagram:

Notion Page Changed
↓
Notion Automation
↓
Vercel Webhook (api/sync-mal.ts)
↓
Extract: Title, Status, Episodes
↓
Search MAL (if no URL)
↓
Update/Add to MAL List
↓
Update Notion: Sync Status + Timestamp

What Happens on Each Sync:

1. Receive — Webhook gets Notion page data
2. Extract — Pulls title, status, and episodes watched
3. Search — Finds anime ID on MAL
4. Validate — Checks status is valid
5. Update — Sends update to MAL API
6. Report — Updates Notion with sync status & timestamp
7. Error Handling — Stores error message in Notion if anything fails

---

## Troubleshooting

Anime not found on MyAnimeList

- Make sure the anime title matches MAL exactly
- Try adding the MAL URL to the URL property
- The search is case-sensitive

Invalid status

- Verify Status property has exact values:
  - Plan to Watch
  - Watching
  - Completed
  - On Hold
  - Dropped

Token refresh failed

- Check MAL_CLIENT_ID and MAL_REFRESH_TOKEN in Vercel environment
- Run npm run oauth locally to get a fresh token

Notion page update failed

- Verify NOTION_API_KEY and NOTION_DATABASE_ID
- Make sure the Notion integration has access to your database

---

## MAL Status Mapping

Notion Status → MAL Status:

- Plan to Watch → plan_to_watch
- Watching → watching
- Completed → completed
- On Hold → on_hold
- Dropped → dropped

---

## Development

Useful Commands:

```bash
npm install          # Install dependencies
npm run build        # Run TypeScript compiler
npm run oauth        # One-time OAuth setup
npm run test         # Test webhook locally
npm run dev          # Start dev server
```

Debugging:

- Local testing: Use npm run test to simulate webhook calls
- Vercel logs: Check vercel logs command or Vercel dashboard
- Notion: Check Sync Status and Sync Error Message fields on each page

---

## License

MIT License — see LICENSE file for details

---

## Acknowledgments

- MyAnimeList API (https://myanimelist.net/apiconfig/references/api/v2)
- Notion API (https://developers.notion.com/)
- Vercel (https://vercel.com)
- Built by lozo6

---

## Support

For help:

- Check the troubleshooting section above
- Open an issue on GitHub
- Check Notion/MAL API documentation

Happy anime tracking!
