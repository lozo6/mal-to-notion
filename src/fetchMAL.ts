import axios, { AxiosResponse } from "axios";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

const MAL_TOKEN_URL = "https://myanimelist.net/v1/oauth2/token";
const MAL_API_LIST = "https://api.myanimelist.net/v2/users/@me/animelist";

const MAL_CLIENT_ID = process.env.MAL_CLIENT_ID;
let ACCESS_TOKEN = process.env.ACCESS_TOKEN;
let REFRESH_TOKEN = process.env.REFRESH_TOKEN;

if (!MAL_CLIENT_ID || !ACCESS_TOKEN || !REFRESH_TOKEN) {
    console.error("Missing required environment variables: MAL_CLIENT_ID, ACCESS_TOKEN, or REFRESH_TOKEN");
    process.exit(1);
}

interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

interface AnimeNode {
    node: {
        id: number;
        title: string;
        main_picture?: {
            medium: string;
            large: string;
        };
        alternative_titles?: {
            synonyms: string[];
            en?: string;
            ja?: string;
        };
        synopsis: string;
        my_list_status?: {
            status: string;
            score: number;
            num_episodes_watched: number;
            is_rewatching: boolean;
            updated_at: string;
        };
    };
}

interface MyAnimeListResponse {
    data: AnimeNode[];
    paging?: {
        next?: string;
    };
}

async function saveTokensToEnv(access_token: string, refresh_token: string): Promise<void> {
    try {
        let envData = "";

        try {
            await fs.access(".env");
            envData = await fs.readFile(".env", "utf-8");
        } catch {
            envData = "";
        }

        envData = envData
            .split("\n")
            .filter(line => !line.startsWith("ACCESS_TOKEN=") && !line.startsWith("REFRESH_TOKEN="))
            .join("\n");

        envData += `\nACCESS_TOKEN=${access_token}\nREFRESH_TOKEN=${refresh_token}`;

        await fs.writeFile(".env", envData.trim() + "\n", "utf-8");

        ACCESS_TOKEN = access_token;
        REFRESH_TOKEN = refresh_token;
    } catch (error) {
        console.error("Error updating .env:", error);
        throw error;
    }
}

async function refreshAccessToken(): Promise<void> {
    const refresh_token = REFRESH_TOKEN;

    if (!MAL_CLIENT_ID || !refresh_token) {
        console.error("Missing MAL_CLIENT_ID or REFRESH_TOKEN in .env file.");
        return;
    }

    try {
        const params = new URLSearchParams();
        params.append("client_id", MAL_CLIENT_ID);
        params.append("grant_type", "refresh_token");
        params.append("refresh_token", refresh_token);

        const response = await axios.post<TokenResponse>(MAL_TOKEN_URL, params.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const { access_token, refresh_token: new_refresh_token } = response.data;
        await saveTokensToEnv(access_token, new_refresh_token);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Axios Error refreshing token:", error.response?.data || error.message);
        } else {
            console.error("Unknown Error refreshing token:", (error as Error).message);
        }
        throw error;
    }
}

async function fetchAllAnime(access_token: string): Promise<AnimeNode[]> {
    const allAnime: AnimeNode[] = [];
    let nextUrl: string | null = MAL_API_LIST + "?nsfw=true&fields=id,title,main_picture,alternative_titles,synopsis,my_list_status";

    while (nextUrl) {
        const response: AxiosResponse<MyAnimeListResponse> = await axios.get(nextUrl, {
            headers: { Authorization: `Bearer ${access_token}` },
        });

        allAnime.push(...response.data.data);
        nextUrl = response.data.paging?.next || null;
    }

    return allAnime;
}

async function main(): Promise<void> {
    let access_token = ACCESS_TOKEN;

    if (!access_token) {
        console.log("No valid access token found. Attempting to refresh...");
        await refreshAccessToken();
        access_token = ACCESS_TOKEN;
    }

    if (!access_token) {
        console.error("Unable to retrieve access token. Please re-authenticate.");
        return;
    }

    try {
        const allAnime = await fetchAllAnime(access_token);
        await fs.writeFile("data/MyAnimeList.json", JSON.stringify(allAnime, null, 2), "utf-8");
        console.log(`Retrieved ${allAnime.length} anime! Saved to data/MyAnimeList.json.`);
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Axios Error:", error.response?.data || error.message);
        } else {
            console.error("Unknown Error:", (error as Error).message);
        }
    }
}

main();
