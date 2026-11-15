import { AlertCircle, ArrowRight, ChevronDown, Coins, Paperclip, RotateCcw, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { PromptInput } from "@/components/agents/prompt-input";
import { Button } from "@/components/motion/button";
import { Loader } from "@/components/motion/loader";
import type { CatalogModel, Mode, ModelField, ModelSpec } from "@/lib/api";
import { modeInfo, PREFERRED_MODELS } from "@/lib/modes";
import { useAppState } from "@/state/app-state";
import { useGenerate, useGenerations, useModels, useSettings, useSpec } from "@/state/queries";
import { useToast } from "@/state/toasts";
import { DetailModal } from "@/features/gallery/DetailModal";
import { GenerationCard } from "@/features/gallery/GenerationCard";
import { useT } from "@/i18n";
import { useFieldLabel } from "./FieldLabel";
import { FileField } from "./FileField";
import { ModelPicker } from "./ModelPicker";
import { ParamField } from "./ParamField";

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function pickDefaultModel(mode: Mode, models: CatalogModel[], saved?: string) {
  if (saved && models.some((m) => m.model === saved)) return saved;
  return PREFERRED_MODELS[mode].find((id) => models.some((m) => m.model === id)) ?? models[0]?.model;
}

const isFileField = (f: ModelField) => f.kind === "file" || f.kind === "files";

function defaultsFor(spec: ModelSpec, seed: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {};
  for (const f of spec.fields) {
    if (f.kind === "prompt") continue;
    const seeded = seed[f.name];
    const validSeed =
      seeded !== undefined &&
      (f.kind !== "enum" || (f.options ?? []).some((o) => String(o) === String(seeded)));
    if (validSeed) values[f.name] = seeded;
    else if (f.default !== undefined) values[f.name] = f.default;
    else if (f.kind === "enum" && f.required) values[f.name] = f.options?.[0];
    else if (f.kind === "boolean" && f.required) values[f.name] = false;
  }
  return values;
}

function isEmpty(v: unknown) {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
}

export function StudioView() {
  const t = useT();
  const { mode, modelByMode, setModel, draftVersion } = useAppState();
  const settings = useSettings();
  const hasKey = Boolean(settings.data?.hasKey);
  const models = useModels(mode, hasKey);
  const list = useMemo(() => models.data ?? [], [models.data]);
  const model = pickDefaultModel(mode, list, modelByMode[mode]);
  const spec = useSpec(hasKey ? model : undefined);
  const info = modeInfo(mode);
  const catalogEntry = list.find((m) => m.model === model);
  const { data: history } = useGenerations();
  const usage = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const g of history ?? []) if (g.mode === mode) counts[g.model] = (counts[g.model] ?? 0) + 1;
    return counts;
  }, [history, mode]);

  useEffect(() => {
    if (model && model !== modelByMode[mode]) setModel(mode, model);
  }, [mode, model, modelByMode, setModel]);

  // Switching models always shows a short loading state, even when the
  // schema is already cached, so the change is visible.
  const [switching, setSwitching] = useState(false);
  const firstModel = useRef(true);
  useEffect(() => {
    if (!model) return;
    if (firstModel.current) {
      firstModel.current = false;
      return;
    }
    setSwitching(true);
    const timer = setTimeout(() => setSwitching(false), 650);
    return () => clearTimeout(timer);
  }, [model]);

  const ready = Boolean(spec.data && model && spec.data.model === model && !switching);

  const picker = (
    <Panel title={t("studio.model")}>
      {models.isLoading ? (
        <div className="flex h-11 items-center justify-center">
          <Loader variant="dots" size={20} />
        </div>
      ) : models.isError ? (
        <p className="text-sm text-destructive">{(models.error as Error).message}</p>
      ) : (
        <>
          <ModelPicker mode={mode} models={list} value={model} onChange={(m) => setModel(mode, m)} usage={usage} />
          {catalogEntry?.pricing && (
            <div className="mt-3 flex gap-2 rounded-xl bg-muted/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <Coins className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
              <span className="line-clamp-4 whitespace-pre-line">{catalogEntry.pricing.split("High-tier")[0]!.trim()}</span>
            </div>
          )}
        </>
      )}
    </Panel>
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex items-center gap-3">
        <info.icon className="size-6 shrink-0 text-foreground/80" strokeWidth={1.75} />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t(info.key("label"))}</h1>
          <p className="text-sm text-muted-foreground">{t(info.key("description"))}</p>
        </div>
      </header>

      {!hasKey ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {t("studio.noKey")}
        </div>
      ) : ready ? (
        <motion.div
          key={`${mode}:${model}:${draftVersion}`}
          initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <StudioForm mode={mode} model={model!} spec={spec.data!} picker={picker} />
        </motion.div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card/30">
            {spec.isError ? (
              <p className="px-6 text-center text-sm text-destructive">{(spec.error as Error).message}</p>
            ) : (
              <>
                <Loader variant="metaballs" size={40} />
                <span className="text-xs text-muted-foreground">{t("studio.loadingModel")}</span>
              </>
            )}
          </div>
          <aside className="flex flex-col gap-4">
            {picker}
            <Panel title={t("studio.params")}>
              <div className="flex flex-col gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-foreground/10" />
                    <div className="h-9 animate-pulse rounded-xl bg-foreground/[0.06]" />
                  </div>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      )}

      <RecentForMode mode={mode} />
    </div>
  );
}

