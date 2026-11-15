import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebStream } from "node:stream/web";
import { db, type GenerationRow } from "./db.ts";
import { getApiKey, kie } from "./kie.ts";
import { getDownloadMedia, getMediaDir } from "./storage.ts";

const POLL_MS = 3_000;
/** Videos can take a long time; give up on a task after this. */
const TIMEOUT_MS = 60 * 60_000;

const inFlight = new Set<string>();

function extFrom(url: string, contentType: string | null) {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(fromUrl)) return fromUrl;
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/mpeg": ".mp3",
  };
  return map[contentType?.split(";")[0] ?? ""] ?? ".bin";
}

/** Downloads one output into the configured folder and returns its absolute path. */
async function download(url: string, baseName: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10 * 60_000) });
    if (!res.ok || !res.body) return null;
    const dir = getMediaDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, baseName + extFrom(url, res.headers.get("content-type")));
    await pipeline(Readable.fromWeb(res.body as unknown as NodeWebStream), fs.createWriteStream(file));
    return file;
  } catch (err) {
    console.warn(`[poller] download failed for ${url}:`, (err as Error).message);
    return null;
  }
}

async function check(row: GenerationRow) {
  if (!row.task_id) return;
  if (Date.now() - row.created_at > TIMEOUT_MS) {
    db.prepare("UPDATE generations SET status = 'fail', error = ?, completed_at = ? WHERE id = ?").run(
      "Tempo esgotado: a tarefa não terminou em 60 minutos.",
      Date.now(),
      row.id,
    );
    return;
  }
  const info = await kie.recordInfo(row.task_id);
  if (info.state === "success") {
    let urls = info.response?.resultUrls ?? [];
    if (!urls.length && info.resultJson) {
      try {
        urls = JSON.parse(info.resultJson).resultUrls ?? [];
      } catch {
        /* keep empty */
      }
    }
    const local = getDownloadMedia()
      ? await Promise.all(urls.map((u, i) => download(u, `${row.id}-${i}`)))
      : urls.map(() => null);
    db.prepare(
      "UPDATE generations SET status = 'success', remote_urls = ?, local_files = ?, credits = ?, completed_at = ? WHERE id = ?",
    ).run(JSON.stringify(urls), JSON.stringify(local), info.creditsConsumed ?? null, Date.now(), row.id);
  } else if (info.state === "fail") {
    db.prepare("UPDATE generations SET status = 'fail', error = ?, completed_at = ? WHERE id = ?").run(
      info.failMsg || `A geração falhou (${info.failCode ?? "sem código"}).`,
      Date.now(),
      row.id,
    );
  } else if (info.state !== row.status) {
    db.prepare("UPDATE generations SET status = ? WHERE id = ?").run(info.state, row.id);
  }
}

async function tick() {
  if (!getApiKey()) return;
  const pending = db
    .prepare("SELECT * FROM generations WHERE status IN ('waiting','queuing','generating') AND task_id IS NOT NULL")
    .all() as unknown as GenerationRow[];
  await Promise.all(
    pending
      .filter((row) => !inFlight.has(row.id))
      .map(async (row) => {
        inFlight.add(row.id);
        try {
          await check(row);
        } catch (err) {
          // Network blips and rate limits are retried on the next tick.
          console.warn(`[poller] ${row.id}:`, (err as Error).message);
        } finally {
          inFlight.delete(row.id);
        }
      }),
  );
}

export function startPoller() {
  const loop = async () => {
    await tick().catch((err) => console.error("[poller]", err));
    setTimeout(loop, POLL_MS);
  };
  void loop();
}
