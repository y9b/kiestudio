import { ENV_API_KEY } from "./config.ts";
import { getSetting } from "./db.ts";

const API = "https://api.kie.ai";
const UPLOAD_API = "https://kieai.redpandaai.co";

/** A key saved from the Settings screen wins over the .env value. */
export function getApiKey(): string {
  return getSetting("apiKey") || ENV_API_KEY;
}

export function apiKeySource(): "settings" | "env" | null {
  if (getSetting("apiKey")) return "settings";
  if (ENV_API_KEY) return "env";
  return null;
}

/** Error carrying KIE's business code (401, 402, 422, 429, ...). */
export class KieError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
  }
}

const FRIENDLY: Record<number, string> = {
  401: "API key inválida ou ausente. Confira em Configurações.",
  402: "Créditos insuficientes na sua conta KIE.",
  404: "Recurso não encontrado na KIE.",
  422: "Parâmetros inválidos para este modelo.",
  429: "Muitas requisições. Aguarde alguns segundos e tente de novo.",
  433: "Limite da sub-chave excedido.",
  455: "Serviço temporariamente indisponível na KIE.",
};

async function request<T>(url: string, init: RequestInit & { key?: string } = {}): Promise<T> {
  const { key: keyOverride, ...rest } = init;
  const key = keyOverride ?? getApiKey();
  if (!key) throw new KieError(FRIENDLY[401]!, 401);
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { Authorization: `Bearer ${key}`, ...(rest.headers ?? {}) },
      signal: rest.signal ?? AbortSignal.timeout(60_000),
    });
  } catch (err) {
    throw new KieError(`Falha de rede ao falar com a KIE: ${(err as Error).message}`, 503);
  }
  const text = await res.text();
  let body: { code?: number; msg?: string; data?: T };
  try {
    body = JSON.parse(text);
  } catch {
    throw new KieError(`Resposta inesperada da KIE (HTTP ${res.status})`, res.status || 500);
  }
  // HTTP 200 does not mean success: KIE reports the real status in `code`.
  const code = body.code ?? res.status;
  if (code !== 200) {
    const friendly = FRIENDLY[code];
    const detail = body.msg && body.msg !== friendly ? body.msg : "";
    throw new KieError([friendly, detail].filter(Boolean).join(" — ") || `Erro ${code}`, code);
  }
  return body.data as T;
}

export interface CatalogModel {
  model: string;
  title: string;
  provider: string;
  taskType: string[];
  description: string | null;
  pricingDesc: string | null;
}

export interface RecordInfo {
  taskId: string;
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  failCode: string | null;
  failMsg: string | null;
  creditsConsumed?: number | null;
  resultJson?: string | null;
  response?: { resultUrls?: string[] } | null;
}

export const kie = {
  catalog: () => request<{ total: number; models: CatalogModel[] }>(`${API}/api/v1/models`),
  // Slashes in model names are part of the path and must not be URL-encoded.
  schema: (model: string) =>
    request<{ model: string; openapi: OpenApiDoc | null }>(`${API}/api/v1/models/${model}/schema`),
  credits: (key?: string) => request<number>(`${API}/api/v1/chat/credit`, { key }),
  createTask: (body: { model: string; input: Record<string, unknown> }) =>
    request<{ taskId: string }>(`${API}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  recordInfo: (taskId: string) =>
    request<RecordInfo>(`${API}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`),
  upload: (file: File) => {
    const form = new FormData();
    form.set("file", file, file.name);
    form.set("uploadPath", "kiestudio/uploads");
    form.set("fileName", file.name);
    return request<{ downloadUrl: string }>(`${UPLOAD_API}/api/file-stream-upload`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(5 * 60_000),
    });
  },
};

// Minimal OpenAPI typing: only what the schema simplifier reads.
export type JsonSchema = {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  default?: unknown;
  description?: string;
  title?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
};

export type OpenApiDoc = {
  paths: Record<
    string,
    Record<string, { requestBody?: { content?: Record<string, { schema?: JsonSchema }> } }>
  >;
  components?: Record<string, Record<string, JsonSchema>>;
};
