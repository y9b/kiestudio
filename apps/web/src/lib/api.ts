import { translate } from "@/i18n";

export type Mode = "t2i" | "i2i" | "t2v" | "i2v";
export type Status = "waiting" | "queuing" | "generating" | "success" | "fail";

export interface CatalogModel {
  model: string;
  title: string;
  provider: string;
  taskType: string[];
  pricing: string | null;
}

export type FieldKind = "prompt" | "text" | "number" | "boolean" | "enum" | "file" | "files" | "list";

export interface ModelField {
  name: string;
  kind: FieldKind;
  label: string;
  description: string;
  required: boolean;
  default?: unknown;
  options?: (string | number)[];
  min?: number;
  max?: number;
  integer?: boolean;
  maxItems?: number;
  maxLength?: number;
  accept?: "image" | "video" | "audio";
}

export interface ModelSpec {
  model: string;
  supported: boolean;
  reason?: string;
  fields: ModelField[];
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

export interface StorageSettings {
  downloadMedia: boolean;
  mediaDir: string;
  defaultMediaDir: string;
}

export interface Settings {
  hasKey: boolean;
  keySource: "settings" | "env" | null;
  maskedKey: string | null;
  storage: StorageSettings;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(translate("error.server"), 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Erro ${res.status}`, res.status);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

export const api = {
  settings: () => http<Settings>("/api/settings"),
  saveApiKey: (apiKey: string | null) => http<Settings>("/api/settings", json("PUT", { apiKey })),
  saveStorage: (data: { downloadMedia?: boolean; mediaDir?: string | null }) =>
    http<Settings>("/api/settings", json("PUT", data)),
  credits: () => http<{ credits: number }>("/api/credits"),
  models: (mode: Mode) => http<{ models: CatalogModel[] }>(`/api/models?mode=${mode}`).then((r) => r.models),
  spec: (model: string) => http<ModelSpec>(`/api/models/spec?model=${encodeURIComponent(model)}`),
  generations: () => http<{ generations: Generation[] }>("/api/generations").then((r) => r.generations),
  generate: (data: { mode: Mode; model: string; input: Record<string, unknown> }) =>
    http<Generation>("/api/generations", json("POST", data)),
  remove: (id: string) => http<{ ok: true }>(`/api/generations/${id}`, { method: "DELETE" }),
  upload: async (file: File) => {
    const form = new FormData();
    form.set("file", file);
    return http<{ url: string }>("/api/upload", { method: "POST", body: form });
  },
};

export const isPending = (s: Status) => s === "waiting" || s === "queuing" || s === "generating";
