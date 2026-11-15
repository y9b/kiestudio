import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "../../..");

// Load the repo-root .env (Node >= 22 ships a built-in loader).
const envFile = path.join(ROOT_DIR, ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const PORT = Number(process.env.PORT ?? 8787);
export const HOST = process.env.HOST ?? "127.0.0.1";
export const DATA_DIR = path.resolve(ROOT_DIR, process.env.DATA_DIR ?? "data");
export const MEDIA_DIR = path.join(DATA_DIR, "media");
export const WEB_DIST = path.join(ROOT_DIR, "apps/web/dist");
export const ENV_API_KEY = process.env.KIE_API_KEY?.trim() || "";

/** Whether finished outputs are copied to disk (KIE deletes them after 14 days). */
export const DOWNLOAD_MEDIA = process.env.DOWNLOAD_MEDIA !== "false";

fs.mkdirSync(MEDIA_DIR, { recursive: true });
