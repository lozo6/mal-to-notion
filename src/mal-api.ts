import axios from "axios";
import dotenv from "dotenv";
import { MALTokenResponse, MALAnimeStatus, MALSearchResult } from "./types";

dotenv.config();

const MAL_API_BASE = "https://api.myanimelist.net/v2";
const MAL_OAUTH_BASE = "https://myanimelist.net/v1/oauth2";

let currentAccessToken = process.env.MAL_REFRESH_TOKEN || "";

/**
 * Refresh the MAL access token using the refresh token
 */
export async function refreshMALToken(): Promise<string> {
  try {
    const params = new URLSearchParams();
    params.append("client_id", process.env.MAL_CLIENT_ID!);
    params.append("grant_type", "refresh_token");
    params.append("refresh_token", process.env.MAL_REFRESH_TOKEN!);

    // If you have a client secret, add it
    if (process.env.MAL_CLIENT_SECRET) {
      params.append("client_secret", process.env.MAL_CLIENT_SECRET);
    }

    const response = await axios.post<MALTokenResponse>(
      `${MAL_OAUTH_BASE}/token`,
      params,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    currentAccessToken = response.data.access_token;
    console.log("[SUCCESS] MAL token refreshed successfully");
    return currentAccessToken;
  } catch (error) {
    console.error("[ERROR] Failed to refresh MAL token:", error);
    throw new Error("Token refresh failed");
  }
}

/**
 * Search for an anime on MAL by title
 */
export async function searchAnimeOnMAL(title: string): Promise<number | null> {
  try {
    const response = await axios.get<MALSearchResult>(`${MAL_API_BASE}/anime`, {
      params: { query: title, limit: 1 },
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });

    if (response.data.data.length > 0) {
      return response.data.data[0].node.id;
    }
    return null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired, refresh and retry
      await refreshMALToken();
      return searchAnimeOnMAL(title);
    }
    console.error("[ERROR] Error searching anime on MAL:", error);
    return null;
  }
}

/**
 * Get detailed anime info from MAL (including user's list status)
 */
export async function getAnimeDetailsFromMAL(
  animeId: number,
): Promise<any | null> {
  try {
    const response = await axios.get(`${MAL_API_BASE}/anime/${animeId}`, {
      params: {
        fields: "title,num_episodes,genres,my_list_status",
      },
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired, refresh and retry
      await refreshMALToken();
      return getAnimeDetailsFromMAL(animeId);
    }
    console.error("[ERROR] Error fetching anime details from MAL:", error);
    return null;
  }
}

/**
 * Update anime status on MAL
 */
export async function updateAnimeOnMAL(
  animeId: number,
  status: MALAnimeStatus,
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append("status", status.status);

    if (status.num_watched_episodes !== undefined) {
      params.append(
        "num_watched_episodes",
        status.num_watched_episodes.toString(),
      );
    }

    await axios.put(`${MAL_API_BASE}/anime/${animeId}/my_list_status`, params, {
      headers: {
        Authorization: `Bearer ${currentAccessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log(`[SUCCESS] Updated anime ${animeId} on MAL`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired, refresh and retry
      await refreshMALToken();
      return updateAnimeOnMAL(animeId, status);
    }
    console.error("[ERROR] Error updating anime on MAL:", error);
    throw error;
  }
}

/**
 * Add anime to MAL list
 */
export async function addAnimeToMAL(
  animeId: number,
  status: MALAnimeStatus,
): Promise<boolean> {
  try {
    const params = new URLSearchParams();
    params.append("status", status.status);

    if (status.num_watched_episodes !== undefined) {
      params.append(
        "num_watched_episodes",
        status.num_watched_episodes.toString(),
      );
    }

    await axios.post(
      `${MAL_API_BASE}/anime/${animeId}/my_list_status`,
      params,
      {
        headers: {
          Authorization: `Bearer ${currentAccessToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      },
    );

    console.log(`[SUCCESS] Added anime ${animeId} to MAL`);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token expired, refresh and retry
      await refreshMALToken();
      return addAnimeToMAL(animeId, status);
    }
    console.error("[ERROR] Error adding anime to MAL:", error);
    throw error;
  }
}

/**
 * Get anime info from MAL (to check if it exists)
 */
export async function getAnimeInfoFromMAL(animeId: number): Promise<boolean> {
  try {
    await axios.get(`${MAL_API_BASE}/anime/${animeId}`, {
      headers: { Authorization: `Bearer ${currentAccessToken}` },
    });
    return true;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      await refreshMALToken();
      return getAnimeInfoFromMAL(animeId);
    }
    return false;
  }
}
