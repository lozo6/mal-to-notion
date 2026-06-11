import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import { Client } from "@notionhq/client";
import * as notionApi from "../src/notion-api";
import * as malApi from "../src/mal-api";

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

interface NotionPage {
  id: string;
  properties: any;
}

/**
 * Sync all anime from MAL to Notion
 * Runs as a scheduled cron job every 2 weeks
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    console.log("[INFO] Starting scheduled MAL to Notion sync...\n");

    // Refresh token first
    await malApi.refreshMALToken();

    // Fetch all pages from Notion database
    console.log("[INFO] Fetching all anime from Notion database...\n");
    const allPages = await fetchAllPages();

    if (allPages.length === 0) {
      console.log("[WARNING] No pages found in database");
      return res.status(200).json({
        success: true,
        message: "No pages to sync",
        synced: 0,
        failed: 0,
      });
    }

    console.log(`[INFO] Found ${allPages.length} anime to sync\n`);

    let synced = 0;
    let failed = 0;

    // Sync each anime
    for (const page of allPages) {
      try {
        await syncAnimeFromMAL(page);
        synced++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Failed to sync page ${page.id}: ${errorMsg}`);
        failed++;
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`\n[SUCCESS] Sync complete!`);
    console.log(`[INFO] Synced: ${synced}, Failed: ${failed}\n`);

    return res.status(200).json({
      success: true,
      message: "Scheduled sync completed",
      synced,
      failed,
      total: allPages.length,
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
 * Fetch all pages from the Notion database with pagination
 */
async function fetchAllPages(): Promise<NotionPage[]> {
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
          properties: page.properties,
        })),
      );

      hasMore = response.has_more;
      startCursor = response.next_cursor || undefined;
    } catch (error) {
      console.error("[ERROR] Error fetching pages:", error);
      throw error;
    }
  }

  return allPages;
}

/**
 * Sync a single anime from MAL to Notion
 */
async function syncAnimeFromMAL(page: NotionPage): Promise<void> {
  try {
    // Extract data
    const title = extractTitle(page);
    const malUrl = extractURL(page);
    const animeId = notionApi.extractAnimeIdFromURL(malUrl || null);

    if (!animeId) {
      console.log(`[WARNING] Skipping "${title}" - no MAL URL`);
      return;
    }

    console.log(`[INFO] Syncing "${title}" (ID: ${animeId})...`);

    // Fetch anime details from MAL
    const animeDetails = await malApi.getAnimeDetailsFromMAL(animeId);

    if (!animeDetails) {
      throw new Error(`Anime ${animeId} not found on MAL`);
    }

    // Prepare update payload
    const updatePayload: any = {
      properties: {
        "Episodes Total": {
          number: animeDetails.num_episodes,
        },
        Genre: {
          multi_select: animeDetails.genres.map((genre: any) => ({
            name: genre.name,
          })),
        },
      },
    };

    // If anime is on user's MAL list, sync status and episodes
    if (animeDetails.my_list_status) {
      const malStatus = animeDetails.my_list_status.status;
      const notionStatus = malStatusToNotionStatus(malStatus);

      updatePayload.properties.Status = {
        status: { name: notionStatus },
      };

      updatePayload.properties["Episodes Watched"] = {
        number: animeDetails.my_list_status.num_watched_episodes,
      };

      console.log(
        `[INFO] Updated: Status=${notionStatus}, Episodes=${animeDetails.my_list_status.num_watched_episodes}/${animeDetails.num_episodes}`,
      );
    } else {
      console.log(
        `[INFO] Updated: Episodes Total=${animeDetails.num_episodes}, Genres synced`,
      );
    }

    // Update Notion page
    await notion.pages.update({
      page_id: page.id,
      ...updatePayload,
    });

    // Update sync status
    await notion.pages.update({
      page_id: page.id,
      properties: {
        "Sync Status": {
          select: { name: "Synced to MAL" },
        },
        "Last Synced": {
          date: { start: new Date().toISOString().split("T")[0] },
        },
        "Sync Error Message": {
          rich_text: [],
        },
      },
    });

    console.log(`[SUCCESS] Synced "${title}"\n`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Sync failed: ${errorMsg}\n`);

    // Try to update error status in Notion
    try {
      await notion.pages.update({
        page_id: page.id,
        properties: {
          "Sync Status": {
            select: { name: "Error" },
          },
          "Sync Error Message": {
            rich_text: [{ text: { content: errorMsg } }],
          },
        },
      });
    } catch (updateError) {
      console.error("[ERROR] Failed to update error status:", updateError);
    }

    throw error;
  }
}

/**
 * Extract title from Notion page
 */
function extractTitle(page: NotionPage): string {
  const titleBlock = page.properties.Name?.title;
  if (titleBlock && titleBlock.length > 0) {
    return titleBlock[0].text.content;
  }
  return "Unknown Anime";
}

/**
 * Extract URL from Notion page
 */
function extractURL(page: NotionPage): string | null {
  return page.properties.URL?.url || null;
}

/**
 * Convert MAL status to Notion status
 */
function malStatusToNotionStatus(malStatus: string): string {
  const statusMap: Record<string, string> = {
    watching: "Watching",
    completed: "Completed",
    on_hold: "On Hold",
    dropped: "Dropped",
    plan_to_watch: "Plan to Watch",
  };
  return statusMap[malStatus.toLowerCase()] || "Plan to Watch";
}
