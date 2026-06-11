# Notion to MAL Webhook Setup Guide

## Project Structure

```
notion-to-mal-webhook/
├── api/
│   └── sync-mal.ts                 # Vercel serverless function (webhook endpoint)
├── scripts/
│   ├── oauth-setup.ts              # One-time OAuth flow to get tokens
│   └── test-webhook.ts             # Manual testing script
├── src/
│   ├── types.ts                    # TypeScript interfaces
│   ├── mal-api.ts                  # MAL API functions
│   └── notion-api.ts               # Notion API utilities
├── .env.example                    # Example environment variables
├── .env                            # Your actual secrets (LOCAL ONLY - gitignored)
├── .gitignore                      # Git ignore file
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
└── README.md                        # Documentation
```

## Step 1: Initialize Project

```bash
mkdir notion-to-mal-webhook
cd notion-to-mal-webhook
npm init -y
```

## Step 2: Install Dependencies

```bash
npm install typescript ts-node dotenv axios @notionhq/client
npm install -D @types/node ts-node-dev
```

## Step 3: Create Folder Structure

```bash
mkdir -p api scripts src
```

## Step 4: Initialize TypeScript

```bash
npx tsc --init
```

Then update `tsconfig.json` with:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["scripts/**/*", "src/**/*", "api/**/*"],
  "exclude": ["node_modules"]
}
```

## Step 5: Create .env and .env.example

See the `.env.example` file for structure. Copy it:

```bash
cp .env.example .env
```

## Step 6: Create package.json Scripts

Add these to your `package.json`:

```json
{
  "scripts": {
    "build": "tsc",
    "oauth": "ts-node scripts/oauth-setup.ts",
    "test": "ts-node scripts/test-webhook.ts",
    "dev": "ts-node-dev --respawn api/sync-mal.ts"
  }
}
```

## Workflow

1. **Get tokens:** `npm run oauth`
2. **Test locally:** `npm run test`
3. **Deploy to Vercel:** Push to GitHub, Vercel auto-deploys
4. **Set up Notion automation:** Point to your Vercel webhook URL

## Environment Variables (for .env)

```
# MAL OAuth
MAL_CLIENT_ID=your_client_id
MAL_CLIENT_SECRET=your_client_secret (optional for web app)
MAL_REFRESH_TOKEN=your_refresh_token (set after oauth script)

# Notion
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_anime_database_id

# Webhook Security
WEBHOOK_SECRET=your_random_secret_key

# Local Testing
LOCAL_PORT=3000
```

## Next Steps

1. Create all the files from the following sections
2. Run `npm run oauth` to get your tokens
3. Run `npm run test` to validate webhook logic
4. Deploy to Vercel and update your Notion automation

---

**Files to create next (in order):**

1. `.env.example`
2. `src/types.ts`
3. `src/mal-api.ts`
4. `src/notion-api.ts`
5. `scripts/oauth-setup.ts`
6. `scripts/test-webhook.ts`
7. `api/sync-mal.ts`
8. `.gitignore`
9. `README.md`