function StudioForm({
  mode,
  model,
  spec,
  picker,
}: {
  mode: Mode;
  model: string;
  spec: ModelSpec;
  picker: ReactNode;
}) {
  const { drafts, setDraft } = useAppState();
  const t = useT();
  const fieldLabel = useFieldLabel();
  const generate = useGenerate();
  const toast = useToast();
  const info = modeInfo(mode);
  const draft = drafts[mode];

  const [prompt, setPrompt] = useState(draft?.prompt ?? "");
  const [values, setValues] = useState<Record<string, unknown>>(() => defaultsFor(spec, draft?.values));
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const uploading = Object.values(busy).some(Boolean);

  // Keep the draft in app state so it survives switching tabs and models.
  const setDraftRef = useRef(setDraft);
  setDraftRef.current = setDraft;
  useEffect(() => {
    setDraftRef.current(mode, { prompt, values });
  }, [mode, prompt, values]);

  const promptField = spec.fields.find((f) => f.kind === "prompt");
  const fileFields = spec.fields.filter(isFileField);
  // Image modes lead with their source image; other file inputs are optional extras.
  const needsSource = mode === "i2i" || mode === "i2v";
  const primaryFiles = fileFields.filter((f) => f.required || (needsSource && f === fileFields[0]));
  const extraFiles = fileFields.filter((f) => !primaryFiles.includes(f));
  const [showExtra, setShowExtra] = useState(() => extraFiles.some((f) => !isEmpty(values[f.name])));

  const renderFiles = (fields: ModelField[]) => (
    <div className={fields.length > 1 ? "grid gap-4 md:grid-cols-2" : "flex flex-col gap-4"}>
      {fields.map((f) => (
        <div key={f.name} className="rounded-2xl border border-border bg-card/50 p-4">
          <FileField field={f} value={values[f.name]} onChange={(v) => setValue(f.name, v)} onBusyChange={setBusyFor} />
        </div>
      ))}
    </div>
  );
  const paramFields = spec.fields.filter((f) => f.kind !== "prompt" && !isFileField(f));
  const requiredParams = paramFields.filter((f) => f.required);
  const optionalParams = paramFields.filter((f) => !f.required);

  const setValue = (name: string, v: unknown) => setValues((prev) => ({ ...prev, [name]: v }));
  const setBusyFor = (name: string, b: boolean) =>
    setBusy((prev) => (prev[name] === b ? prev : { ...prev, [name]: b }));

  const submit = (text = prompt) => {
    if (!spec.supported) return;
    if (uploading) {
      toast({ title: t("studio.waitUpload"), status: "info" });
      return;
    }
    if (promptField?.required && !text.trim()) {
      toast({ title: t("studio.needPrompt"), description: t("studio.needPromptDesc"), status: "error" });
      return;
    }
    const missing = spec.fields.filter((f) => f.kind !== "prompt" && f.required && isEmpty(values[f.name]));
    if (missing.length) {
      toast({
        title: t("studio.missing"),
        description: missing.map(fieldLabel).join(", "),
        status: "error",
      });
      return;
    }
    const input: Record<string, unknown> = {};
    if (promptField && text.trim()) input.prompt = text.trim();
    for (const f of spec.fields) {
      if (f.kind === "prompt") continue;
      const v = values[f.name];
      if (!isEmpty(v)) input[f.name] = v;
    }
    generate.mutate({ mode, model, input });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-4">
        {!spec.supported && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <span>{spec.reason} {t("studio.unsupported")}</span>
          </div>
        )}

        {primaryFiles.length > 0 && renderFiles(primaryFiles)}

        {promptField ? (
          <PromptInput
            value={prompt}
            onValueChange={setPrompt}
            onSubmit={(text) => submit(text)}
            loading={generate.isPending}
            disabled={!spec.supported}
            placeholder={t(info.key("placeholder"))}
            minRows={4}
            maxRows={14}
            maxLength={promptField.maxLength}
            className="rounded-3xl bg-card/60 p-3 shadow-sm"
            leadingAction={
              <span className="px-2 text-[11px] text-muted-foreground">
                {uploading ? t("studio.uploading") : t("studio.enterToGenerate")}
              </span>
            }
          />
        ) : (
          <div className="flex justify-end">
            <Button size="lg" onClick={() => submit()} disabled={!spec.supported || generate.isPending || uploading}>
              <Wand2 className="size-4" /> {generate.isPending ? t("studio.sending") : t("studio.generate")}
            </Button>
          </div>
        )}

        {extraFiles.length > 0 && (
          <div className="rounded-2xl border border-border">
            <button
              type="button"
              onClick={() => setShowExtra((s) => !s)}
              aria-expanded={showExtra}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-muted-foreground hover:text-foreground"
            >
              <Paperclip className="size-4" />
              <span className="flex-1">
                {t("studio.extraRefs")}
                <span className="ml-1 text-xs text-muted-foreground/70">
                  ({extraFiles.map(fieldLabel).join(", ")})
                </span>
              </span>
              <ChevronDown className={`size-4 transition-transform ${showExtra ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
              {showExtra && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 pt-0">{renderFiles(extraFiles)}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <aside className="flex flex-col gap-4">
        {picker}
        {paramFields.length > 0 && (
          <Panel
            title={t("studio.params")}
            action={
              <button
                type="button"
                onClick={() => setValues(defaultsFor(spec))}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="size-3" /> {t("studio.defaults")}
              </button>
            }
          >
            <div className="flex flex-col gap-4">
              {[...requiredParams, ...optionalParams].map((f) => (
                <ParamField key={f.name} field={f} value={values[f.name]} onChange={(v) => setValue(f.name, v)} />
              ))}
            </div>
          </Panel>
        )}
      </aside>
    </div>
  );
}

function RecentForMode({ mode }: { mode: Mode }) {
  const { data } = useGenerations();
  const { setView } = useAppState();
  const t = useT();
  const [openId, setOpenId] = useState<string | null>(null);
  const recent = (data ?? []).filter((g) => g.mode === mode).slice(0, 8);
  const open = data?.find((g) => g.id === openId) ?? null;
  if (!recent.length) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("studio.recent")}</h2>
        <button
          type="button"
          onClick={() => setView("gallery")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {t("studio.seeGallery")} <ArrowRight className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {recent.map((g) => (
          <GenerationCard key={g.id} gen={g} onOpen={() => setOpenId(g.id)} />
        ))}
      </div>
      <DetailModal gen={open} onClose={() => setOpenId(null)} />
    </section>
  );
}
