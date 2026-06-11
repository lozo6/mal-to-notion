import axios from "axios";
import * as crypto from "crypto";
import * as readline from "readline";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const MAL_OAUTH_BASE = "https://myanimelist.net/v1/oauth2";

/**
 * Generate PKCE code verifier and challenge
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = verifier; // MAL only supports 'plain' method
  return { verifier, challenge };
}

/**
 * Read user input from terminal
 */
function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Main OAuth flow
 */
async function runOAuthFlow() {
  console.log("[INFO] MyAnimeList OAuth Setup\n");

  const clientId = process.env.MAL_CLIENT_ID;
  if (!clientId) {
    console.error("[ERROR] MAL_CLIENT_ID not found in .env");
    process.exit(1);
  }

  // Step 1: Generate PKCE
  const { verifier, challenge } = generatePKCE();
  console.log("[SUCCESS] Generated PKCE verifier and challenge\n");

  // Step 2: Create authorization URL
  const state = crypto.randomBytes(16).toString("hex");
  const authURL = new URL(`${MAL_OAUTH_BASE}/authorize`);
  authURL.searchParams.append("response_type", "code");
  authURL.searchParams.append("client_id", clientId);
  authURL.searchParams.append("state", state);
  authURL.searchParams.append("code_challenge", challenge);
  authURL.searchParams.append("code_challenge_method", "plain");

  console.log(
    "[INFO] Open this URL in your browser and authorize the application:\n",
  );
  console.log(authURL.toString());
  console.log(
    "\n[WARNING] After you authorize, you'll be redirected. Copy the 'code' parameter from the URL.\n",
  );

  // Step 3: Get authorization code from user
  const authCode = await promptUser(
    "[INPUT] Paste the authorization code here (the 'code' parameter from the redirect URL): ",
  );

  if (!authCode) {
    console.error("[ERROR] Authorization code is required");
    process.exit(1);
  }

  // Step 4: Exchange code for tokens
  try {
    console.log("\n[INFO] Exchanging authorization code for tokens...\n");

    const params = new URLSearchParams();
    params.append("client_id", clientId);
    params.append("grant_type", "authorization_code");
    params.append("code", authCode);
    params.append("code_verifier", verifier);

    // If you have a client secret, add it
    if (process.env.MAL_CLIENT_SECRET) {
      params.append("client_secret", process.env.MAL_CLIENT_SECRET);
    }

    const response = await axios.post(`${MAL_OAUTH_BASE}/token`, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const { access_token, refresh_token, expires_in } = response.data;

    console.log("[SUCCESS] Successfully obtained tokens!\n");
    console.log(
      `[INFO] Access Token Expires In: ${expires_in} seconds (${Math.ceil(expires_in / 3600)} hours)\n`,
    );

    // Step 5: Update .env file
    let envContent = fs.readFileSync(".env", "utf-8");
    envContent = envContent.replace(
      /MAL_REFRESH_TOKEN=.*/,
      `MAL_REFRESH_TOKEN=${refresh_token}`,
    );

    fs.writeFileSync(".env", envContent);
    console.log("[SUCCESS] Updated .env file with refresh token\n");

    console.log("[DONE] OAuth setup complete!");
    console.log("\nYou're ready to:");
    console.log("  1. Test locally: npm run test");
    console.log("  2. Deploy to Vercel: git push");
    console.log("  3. Set up Notion automation pointing to your webhook\n");
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("[ERROR] Error exchanging code for tokens:");
      console.error(error.response?.data);
    } else {
      console.error("[ERROR] Unexpected error:", error);
    }
    process.exit(1);
  }
}

// Run the OAuth flow
runOAuthFlow();
