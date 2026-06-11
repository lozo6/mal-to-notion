import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import { NotionWebhookPayload } from "../src/types";
import * as notionApi from "../src/notion-api";
import * as malApi from "../src/mal-api";

dotenv.config();

interface MALAnimeDetails {
  id: number;
  title: string;
  num_episodes: number;
  genres: Array<{ id: number; name: string }>;
  my_list_status?: {
    status: string;
    num_watched_episodes: number;
    score: number;
  };
}

/**
 * Sync anime FROM MAL back to Notion
 * Fetches latest data from MAL and updates the Notion page
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Validate webhook secret
    const webhookSecret = req.headers["x-webhook-secret"];
    if (
      process.env.WEBHOOK_SECRET &&
      webhookSecret !== process.env.WEBHOOK_SECRET
    ) {
      console.warn("[WARNING] Invalid webhook secret attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    const payload = req.body as NotionWebhookPayload;

    console.log(`[INFO] Syncing FROM MAL for page: ${payload.id}`);

    // Extract anime ID from URL
    const malUrl = payload.properties.URL?.url;
    const animeId = notionApi.extractAnimeIdFromURL(malUrl || null);

    if (!animeId) {
      throw new Error(
        "Cannot find anime ID - MAL URL is missing from Notion page",
      );
    }

    console.log(`[INFO] Anime ID: ${animeId}\n`);

    // Update sync status to "Pending"
    await notionApi.updateNotionPageSyncStatus(payload.id, "Pending");

    // Fetch anime details from MAL
    console.log(`[INFO] Fetching anime details from MAL...\n`);
    const animeDetails = await malApi.getAnimeDetailsFromMAL(animeId);

    if (!animeDetails) {
      throw new Error(`Anime ${animeId} not found on MAL`);
    }

    console.log(`[INFO] Anime: ${animeDetails.title}`);
    console.log(`[INFO] Episodes: ${animeDetails.num_episodes}`);
    console.log(
      `[INFO] Genres: ${animeDetails.genres.map((g: any) => g.name).join(", ")}\n`,
    );

    // Prepare Notion update payload
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

    // If user has this anime on their MAL list, sync status and episodes watched
    if (animeDetails.my_list_status) {
      const malStatus = animeDetails.my_list_status.status;
      const notionStatus = malStatusToNotionStatus(malStatus);

      updatePayload.properties.Status = {
        status: { name: notionStatus },
      };

      updatePayload.properties["Episodes Watched"] = {
        number: animeDetails.my_list_status.num_watched_episodes,
      };

      console.log(`[SUCCESS] Synced from MAL:`);
      console.log(`[INFO] Status: ${notionStatus}`);
      console.log(
        `[INFO] Episodes Watched: ${animeDetails.my_list_status.num_watched_episodes}\n`,
      );
    } else {
      console.log(
        `[WARNING] Anime not on your MAL list yet (status not synced)\n`,
      );
    }

    // Update Notion page
    await notionApi.updateNotionPageProperties(payload.id, updatePayload);

    // Update sync status to success
    await notionApi.updateNotionPageSyncStatus(payload.id, "Synced to MAL");

    console.log(
      `[SUCCESS] Successfully synced "${animeDetails.title}" FROM MAL to Notion!\n`,
    );

    return res.status(200).json({
      success: true,
      message: `Synced "${animeDetails.title}" from MAL`,
      animeId: animeId,
      title: animeDetails.title,
      episodes: animeDetails.num_episodes,
      genres: animeDetails.genres.map((g: any) => g.name),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[ERROR] Sync error: ${errorMessage}\n`);

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
