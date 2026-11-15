import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { Readable } from "node:stream";
import { HOST, PORT, ROOT_DIR, WEB_DIST } from "./config.ts";
import { resolveStoredFile, storageSettings, StorageError, updateStorage } from "./storage.ts";
import { db, getGenerationRow, setSetting, toGeneration, type GenerationRow, type Mode } from "./db.ts";
import { apiKeySource, getApiKey, kie, KieError, type CatalogModel } from "./kie.ts";
import { startPoller } from "./poller.ts";
import { simplifySchema, type ModelSpec } from "./schema.ts";

const app = new Hono();

app.onError((err, c) => {
  if (err instanceof KieError) {
    const status = (err.code >= 400 && err.code < 600 ? err.code : 502) as ContentfulStatusCode;
    return c.json({ error: err.message, code: err.code }, status);
  }
  console.error(err);
  return c.json({ error: err.message || "Erro interno" }, 500);
});

// ---------- settings ----------

function maskKey(key: string) {
  return key ? `${key.slice(0, 4)}••••${key.slice(-4)}` : null;
}

const settingsPayload = () => ({
  hasKey: Boolean(getApiKey()),
  keySource: apiKeySource(),
  maskedKey: maskKey(getApiKey()),
  storage: storageSettings(),
});

app.get("/api/settings", (c) => c.json(settingsPayload()));

app.put("/api/settings", async (c) => {
  const body = await c.req.json<{
    apiKey?: string | null;
    downloadMedia?: boolean;
    mediaDir?: string | null;
  }>();
  if ("apiKey" in body) {
    if (body.apiKey === null || body.apiKey === "") {
      setSetting("apiKey", null);
    } else if (typeof body.apiKey === "string") {
      const key = body.apiKey.trim();
      await kie.credits(key); // throws a friendly 401 when the key is wrong
      setSetting("apiKey", key);
    }
    catalogCache = null;
  }
  if ("downloadMedia" in body || "mediaDir" in body) {
    try {
      updateStorage(body);
    } catch (err) {
      if (err instanceof StorageError) return c.json({ error: err.message }, 400);
      throw err;
    }
  }
  return c.json(settingsPayload());
});

app.get("/api/credits", async (c) => c.json({ credits: await kie.credits() }));

// ---------- models ----------

const MODE_TASK_TYPES: Record<Mode, string[]> = {
  t2i: ["Text to Image"],
  i2i: ["Image to Image", "Image Editing"],
  t2v: ["Text to Video"],
  i2v: ["Image to Video"],
};

let catalogCache: { at: number; models: CatalogModel[] } | null = null;
const CATALOG_TTL = 60 * 60_000;

async function getCatalog() {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL) return catalogCache.models;
  const data = await kie.catalog();
  catalogCache = { at: Date.now(), models: data.models };
  return data.models;
}

app.get("/api/models", async (c) => {
  const mode = c.req.query("mode") as Mode | undefined;
  const models = await getCatalog();
  const wanted = mode ? MODE_TASK_TYPES[mode] : undefined;
  const list = wanted ? models.filter((m) => m.taskType?.some((t) => wanted.includes(t))) : models;
  return c.json({
    models: list.map((m) => ({
      model: m.model,
      title: m.title,
      provider: m.provider,
      taskType: m.taskType,
      pricing: m.pricingDesc,
    })),
  });
});

// Schemas share a 1 req/s rate limit with the catalog, so cache them for the
// process lifetime and serialise the fetches.
const specCache = new Map<string, ModelSpec>();
let schemaQueue: Promise<unknown> = Promise.resolve();

app.get("/api/models/spec", async (c) => {
  const model = c.req.query("model");
  if (!model) return c.json({ error: "Parâmetro model é obrigatório" }, 400);
  const cached = specCache.get(model);
  if (cached) return c.json(cached);
  const job = schemaQueue.then(async () => {
    const hit = specCache.get(model);
    if (hit) return hit;
    const data = await kie.schema(model);
    const spec = simplifySchema(model, data.openapi);
    specCache.set(model, spec);
    await new Promise((r) => setTimeout(r, 1100));
    return spec;
  });
  schemaQueue = job.catch(() => undefined);
  return c.json(await job);
});

