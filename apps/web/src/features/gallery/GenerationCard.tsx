import { AlertTriangle, Film } from "lucide-react";
import { useEffect, useState } from "react";
import { Loader } from "@/components/motion/loader";
import { isPending, type Generation } from "@/lib/api";
import { isVideoUrl, modeInfo } from "@/lib/modes";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

function useElapsed(since: number, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

export function MediaPreview({
  url,
  video,
  className,
  controls,
}: {
  url: string;
  /** Local copies have no file extension, so the caller says what the media is. */
  video?: boolean;
  className?: string;
  controls?: boolean;
}) {
  if (video ?? isVideoUrl(url)) {
    return (
      <video
        src={url}
        className={className}
        muted={!controls}
        loop
        playsInline
        controls={controls}
        autoPlay={controls}
        preload="metadata"
        onMouseEnter={(e) => !controls && void e.currentTarget.play().catch(() => {})}
        onMouseLeave={(e) => !controls && e.currentTarget.pause()}
      />
    );
  }
  return <img src={url} alt="" loading="lazy" className={className} />;
}

export function GenerationCard({ gen, onOpen, compact }: { gen: Generation; onOpen: () => void; compact?: boolean }) {
  const t = useT();
  const pending = isPending(gen.status);
  const elapsed = useElapsed(gen.createdAt, pending);
  const info = modeInfo(gen.mode);
  const first = gen.outputs[0]?.url;
  const aspect = info.output === "video" ? "aspect-video" : "aspect-square";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative block w-full overflow-hidden rounded-2xl border border-border bg-card text-left outline-none transition",
        "hover:border-border-strong hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/60",
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-muted/40", !first && aspect)}>
        {first ? (
          <MediaPreview url={first} video={info.output === "video"} className="block h-auto w-full transition duration-500 group-hover:scale-[1.02]" />
        ) : pending ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-transparent to-violet-500/10">
            <Loader variant="metaballs" size={44} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {gen.status === "generating" ? t("status.generating") : t("status.waiting")} · {elapsed}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertTriangle className="size-6 text-destructive" />
            <span className="line-clamp-3 text-xs text-muted-foreground">{gen.error ?? t("card.noResult")}</span>
          </div>
        )}
        {first && info.output === "video" && (
          <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            <Film className="size-3" /> {t("card.video")}
          </span>
        )}
        {gen.outputs.length > 1 && (
          <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white backdrop-blur">
            +{gen.outputs.length - 1}
          </span>
        )}
      </div>
      {!compact && (
        <div className="flex items-start gap-2 p-3">
          <p className="line-clamp-2 flex-1 text-xs text-muted-foreground">{gen.prompt || gen.model}</p>
          <StatusBadge status={gen.status} />
        </div>
      )}
    </button>
  );
}
