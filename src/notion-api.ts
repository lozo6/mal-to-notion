import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import { NotionPagePayload, SyncStatus } from "./types";

dotenv.config();

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID!;

/**
 * Get page details from Notion
 */
export async function getNotionPage(
  pageId: string,
): Promise<NotionPagePayload> {
  try {
    const response = await notion.pages.retrieve({ page_id: pageId });
    return response as NotionPagePayload;
  } catch (error) {
    console.error("[ERROR] Error retrieving Notion page:", error);
    throw error;
  }
}

/**
 * Update Notion page properties
 */
export async function updateNotionPageProperties(
  pageId: string,
  updatePayload: any,
): Promise<void> {
  try {
    await notion.pages.update({
      page_id: pageId,
      ...updatePayload,
    });

    console.log(`[SUCCESS] Updated Notion page properties: ${pageId}`);
  } catch (error) {
    console.error("[ERROR] Error updating Notion page properties:", error);
    throw error;
  }
}

/**
 * Update Notion page with sync status
 */
export async function updateNotionPageSyncStatus(
  pageId: string,
  status: SyncStatus,
  errorMessage?: string,
): Promise<void> {
  try {
    const updatePayload: any = {
      properties: {
        "Sync Status": {
          select: { name: status },
        },
        "Last Synced": {
          date: { start: new Date().toISOString().split("T")[0] },
        },
      },
    };

    // If there's an error, add it to the error message field
    if (errorMessage) {
      updatePayload.properties["Sync Error Message"] = {
        rich_text: [{ text: { content: errorMessage } }],
      };
    } else {
      // Clear error message on success
      updatePayload.properties["Sync Error Message"] = {
        rich_text: [],
      };
    }

    await notion.pages.update({
      page_id: pageId,
      ...updatePayload,
    });

    console.log(`[SUCCESS] Updated Notion page ${pageId} - Status: ${status}`);
  } catch (error) {
    console.error("[ERROR] Error updating Notion page sync status:", error);
    throw error;
  }
}

/**
 * Extract anime title from Notion page
 */
export function extractTitle(page: NotionPagePayload): string {
  const titleBlock = page.properties.Name?.title;
  if (titleBlock && titleBlock.length > 0) {
    return titleBlock[0].text.content;
  }
  return "";
}

/**
 * Extract status from Notion page
 */
export function extractStatus(page: NotionPagePayload): string | null {
  return page.properties.Status?.status?.name || null;
}

/**
 * Extract episodes watched from Notion page
 */
export function extractEpisodesWatched(page: NotionPagePayload): number | null {
  return page.properties["Episodes Watched"]?.number || null;
}

/**
 * Extract episodes total from Notion page
 */
export function extractEpisodesTotal(page: NotionPagePayload): number | null {
  return page.properties["Episodes Total"]?.number || null;
}

/**
 * Extract MAL URL from Notion page to get anime ID
 */
export function extractAnimeIdFromURL(url: string | null): number | null {
  if (!url) return null;
  const match = url.match(/\/anime\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Check if a property changed that we care about (Status or Episodes Watched)
 */
export function didRelevantPropertyChange(
  oldPage: NotionPagePayload | null,
  newPage: NotionPagePayload,
): boolean {
  if (!oldPage) return true; // First sync, always relevant

  const oldStatus = extractStatus(oldPage);
  const newStatus = extractStatus(newPage);

  const oldEpisodes = extractEpisodesWatched(oldPage);
  const newEpisodes = extractEpisodesWatched(newPage);

  return oldStatus !== newStatus || oldEpisodes !== newEpisodes;
}
