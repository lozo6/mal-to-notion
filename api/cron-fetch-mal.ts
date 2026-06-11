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

/**
 * Cron job to fetch entire MAL list and sync to Notion
 * Runs on 1st and 15th of each month
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    console.log("[INFO] Starting scheduled MAL to Notion full sync...\n");

    // Refresh token first
    accessToken = await malApi.refreshMALToken();

    // Fetch entire MAL list
    console.log("[INFO] Fetching your entire MAL anime list...\n");
    const malAnimes = await fetchEntireMALList();

    console.log(`[INFO] Found ${malAnimes.length} anime on your MAL list\n`);

    // Fetch existing Notion pages
    console.log("[INFO] Fetching existing Notion pages...\n");
    const existingPages = await fetchAllNotionPages();
    const existingURLs = new Set(existingPages.map((p) => p.url));

    console.log(`[INFO] Found ${existingPages.length} existing Notion pages\n`);

    let created = 0;
    let updated = 0;
    let failed = 0;

    // Process each anime
    for (const anime of malAnimes) {
      try {
        const malUrl = `https://myanimelist.net/anime/${anime.node.id}/${sanitizeTitle(
          anime.node.title,
        )}`;

        if (existingURLs.has(malUrl)) {
          // Update existing page
          await updateNotionPage(anime);
          updated++;
        } else {
          // Create new page
          await createNotionPage(anime);
          created++;
        }

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[ERROR] Failed to sync anime ${anime.node.title}: ${errorMsg}`,
        );
        failed++;
      }
    }

    console.log(`\n[SUCCESS] Sync complete!`);
    console.log(
      `[INFO] Created: ${created}, Updated: ${updated}, Failed: ${failed}\n`,
    );

    return res.status(200).json({
      success: true,
      message: "Scheduled MAL to Notion sync completed",
      created,
      updated,
      failed,
      total: malAnimes.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Cron job failed: ${errorMessage}\n`);
    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * Fetch entire MAL anime list with pagination
 */
async function fetchEntireMALList(): Promise<MALAnime[]> {
  const allAnimes: MALAnime[] = [];
  let offset = 0;
  const limit = 200;
  let hasMore = true;

  while (hasMore) {
    try {
      const response = await axios.get(`${MAL_API_BASE}/users/@me/animelist`, {
        params: {
          fields:
            "list_status,num_episodes,genres,alternative_titles,main_picture,media_type",
          limit,
          offset,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      // Filter to anime only (exclude manga)
      const animeOnly = response.data.data.filter(
        (item: any) => item.node.media_type === "anime",
      );

      allAnimes.push(...animeOnly);

      hasMore = response.data.paging?.next ? true : false;
      offset += limit;

      console.log(`[INFO] Fetched ${allAnimes.length} anime so far...`);
    } catch (error) {
      console.error("[ERROR] Error fetching MAL list:", error);
      throw error;
    }
  }

  return allAnimes;
}

/**
 * Fetch all existing Notion pages
 */
async function fetchAllNotionPages(): Promise<NotionPage[]> {
  const allPages: NotionPage[] = [];
  let hasMore = true;
  let startCursor: string | undefined = undefined;

  while (hasMore) {
    try {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor: startCursor,
        page_size: 100,
      });

      allPages.push(
        ...response.results.map((page: any) => ({
          id: page.id,
          url: page.properties.URL?.url || "",
        })),
      );

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    } catch (error) {
      console.error("[ERROR] Error fetching Notion pages:", error);
      throw error;
    }
  }

  return allPages;
}

/**
 * Create a new Notion page for an anime
 */
async function createNotionPage(anime: MALAnime): Promise<void> {
  try {
    const {
      id,
      title,
      main_picture,
      alternative_titles,
      num_episodes,
      genres,
    } = anime.node;

    const sanitizedTitle = sanitizeTitle(title);
    const malUrl = `https://myanimelist.net/anime/${id}/${sanitizedTitle}`;

    const notionGenres = (genres || []).map((g) => ({ name: g.name }));

    // Map MAL status to Notion status
    const notionStatus = anime.list_status
      ? mapMALStatusToNotion(anime.list_status.status)
      : "Plan to Watch";

    console.log(`[INFO] Creating Notion page for "${title}"...`);

    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      cover: main_picture.large
        ? {
            type: "external",
            external: { url: main_picture.large },
          }
        : undefined,
      icon: main_picture.medium
        ? {
            type: "external",
            external: { url: main_picture.medium },
          }
        : undefined,
      properties: {
        Name: {
          title: [{ text: { content: title } }],
        },
        URL: {
          url: malUrl,
        },
        "Alternative Name": {
          rich_text: alternative_titles?.en
            ? [{ text: { content: alternative_titles.en } }]
            : [],
        },
        Status: {
          status: { name: notionStatus },
        },
        "Episodes Total": {
          number: num_episodes,
        },
        "Episodes Watched": {
          number: anime.list_status?.num_watched_episodes || 0,
        },
        Genre: {
          multi_select: notionGenres,
        },
        "Sync Status": {
          select: { name: "Synced to MAL" },
        },
        "Last Synced": {
          date: { start: new Date().toISOString().split("T")[0] },
        },
      },
    });

    console.log(`[SUCCESS] Created page for "${title}"\n`);
  } catch (error) {
    console.error(`[ERROR] Failed to create page:`, error);
    throw error;
  }
}

/**
 * Update an existing Notion page
 */
async function updateNotionPage(anime: MALAnime): Promise<void> {
  try {
    const { id, title, num_episodes, genres } = anime.node;

    const notionStatus = anime.list_status
      ? mapMALStatusToNotion(anime.list_status.status)
      : "Plan to Watch";

    console.log(`[INFO] Updating Notion page for "${title}"...`);

    // Find the page by URL to get its ID
    const pages = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: "URL",
        url: {
          contains: `${id}`,
        },
      },
    });

    if (pages.results.length > 0) {
      const pageId = pages.results[0].id;

      await notion.pages.update({
        page_id: pageId,
        properties: {
          Status: {
            status: { name: notionStatus },
          },
          "Episodes Total": {
            number: num_episodes,
          },
          "Episodes Watched": {
            number: anime.list_status?.num_watched_episodes || 0,
          },
          Genre: {
            multi_select: (genres || []).map((g) => ({ name: g.name })),
          },
          "Sync Status": {
            select: { name: "Synced to MAL" },
          },
          "Last Synced": {
            date: { start: new Date().toISOString().split("T")[0] },
          },
        },
      });

      console.log(`[SUCCESS] Updated page for "${title}"\n`);
    }
  } catch (error) {
    console.error(`[ERROR] Failed to update page:`, error);
    throw error;
  }
}

/**
 * Sanitize anime title for URL
 */
function sanitizeTitle(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

/**
 * Map MAL status to Notion status
 */
function mapMALStatusToNotion(malStatus: string): string {
  const statusMap: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    on_hold: "On Hold",
    dropped: "Dropped",
    plan_to_watch: "Plan to Watch",
  };
  return statusMap[malStatus.toLowerCase()] || "Plan to Watch";
}
