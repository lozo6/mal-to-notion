import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import { NotionWebhookPayload, NotionToMALStatusMap } from "../src/types";
import * as notionApi from "../src/notion-api";
import * as malApi from "../src/mal-api";

dotenv.config();

/**
 * Webhook handler for Notion → MAL sync
 * Called when a page property changes in your anime database
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate webhook secret if provided
    const webhookSecret = req.headers["x-webhook-secret"];
    if (
      process.env.WEBHOOK_SECRET &&
      webhookSecret !== process.env.WEBHOOK_SECRET
    ) {
      console.warn("[WARNING] Invalid webhook secret attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as NotionWebhookPayload;

    console.log(`[INFO] Received webhook for page: ${payload.id}`);
    console.log(`[INFO] Last edited: ${payload.last_edited_time}\n`);

    // Extract data from Notion page
    const title = notionApi.extractTitle(payload as any);
    const status = notionApi.extractStatus(payload as any);
    const episodesWatched = notionApi.extractEpisodesWatched(payload as any);
    const malUrl = payload.properties.URL?.url;
    const animeId = notionApi.extractAnimeIdFromURL(malUrl || null);

    console.log(`[INFO] Anime: ${title}`);
    console.log(`[INFO] Status: ${status}`);
    console.log(`[INFO] Episodes: ${episodesWatched}\n`);

    // Update sync status to "Pending"
    await notionApi.updateNotionPageSyncStatus(payload.id, "Pending");

    // Validate required data
    if (!title) {
      throw new Error("Anime title is missing from Notion page");
    }

    if (!status) {
      throw new Error("Status field is missing from Notion page");
    }

    // Get anime ID from URL or search
    let malAnimeId = animeId;
    if (!malAnimeId) {
      console.log(`[INFO] Searching for anime: ${title}\n`);
      malAnimeId = await malApi.searchAnimeOnMAL(title);

      if (!malAnimeId) {
        throw new Error(`Anime "${title}" not found on MyAnimeList`);
      }

      console.log(`[SUCCESS] Found anime ID: ${malAnimeId}\n`);
    }

    // Convert Notion status to MAL status
    const malStatus = NotionToMALStatusMap[status];
    if (!malStatus) {
      throw new Error(
        `Invalid status "${status}". Must be one of: Plan to Watch, Watching, Completed, On Hold, Dropped`,
      );
    }

    // Check if anime exists on MAL user's list, then update or add
    const animeExists = await malApi.getAnimeInfoFromMAL(malAnimeId);

    const malUpdatePayload = {
      status: malStatus,
      num_watched_episodes: episodesWatched || undefined,
    };

    console.log(`[INFO] Syncing to MAL (ID: ${malAnimeId}):`);
    console.log(`[INFO] Status: ${malStatus}`);
    console.log(`[INFO] Episodes: ${episodesWatched || "unchanged"}\n`);

    // Update on MAL
    await malApi.updateAnimeOnMAL(malAnimeId, malUpdatePayload);

    // Update Notion with success status
    await notionApi.updateNotionPageSyncStatus(payload.id, "Synced to MAL");

    console.log(`[SUCCESS] Successfully synced "${title}" to MyAnimeList!\n`);

    return res.status(200).json({
      success: true,
      message: `Synced "${title}" to MAL`,
      animeId: malAnimeId,
      status: malStatus,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Webhook error: ${errorMessage}\n`);

    // Try to update Notion with error status
    try {
      const pageId = (req.body as NotionWebhookPayload)?.id;
      if (pageId) {
        await notionApi.updateNotionPageSyncStatus(
          pageId,
          "Error",
          errorMessage,
        );
      }
    } catch (notionError) {
      console.error(
        "[ERROR] Failed to update Notion error status:",
        notionError,
      );
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};
