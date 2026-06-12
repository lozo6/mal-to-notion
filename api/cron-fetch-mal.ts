import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import axios from "axios";
import { Client } from "@notionhq/client";
import * as malApi from "../src/mal-api";

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;
const MAL_API_BASE = "https://api.myanimelist.net/v2";

interface MALAnime {
  node: {
    id: number;
    title: string;
    main_picture: {
      large?: string;
      medium?: string;
    };
    alternative_titles?: {
      en?: string;
    };
    num_episodes: number;
    genres: Array<{ id: number; name: string }>;
    media_type?: string;
  };
  list_status?: {
    status: string;
    num_watched_episodes: number;
  };
}

interface NotionPage {
  id: string;
  url: string;
}

let accessToken = "";

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    console.log("[INFO] Starting MAL to Notion sync...\n");

    accessToken = await malApi.refreshMALToken();
    console.log("[INFO] Fetching MAL list...\n");

    const malAnimes = await fetchEntireMALList();
    console.log(`[INFO] Found ${malAnimes.length} anime\n`);

    console.log("[INFO] Fetching Notion pages...\n");
    const existingPages = await fetchAllNotionPages();
    const urlMap = new Map(existingPages.map((p) => [p.url, p.id]));
    console.log(`[INFO] Found ${existingPages.length} pages\n`);

    let created = 0;
    let updated = 0;
    let failed = 0;

    // Process in smaller batches
    const batchSize = 10;
    for (let i = 0; i < malAnimes.length; i += batchSize) {
      const batch = malAnimes.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (anime) => {
          try {
            const malUrl = `https://myanimelist.net/anime/${anime.node.id}/${sanitizeTitle(
              anime.node.title,
            )}`;

            const pageId = urlMap.get(malUrl);
            if (pageId) {
              await updateNotionPage(anime, pageId);
              updated++;
            } else {
              await createNotionPage(anime);
              created++;
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error(`[ERROR] ${anime.node.title}: ${msg}`);
            failed++;
          }
        }),
      );

      // console.log(`[INFO] Processed ${Math.min(i + batchSize, malAnimes.length)}/${malAnimes.length}`);
    }

    console.log(
      `\n[SUCCESS] Created: ${created}, Updated: ${updated}, Failed: ${failed}\n`,
    );

    return res.status(200).json({
      success: true,
      created,
      updated,
      failed,
      total: malAnimes.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] ${msg}\n`);
    return res.status(500).json({ success: false, error: msg });
  }
};

async function fetchEntireMALList(): Promise<MALAnime[]> {
  const allAnimes: MALAnime[] = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    const response = await axios.get(`${MAL_API_BASE}/users/@me/animelist`, {
      params: {
        fields:
          "list_status,num_episodes,genres,alternative_titles,main_picture,media_type",
        limit,
        offset,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const animeOnly = response.data.data.filter((item: any) =>
      ["tv", "ova", "movie", "special"].includes(item.node.media_type),
    );

    allAnimes.push(...animeOnly);
    hasMore = response.data.paging?.next ? true : false;
    offset += limit;
  }

  return allAnimes;
}

async function fetchAllNotionPages(): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let cursor: string | undefined = undefined;

  while (true) {
    const response = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    allPages.push(
      ...response.results.map((page: any) => ({
        id: page.id,
        url: page.properties.URL?.url || "",
      })),
    );

    if (!response.has_more) break;
    cursor = response.next_cursor || undefined;
  }

  return allPages;
}

async function createNotionPage(anime: MALAnime): Promise<void> {
  const { id, title, main_picture, alternative_titles, num_episodes, genres } =
    anime.node;
  const notionStatus = anime.list_status
    ? mapMALStatusToNotion(anime.list_status.status)
    : "Plan to Watch";

  await notion.pages.create({
    parent: { database_id: databaseId },
    cover: main_picture.large
      ? { type: "external", external: { url: main_picture.large } }
      : undefined,
    icon: main_picture.medium
      ? { type: "external", external: { url: main_picture.medium } }
      : undefined,
    properties: {
      Name: { title: [{ text: { content: title } }] },
      URL: {
        url: `https://myanimelist.net/anime/${id}/${sanitizeTitle(title)}`,
      },
      "Alternative Name": {
        rich_text: alternative_titles?.en
          ? [{ text: { content: alternative_titles.en } }]
          : [],
      },
      Status: { status: { name: notionStatus } },
      Genre: { multi_select: (genres || []).map((g) => ({ name: g.name })) },
      "Sync Status": { select: { name: "Synced to MAL" } },
      "Last Synced": {
        date: { start: new Date().toISOString().split("T")[0] },
      },
    },
  });

  // console.log(`[INFO] Created: ${title}`);
}

async function updateNotionPage(
  anime: MALAnime,
  pageId: string,
): Promise<void> {
  const { num_episodes, genres } = anime.node;
  const notionStatus = anime.list_status
    ? mapMALStatusToNotion(anime.list_status.status)
    : "Plan to Watch";

  await notion.pages.update({
    page_id: pageId,
    properties: {
      Status: { status: { name: notionStatus } },
      Genre: { multi_select: (genres || []).map((g) => ({ name: g.name })) },
      "Sync Status": { select: { name: "Synced to MAL" } },
      "Last Synced": {
        date: { start: new Date().toISOString().split("T")[0] },
      },
    },
  });

  // console.log(`[INFO] Updated: ${anime.node.title}`);
}

function sanitizeTitle(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function mapMALStatusToNotion(malStatus: string): string {
  const map: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    on_hold: "On Hold",
    dropped: "Dropped",
    plan_to_watch: "Plan to Watch",
  };
  return map[malStatus.toLowerCase()] || "Plan to Watch";
}
