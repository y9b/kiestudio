import type { JsonSchema, OpenApiDoc } from "./kie.ts";

/**
 * A flattened, UI-friendly description of one model input field. The web app
 * renders its parameter form from these, so new KIE models work without code
 * changes.
 */
export type FieldKind =
  | "prompt" // the main prompt, rendered by the prompt box
  | "text" // free text (negative prompt, etc.)
  | "number"
  | "boolean"
  | "enum"
  | "file" // a single uploaded file URL
  | "files" // an array of uploaded file URLs
  | "list"; // an array of strings typed by hand

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

const FILE_NAME = /(image|video|audio|frame|mask|_url|_urls|^url$|^urls$)/i;

function decodePointer(ref: string): string[] {
  return ref.replace(/^#\//, "").split("/").map((p) => decodeURIComponent(p.replace(/~1/g, "/").replace(/~0/g, "~")));
}

function makeResolver(doc: OpenApiDoc) {
  const resolve = (schema: JsonSchema | undefined, depth = 0): JsonSchema | undefined => {
    if (!schema || depth > 20) return schema;
    if (schema.$ref) {
      // Keys are literal: keep trailing spaces, only percent-decode.
      let node: unknown = doc;
      for (const part of decodePointer(schema.$ref)) node = (node as Record<string, unknown>)?.[part];
      return resolve(node as JsonSchema, depth + 1);
    }
    if (schema.allOf?.length) {
      const merged: JsonSchema = { ...schema, allOf: undefined, properties: {}, required: [] };
      for (const part of schema.allOf) {
        const r = resolve(part, depth + 1) ?? {};
        Object.assign(merged.properties!, r.properties ?? {});
        merged.required!.push(...(r.required ?? []));
        merged.type ??= r.type;
      }
      return merged;
    }
    return schema;
  };
  return resolve;
}

function typeOf(s: JsonSchema): string | undefined {
  if (Array.isArray(s.type)) return s.type.find((t) => t !== "null");
  return s.type;
}

function humanize(name: string) {
  const s = name.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function acceptFor(name: string, description: string): ModelField["accept"] {
  const hay = `${name} ${description}`.toLowerCase();
  if (/video/.test(name.toLowerCase())) return "video";
  if (/audio|voice|sound_file/.test(name.toLowerCase())) return "audio";
  if (/video/.test(hay) && !/image/.test(hay)) return "video";
  return "image";
}

function toField(name: string, raw: JsonSchema, required: boolean, resolve: ReturnType<typeof makeResolver>): ModelField | null {
  let s = resolve(raw) ?? {};
  // A union like anyOf: [{type: string}, {type: null}] — take the first concrete branch.
  const union = s.anyOf ?? s.oneOf;
  if (union?.length && !s.type) {
    s = { ...(resolve(union.find((u) => typeOf(resolve(u) ?? {}) !== "null")) ?? {}), description: s.description ?? undefined, default: s.default };
  }
  const description = (s.description ?? "").trim();
  const base = {
    name,
    label: s.title && s.title !== name ? s.title : humanize(name),
    description,
    required,
    default: s.default,
  };
  const type = typeOf(s);

  if (s.enum?.length) {
    return { ...base, kind: "enum", options: s.enum.filter((v) => v !== null) as (string | number)[] };
  }
  if (name === "prompt" && (type === "string" || !type)) {
    return { ...base, kind: "prompt", maxLength: s.maxLength };
  }
  if (type === "boolean") return { ...base, kind: "boolean" };
  if (type === "number" || type === "integer") {
    // Many KIE schemas only state limits in prose: "(Minimum: 6, Maximum: 30, Step: 1)".
    const num = (re: RegExp) => {
      const m = description.match(re);
      return m ? Number(m[1]) : undefined;
    };
    const min = s.minimum ?? num(/minimum:?\s*(-?\d+(?:\.\d+)?)/i) ?? num(/\((-?\d+(?:\.\d+)?)\s*[-–]\s*-?\d+(?:\.\d+)?\)/);
    const max = s.maximum ?? num(/maximum:?\s*(-?\d+(?:\.\d+)?)/i) ?? num(/\(-?\d+(?:\.\d+)?\s*[-–]\s*(-?\d+(?:\.\d+)?)\)/);
    const step = num(/step:?\s*(\d+(?:\.\d+)?)/i);
    const def = base.default ?? num(/default(?: value)?(?: is)?:?\s*(-?\d+(?:\.\d+)?)/i);
    return {
      ...base,
      default: def ?? (required ? min : undefined),
      kind: "number",
      integer: type === "integer" || step === 1,
      min,
      max,
    };
  }
  if (type === "string") {
    if (FILE_NAME.test(name) || /file url|image url|video url|upload/i.test(description)) {
      return { ...base, kind: "file", accept: acceptFor(name, description) };
    }
    return { ...base, kind: "text", maxLength: s.maxLength };
  }
  if (type === "array") {
    const items = resolve(s.items) ?? {};
    if (typeOf(items) === "string" || !items.type) {
      if (FILE_NAME.test(name) || /url/i.test(description)) {
        return { ...base, kind: "files", accept: acceptFor(name, description), maxItems: s.maxItems };
      }
      return { ...base, kind: "list", maxItems: s.maxItems };
    }
  }
  return null; // objects and nested arrays are not rendered
}

export function simplifySchema(model: string, doc: OpenApiDoc | null): ModelSpec {
  if (!doc) {
    return { model, supported: false, reason: "A KIE ainda não publicou a documentação deste modelo.", fields: [] };
  }
  const op = doc.paths?.["/api/v1/jobs/createTask"]?.post;
  if (!op) {
    return { model, supported: false, reason: "Este modelo usa uma API diferente da de tarefas e ainda não é suportado.", fields: [] };
  }
  const resolve = makeResolver(doc);
  const body = resolve(op.requestBody?.content?.["application/json"]?.schema) ?? {};
  let input = resolve(body.properties?.input) ?? {};
  // Some models accept one of several input shapes: use the first one.
  const branches = input.oneOf ?? input.anyOf;
  if (!input.properties && branches?.length) input = resolve(branches[0]) ?? {};

  const required = new Set(input.required ?? []);
  const fields: ModelField[] = [];
  for (const [name, prop] of Object.entries(input.properties ?? {})) {
    const field = toField(name, prop, required.has(name), resolve);
    if (field) fields.push(field);
  }
  return { model, supported: true, fields };
}
