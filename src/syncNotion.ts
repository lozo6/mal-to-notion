import { Client } from "@notionhq/client";
import dotenv from "dotenv";
import fs from "fs/promises";

dotenv.config();

if (!process.env.NOTION_API_KEY || !process.env.DATABASE_ID) {
    console.error("Missing required environment variables: NOTION_API_KEY or DATABASE_ID");
    process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.DATABASE_ID;

const statusMapping: Record<string, string> = {
    completed: "Completed",
    plan_to_watch: "Plan to Watch",
    on_hold: "On Hold",
    dropped: "Dropped",
    watching: "Watching"
};

interface Anime {
    node: {
        id: number;
        title: string;
        main_picture: {
            large?: string;
            medium?: string;
        };
        alternative_titles: {
            en?: string;
        };
        synopsis: string;
        genres?: { id: number; name: string }[];
        my_list_status: {
            status: string;
        };
    };
}

function sanitizeTitle(title: string): string {
    return title.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").toLowerCase();
}

async function loadJsonData(): Promise<Anime[]> {
    try {
        const data = await fs.readFile("data/MyAnimeList.json", "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading or parsing JSON file:", error);
        process.exit(1);
    }
}

async function entryExists(id: number, title: string): Promise<boolean> {
    try {
        const animeURL = `https://myanimelist.net/anime/${id}/${title}`;

        const response = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: "URL",
                url: {
                    contains: animeURL,
                },
            },
        });
        return response.results.length > 0;
    } catch (error) {
        console.error("Error checking if entry exists:", error);
        return false;
    }
}

async function addAnimeEntry(anime: Anime) {
    try {
        const { id, title, main_picture, alternative_titles, synopsis, genres, my_list_status } = anime.node;
        const sanitizedTitle = sanitizeTitle(title);
        const animeUrl = `https://myanimelist.net/anime/${id}/${sanitizedTitle}`;

        if (await entryExists(id, sanitizedTitle)) {
            // console.log(`Skipping duplicate: ${title}`);
            return;
        }

        const notionGenres = genres
            ? genres.map((genre) => ({ name: genre.name }))
            : [];

        const notionPage = await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                URL: { url: animeUrl },
                Name: { title: [{ text: { content: title } }] },
                "Alternative Name": {
                    rich_text: alternative_titles.en ? [{ text: { content: alternative_titles.en } }] : [],
                },
                Status: {
                    status: { name: statusMapping[my_list_status.status] || "Plan to Watch" },
                },
                Genre: { multi_select: notionGenres },
            },
            cover: main_picture.large ? {
                type: "external",
                external: { url: main_picture.large },
            } : undefined,
            icon: main_picture.medium ? {
                type: "external",
                external: { url: main_picture.medium },
            } : undefined,
        });

        console.log(`Added: ${title} (${notionPage.id})`);

        await notion.blocks.children.append({
            block_id: notionPage.id,
            children: [
                {
                    object: "block",
                    type: "heading_2",
                    heading_2: { rich_text: [{ text: { content: "Synopsis" } }] },
                },
                {
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{ text: { content: synopsis } }],
                    },
                },
            ],
        });

        console.log(`Added synopsis for: ${title}`);
    } catch (error) {
        console.error(`Error adding anime entry for ${anime.node.title}:`, error);
    }
}

async function main() {
    const jsonData = await loadJsonData();
    await Promise.all(jsonData.map(anime => addAnimeEntry(anime)));
}

// FOR LOOP FUNCTION FOR BACKUP
// async function main() {
//     const jsonData = await loadJsonData();
//     for (const anime of jsonData) {
//         await addAnimeEntry(anime);
//         await new Promise(resolve => setTimeout(resolve, 500));
//     }
// }

main();
