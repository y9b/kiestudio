import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./config.ts";

export const db = new DatabaseSync(path.join(DATA_DIR, "kiestudio.db"));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS generations (
    id            TEXT PRIMARY KEY,
    task_id       TEXT,
    mode          TEXT NOT NULL,
    model         TEXT NOT NULL,
    prompt        TEXT NOT NULL DEFAULT '',
    input         TEXT NOT NULL,
    status        TEXT NOT NULL,
    error         TEXT,
    remote_urls   TEXT NOT NULL DEFAULT '[]',
    local_files   TEXT NOT NULL DEFAULT '[]',
    credits       REAL,
    created_at    INTEGER NOT NULL,
    completed_at  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_generations_created ON generations(created_at DESC);
`);

export type Mode = "t2i" | "i2i" | "t2v" | "i2v";
export type Status = "waiting" | "queuing" | "generating" | "success" | "fail";

export interface GenerationRow {
  id: string;
  task_id: string | null;
  mode: Mode;
  model: string;
  prompt: string;
  input: string;
  status: Status;
  error: string | null;
  remote_urls: string;
  local_files: string;
  credits: number | null;
  created_at: number;
  completed_at: number | null;
}

export interface Generation {
  id: string;
  taskId: string | null;
  mode: Mode;
  model: string;
  prompt: string;
  input: Record<string, unknown>;
  status: Status;
  error: string | null;
  outputs: { url: string; local: boolean }[];
  credits: number | null;
  createdAt: number;
  completedAt: number | null;
}

export function toGeneration(row: GenerationRow): Generation {
  const remote: string[] = JSON.parse(row.remote_urls);
  const local: (string | null)[] = JSON.parse(row.local_files);
  return {
    id: row.id,
    taskId: row.task_id,
    mode: row.mode,
    model: row.model,
    prompt: row.prompt,
    input: JSON.parse(row.input),
    status: row.status,
    error: row.error,
    // Local copies are served by id/index, so the files can live in any folder.
    outputs: remote.map((url, i) =>
      local[i] ? { url: `/media/${row.id}/${i}`, local: true } : { url, local: false },
    ),
    credits: row.credits,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function getGenerationRow(id: string): GenerationRow | undefined {
  return db.prepare("SELECT * FROM generations WHERE id = ?").get(id) as GenerationRow | undefined;
}

export function getSetting(key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string | null) {
  if (value === null) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  else
    db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    ).run(key, value);
}
