# Setting Up the "Sync from MAL" Button in Notion

Once you deploy the new api/sync-from-mal.ts endpoint to Vercel, you can create a button in Notion that syncs anime data FROM MAL back to your Notion database.

## What the Button Does

When clicked, the button will:

1. Fetch the latest anime details from MyAnimeList (title, episodes, genres, status)
2. Update your Notion page with:
   - Episodes Total — Total episodes on MAL
   - Genre — Anime genres from MAL
   - Status — Your current status on MAL (if the anime is on your list)
   - Episodes Watched — How many you've watched on MAL

## Setup Steps

### Step 1: Deploy the New Endpoint

1. Replace src/mal-api.ts with the updated version (src-mal-api-updated.ts)
2. Replace src/notion-api.ts with the updated version (src-notion-api-updated.ts)
3. Add the new file api/sync-from-mal.ts to your project
4. Rebuild and push to GitHub:
   ```bash
   npm run build
   git add .
   git commit -m "Add MAL to Notion sync endpoint"
   git push
   ```
5. Vercel will auto-deploy. Your new webhook URL will be:
   ```
   https://your-vercel-url.vercel.app/api/sync-from-mal
   ```

### Step 2: Create the Button in Notion

1. Open your anime database in Notion
2. Click the + button to add a new property
3. Name: Sync from MAL
4. Type: Button
5. Click the button settings and configure:
   - Button label: "Sync from MAL" or "Refresh from MAL"
   - Notification: "Button clicked" (optional)
   - Action: "Send web request"
   - URL: Paste your Vercel webhook URL:
     ```
     https://your-vercel-url.vercel.app/api/sync-from-mal
     ```
   - Method: POST
   - Headers: Add a custom header:
     - Key: x-webhook-secret
     - Value: Your WEBHOOK_SECRET from .env

6. Save the button

### Step 3: Test It

1. Go to an anime page in your database that has a MAL URL
2. Click the "Sync from MAL" button
3. Check the Sync Status field:
   - Should say "Synced to MAL" (success)
   - Or "Error" with details in Sync Error Message if something failed

### Step 4: Done!

Now you can click the button anytime to refresh anime data from MAL.

## Troubleshooting

Button says "Error"

- Check Sync Error Message field for details
- Make sure the anime is on your MAL list (if syncing status/episodes)
- Verify the MAL URL is correct

Genres not syncing

- Make sure your Notion Genre property is set to Multi-select type
- The genres will auto-create if they don't exist

Status/Episodes not syncing

- The anime must be on your MAL list for this to work
- If it's not on your list yet, only basic info (title, genres, episodes total) will sync

Button URL not working

- Double-check your Vercel URL is correct
- Make sure WEBHOOK_SECRET matches between Notion and Vercel env variables

## File Changes Summary

You'll need to replace:

- src/mal-api.ts → src-mal-api-updated.ts
- src/notion-api.ts → src-notion-api-updated.ts

And add:

- api/sync-from-mal.ts (new file)

That's it! Enjoy two-way syncing!
