// MAL API Types
export interface MALTokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

export interface MALAnimeStatus {
  status: "watching" | "completed" | "on_hold" | "dropped" | "plan_to_watch";
  score?: number;
  num_watched_episodes?: number;
  num_episodes?: number;
}

export interface MALSearchResult {
  data: {
    node: {
      id: number;
      title: string;
      main_picture?: {
        large?: string;
        medium?: string;
      };
    };
  }[];
}

// Notion Types
export interface NotionPagePayload {
  id: string;
  properties: {
    Name?: { title: Array<{ text: { content: string } }> };
    Status?: { status: { name: string } };
    "Episodes Watched"?: { number: number | null };
    "Episodes Total"?: { number: number | null };
    URL?: { url: string };
    Genre?: { multi_select: Array<{ name: string }> };
    "Sync Status"?: { select: { name: string } };
  };
}

// Webhook Payload from Notion
export interface NotionWebhookPayload {
  object: string;
  id: string;
  created_time: string;
  last_edited_time: string;
  created_by: { object: string; id: string };
  last_edited_by: { object: string; id: string };
  cover: null | object;
  icon: null | object;
  parent: {
    type: string;
    database_id: string;
  };
  archived: boolean;
  properties: {
    Name?: { id: string; title: Array<{ text: { content: string } }> };
    URL?: { id: string; url: string | null };
    Status?: { id: string; status: { name: string } | null };
    "Episodes Watched"?: { id: string; number: number | null };
    "Episodes Total"?: { id: string; number: number | null };
    Genre?: { id: string; multi_select: Array<{ id: string; name: string }> };
    "Sync Status"?: { id: string; select: { name: string } | null };
    "Last Synced"?: { id: string; date: { start: string } | null };
    "Sync Error Message"?: {
      id: string;
      rich_text: Array<{ text: { content: string } }>;
    };
  };
  url: string;
}

// Sync Status Type
export type SyncStatus = "Synced to MAL" | "Pending" | "Error";

// MAL Status Mapping
export const NotionToMALStatusMap: Record<string, MALAnimeStatus["status"]> = {
  "Plan to Watch": "plan_to_watch",
  Watching: "watching",
  Completed: "completed",
  "On Hold": "on_hold",
  Dropped: "dropped",
};

export const MALToNotionStatusMap: Record<MALAnimeStatus["status"], string> = {
  plan_to_watch: "Plan to Watch",
  watching: "Watching",
  completed: "Completed",
  on_hold: "On Hold",
  dropped: "Dropped",
};
