import { VercelRequest, VercelResponse } from "@vercel/node";
import dotenv from "dotenv";
import * as malApi from "../src/mal-api";

dotenv.config();

export default async (req: VercelRequest, res: VercelResponse) => {
  try {
    console.log("[INFO] Running scheduled token refresh...");
    await malApi.refreshMALToken();
    console.log("[SUCCESS] Token refreshed");
    return res.status(200).json({ success: true, message: "Token refreshed" });
  } catch (error) {
    console.error("[ERROR] Token refresh failed:", error);
    return res.status(500).json({ success: false, error: String(error) });
  }
};