// ---------- uploads ----------

app.post("/api/upload", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "Nenhum arquivo enviado" }, 400);
  if (file.size > 200 * 1024 * 1024) return c.json({ error: "Arquivo maior que 200 MB" }, 413);
  const data = await kie.upload(file);
  return c.json({ url: data.downloadUrl });
});

// ---------- generations ----------

app.get("/api/generations", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 200), 500);
  const rows = db
    .prepare("SELECT * FROM generations ORDER BY created_at DESC LIMIT ?")
    .all(limit) as unknown as GenerationRow[];
  return c.json({ generations: rows.map(toGeneration) });
});

app.post("/api/generations", async (c) => {
  const body = await c.req.json<{ model: string; mode: Mode; input: Record<string, unknown> }>();
  if (!body.model || !body.mode || typeof body.input !== "object") {
    return c.json({ error: "Requisição inválida" }, 400);
  }
  const input = Object.fromEntries(
    Object.entries(body.input).filter(([, v]) => v !== undefined && v !== null && v !== ""),
  );
  const { taskId } = await kie.createTask({ model: body.model, input });
  const id = randomUUID();
  db.prepare(
    "INSERT INTO generations (id, task_id, mode, model, prompt, input, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?)",
  ).run(id, taskId, body.mode, body.model, String(input.prompt ?? ""), JSON.stringify(input), Date.now());
  return c.json(toGeneration(getGenerationRow(id)!), 201);
});

app.delete("/api/generations/:id", (c) => {
  const row = getGenerationRow(c.req.param("id"));
  if (!row) return c.json({ error: "Não encontrado" }, 404);
  for (const file of JSON.parse(row.local_files) as (string | null)[]) {
    if (file) fs.rmSync(resolveStoredFile(file), { force: true });
  }
  db.prepare("DELETE FROM generations WHERE id = ?").run(row.id);
  return c.json({ ok: true });
});

// ---------- static ----------

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
};

// Local copies are looked up through the database, never by a path from the URL.
app.get("/media/:id/:index", (c) => {
  const row = getGenerationRow(c.req.param("id"));
  const ref = row ? (JSON.parse(row.local_files) as (string | null)[])[Number(c.req.param("index"))] : null;
  if (!ref) return c.json({ error: "Arquivo não encontrado" }, 404);
  const file = resolveStoredFile(ref);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return c.json({ error: "O arquivo foi movido ou apagado do disco" }, 404);
  }
  const type = MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
  const range = c.req.header("range")?.match(/bytes=(\d*)-(\d*)/);
  // Byte ranges let the browser seek inside videos.
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    if (start >= stat.size || start > end) {
      return c.body(null, 416, { "Content-Range": `bytes */${stat.size}` });
    }
    const stream = Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream;
    return c.body(stream, 206, {
      "Content-Type": type,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`,
      "Accept-Ranges": "bytes",
    });
  }
  const stream = Readable.toWeb(fs.createReadStream(file)) as ReadableStream;
  return c.body(stream, 200, {
    "Content-Type": type,
    "Content-Length": String(stat.size),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=86400",
    "Content-Disposition": `inline; filename="${path.basename(file)}"`,
  });
});

if (fs.existsSync(WEB_DIST)) {
  const webRoot = path.relative(process.cwd(), WEB_DIST) || ".";
  app.use("/*", serveStatic({ root: webRoot }));
  app.get("*", serveStatic({ root: webRoot, path: "index.html" }));
}

startPoller();

serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  const url = `http://${info.address === "0.0.0.0" ? "localhost" : info.address}:${info.port}`;
  console.log(`\n  kieStudio API  →  ${url}`);
  if (fs.existsSync(WEB_DIST) && process.env.npm_lifecycle_event === "start") console.log(`  kieStudio app  →  ${url}`);
  if (!getApiKey()) {
    console.log(
      `\n  ⚠  KIE_API_KEY não configurada. Crie ${path.join(ROOT_DIR, ".env")} a partir de .env.example`,
    );
    console.log("     ou informe a chave na tela de Configurações do app.\n");
  }
});
