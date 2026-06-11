import dotenv from "dotenv";
import { NotionWebhookPayload, NotionToMALStatusMap } from "../src/types";
import * as notionApi from "../src/notion-api";
import * as malApi from "../src/mal-api";

dotenv.config();

/**
 * Simulate a Notion webhook payload for testing
 */
function createTestPayload(
  overrides?: Partial<NotionWebhookPayload>,
): NotionWebhookPayload {
  const defaultPayload: NotionWebhookPayload = {
    object: "page",
    id: "test-page-id-12345",
    created_time: new Date().toISOString(),
    last_edited_time: new Date().toISOString(),
    created_by: { object: "user", id: "user-123" },
    last_edited_by: { object: "user", id: "user-123" },
    cover: null,
    icon: null,
    parent: {
      type: "database_id",
      database_id: process.env.NOTION_DATABASE_ID || "db-123",
    },
    archived: false,
    properties: {
      Name: {
        id: "title",
        title: [{ text: { content: "Jujutsu Kaisen" } }],
      },
      URL: {
        id: "url",
        url: "https://myanimelist.net/anime/14514/Jujutsu_Kaisen",
      },
      Status: {
        id: "status",
        status: { name: "Watching" },
      },
      "Episodes Watched": {
        id: "episodes_watched",
        number: 5,
      },
      "Episodes Total": {
        id: "episodes_total",
        number: 24,
      },
      Genre: {
        id: "genre",
        multi_select: [
          { id: "1", name: "Action" },
          { id: "2", name: "Supernatural" },
        ],
      },
      "Sync Status": {
        id: "sync_status",
        select: { name: "Pending" },
      },
      "Last Synced": {
        id: "last_synced",
        date: null,
      },
      "Sync Error Message": {
        id: "error_message",
        rich_text: [],
      },
    },
    url: "https://www.notion.so/test-page",
  };

  return { ...defaultPayload, ...overrides } as NotionWebhookPayload;
}

/**
 * Main webhook handler logic (copied from api/sync-mal.ts for testing)
 */
async function handleWebhook(payload: NotionWebhookPayload): Promise<void> {
  try {
    console.log(`\n[INFO] Processing webhook for page: ${payload.id}\n`);

    // Extract data from Notion page
    const title = notionApi.extractTitle(payload as any);
    const status = notionApi.extractStatus(payload as any);
    const episodesWatched = notionApi.extractEpisodesWatched(payload as any);
    const malUrl = payload.properties.URL?.url;
    const animeId = notionApi.extractAnimeIdFromURL(malUrl || null);

    console.log(`[INFO] Anime: ${title}`);
    console.log(`[INFO] Status: ${status}`);
    console.log(`[INFO] Episodes Watched: ${episodesWatched}`);
    console.log(`[INFO] MAL Anime ID: ${animeId}\n`);

    // Validate required data
    if (!title) {
      throw new Error("Anime title is missing");
    }

    if (!status) {
      throw new Error("Status is missing");
    }

    // Get anime ID from URL or search
    let malAnimeId = animeId;
    if (!malAnimeId) {
      console.log(`[INFO] Searching for anime: ${title}`);
      malAnimeId = await malApi.searchAnimeOnMAL(title);

      if (!malAnimeId) {
        throw new Error(`Anime "${title}" not found on MAL`);
      }
    }

    // Convert Notion status to MAL status
    const malStatus = NotionToMALStatusMap[status];
    if (!malStatus) {
      throw new Error(`Invalid status: ${status}`);
    }

    // Prepare MAL update payload
    const malUpdatePayload = {
      status: malStatus,
      num_watched_episodes: episodesWatched || undefined,
    };

    console.log(`\n[INFO] Updating MAL with:`);
    console.log(`[INFO] Status: ${malStatus}`);
    console.log(`[INFO] Episodes Watched: ${episodesWatched || "not set"}\n`);

    // Update on MAL
    await malApi.updateAnimeOnMAL(malAnimeId, malUpdatePayload);

    console.log(`[SUCCESS] Successfully synced to MAL!\n`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`\n[ERROR] ${errorMessage}\n`);
  }
}

/**
 * Run test scenarios
 */
async function runTests() {
  console.log("[INFO] Testing Notion to MAL Webhook\n");
  console.log("=" + "=".repeat(49) + "\n");

  try {
    // Refresh token first
    console.log("[INFO] Refreshing MAL token...\n");
    await malApi.refreshMALToken();

    // Test 1: Basic status update
    console.log("[TEST] Test 1: Basic Status Update");
    console.log("-".repeat(50));
    const testPayload1 = createTestPayload({
      properties: {
        Name: {
          id: "title",
          title: [{ text: { content: "Attack on Titan" } }],
        },
        Status: {
          id: "status",
          status: { name: "Watching" },
        },
        "Episodes Watched": {
          id: "episodes_watched",
          number: 10,
        },
      },
    });
    await handleWebhook(testPayload1);

    console.log("=" + "=".repeat(49) + "\n");

    // Test 2: Status and episodes update
    console.log("[TEST] Test 2: Status + Episodes Update");
    console.log("-".repeat(50));
    const testPayload2 = createTestPayload({
      properties: {
        Name: {
          id: "title",
          title: [{ text: { content: "One Piece" } }],
        },
        Status: {
          id: "status",
          status: { name: "Watching" },
        },
        "Episodes Watched": {
          id: "episodes_watched",
          number: 150,
        },
      },
    });
    await handleWebhook(testPayload2);

    console.log("=" + "=".repeat(49) + "\n");

    // Test 3: Mark as completed
    console.log("[TEST] Test 3: Mark as Completed");
    console.log("-".repeat(50));
    const testPayload3 = createTestPayload({
      properties: {
        Name: {
          id: "title",
          title: [{ text: { content: "Death Note" } }],
        },
        Status: {
          id: "status",
          status: { name: "Completed" },
        },
        "Episodes Watched": {
          id: "episodes_watched",
          number: 37,
        },
      },
    });
    await handleWebhook(testPayload3);

    console.log("=" + "=".repeat(49) + "\n");
    console.log("[DONE] All tests completed!\n");
  } catch (error) {
    console.error("[ERROR] Test failed:", error);
    process.exit(1);
  }
}

// Run tests
runTests();
