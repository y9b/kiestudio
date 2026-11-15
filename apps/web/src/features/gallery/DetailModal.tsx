import { Check, Copy, Download, ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/motion/button";
import { Loader } from "@/components/motion/loader";
import { isPending, type Generation } from "@/lib/api";
import { useI18n, type T } from "@/i18n";
import { modeInfo } from "@/lib/modes";
import { useAppState } from "@/state/app-state";
import { useDeleteGeneration } from "@/state/queries";
import { MediaPreview } from "./GenerationCard";
import { StatusBadge } from "./StatusBadge";
import { ZoomableImage } from "./ZoomableImage";

function fmtDate(ts: number, lang: string) {
  return new Date(ts).toLocaleString(lang, { dateStyle: "short", timeStyle: "short" });
}

function fmtValue(v: unknown, t: T) {
  if (Array.isArray(v)) return t("detail.files", { n: v.length });
  if (typeof v === "boolean") return v ? t("detail.yes") : t("detail.no");
  const s = String(v);
  return s.startsWith("http") ? t("detail.uploaded") : s;
}

export function DetailModal({ gen, onClose }: { gen: Generation | null; onClose: () => void }) {
  const { reuse } = useAppState();
  const { t, lang } = useI18n();
  const del = useDeleteGeneration();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setIndex(0);
    setConfirmDelete(false);
  }, [gen?.id]);

  useEffect(() => {
    if (!gen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, gen.outputs.length - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [gen, onClose]);

  const current = gen?.outputs[index]?.url;
  const params = gen ? Object.entries(gen.input).filter(([k]) => k !== "prompt") : [];

  return createPortal(
    <AnimatePresence>
      {gen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("detail.label")}
            className="relative flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl md:flex-row"
            initial={{ scale: 0.96, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
          >
            <div className="relative flex min-h-[260px] flex-1 items-center justify-center bg-black/90">
              {current ? (
                modeInfo(gen.mode).output === "video" ? (
                  <MediaPreview key={current} url={current} video controls className="max-h-[70vh] w-auto max-w-full object-contain md:max-h-[85vh]" />
                ) : (
                  <div className="h-[60vh] w-full md:h-[85vh]">
                    <ZoomableImage key={current} src={current} />
                  </div>
                )
              ) : isPending(gen.status) ? (
                <Loader variant="metaballs" size={56} />
              ) : (
                <p className="max-w-sm p-6 text-center text-sm text-white/70">{gen.error ?? t("card.noResult")}</p>
              )}
              {gen.outputs.length > 1 && (
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/50 p-1.5 backdrop-blur">
                  {gen.outputs.map((o, i) => (
                    <button
                      key={o.url}
                      type="button"
                      aria-label={t("detail.result", { n: i + 1 })}
                      onClick={() => setIndex(i)}
                      className={`size-2 rounded-full transition ${i === index ? "bg-white" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <aside className="flex w-full flex-col gap-5 overflow-y-auto p-5 md:w-[340px]">
              <div className="flex items-center justify-between">
                <StatusBadge status={gen.status} />
                <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("detail.close")}>
                  <X className="size-4" />
                </Button>
              </div>

              <section>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("detail.prompt")}</h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{gen.prompt || "—"}</p>
              </section>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">{t("detail.mode")}</dt>
                <dd>{t(modeInfo(gen.mode).key("label"))}</dd>
                <dt className="text-muted-foreground">{t("detail.model")}</dt>
                <dd className="break-all">{gen.model}</dd>
                <dt className="text-muted-foreground">{t("detail.created")}</dt>
                <dd>{fmtDate(gen.createdAt, lang)}</dd>
                {gen.completedAt && (
                  <>
                    <dt className="text-muted-foreground">{t("detail.duration")}</dt>
                    <dd>{Math.round((gen.completedAt - gen.createdAt) / 1000)}s</dd>
                  </>
                )}
                {gen.credits != null && (
                  <>
                    <dt className="text-muted-foreground">{t("detail.credits")}</dt>
                    <dd>{gen.credits}</dd>
                  </>
                )}
                {params.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="truncate text-muted-foreground">{k}</dt>
                    <dd className="truncate">{fmtValue(v, t)}</dd>
                  </div>
                ))}
              </dl>

              {current && !gen.outputs[index]?.local && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-600 dark:text-amber-400">
                  {t("detail.remoteWarning")}
                </p>
              )}

              <div className="mt-auto grid grid-cols-2 gap-2">
                {current && (
                  <a
                    href={current}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="col-span-2 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    <Download className="size-4" /> {t("detail.download")}
                  </a>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(gen.prompt);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? t("detail.copied") : t("detail.copy")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    reuse(gen);
                    onClose();
                  }}
                >
                  <RotateCcw className="size-3.5" /> {t("detail.reuse")}
                </Button>
                {current && (
                  <a
                    href={current}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-muted/60"
                  >
                    <ExternalLink className="size-3.5" /> {t("detail.open")}
                  </a>
                )}
                <Button
                  variant={confirmDelete ? "primary" : "ghost"}
                  size="sm"
                  className={confirmDelete ? "bg-destructive text-white hover:bg-destructive/90" : "text-destructive"}
                  onClick={() => {
                    if (!confirmDelete) return setConfirmDelete(true);
                    del.mutate(gen.id, { onSuccess: onClose });
                  }}
                >
                  <Trash2 className="size-3.5" /> {confirmDelete ? t("detail.confirm") : t("detail.delete")}
                </Button>
              </div>
            </aside>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
