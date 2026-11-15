import { Maximize2, Minus, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 8;
const STEP = 1.5;

interface View {
  scale: number;
  x: number;
  y: number;
}

/**
 * Image with wheel / pinch-free zoom toward the cursor, drag to pan,
 * double-click to toggle and on-screen controls.
 */
export function ZoomableImage({ src, className }: { src: string; className?: string }) {
  const t = useT();
  const boxRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  // Keep the image covering the frame: no panning past its edges.
  const clamp = useCallback((v: View): View => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return v;
    const maxX = (box.width * (v.scale - 1)) / 2;
    const maxY = (box.height * (v.scale - 1)) / 2;
    return {
      scale: v.scale,
      x: Math.max(-maxX, Math.min(maxX, v.x)),
      y: Math.max(-maxY, Math.min(maxY, v.y)),
    };
  }, []);

  /** Zoom to `next`, keeping the point under (clientX, clientY) still. */
  const zoomTo = useCallback(
    (next: number, clientX?: number, clientY?: number) => {
      setView((prev) => {
        const scale = Math.max(MIN, Math.min(MAX, next));
        if (scale === 1) return { scale: 1, x: 0, y: 0 };
        const box = boxRef.current?.getBoundingClientRect();
        if (!box || clientX === undefined || clientY === undefined) {
          return clamp({ scale, x: prev.x * (scale / prev.scale), y: prev.y * (scale / prev.scale) });
        }
        const px = clientX - (box.left + box.width / 2);
        const py = clientY - (box.top + box.height / 2);
        const ratio = scale / prev.scale;
        return clamp({ scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio });
      });
    },
    [clamp],
  );

  const viewRef = useRef(view);
  viewRef.current = view;

  // Wheel needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0025);
      zoomTo(viewRef.current.scale * factor, e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  const onPointerDown = (e: PointerEvent) => {
    if (view.scale === 1 || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: view.x, y: view.y };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    setView((prev) => clamp({ scale: prev.scale, x: d.x + e.clientX - d.px, y: d.y + e.clientY - d.py }));
  };
  const endDrag = () => {
    drag.current = null;
    setDragging(false);
  };

  const zoomed = view.scale > 1;
  const btn =
    "flex size-8 items-center justify-center rounded-full text-white/80 transition hover:bg-white/15 hover:text-white disabled:opacity-30";

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative size-full touch-none select-none overflow-hidden",
        zoomed ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={(e) => zoomTo(zoomed ? 1 : 2.5, e.clientX, e.clientY)}
    >
      <motion.img
        src={src}
        alt=""
        draggable={false}
        className="pointer-events-none size-full object-contain"
        animate={{ scale: view.scale, x: view.x, y: view.y }}
        transition={dragging ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 36 }}
      />

      <div
        className="absolute right-3 top-3 flex items-center gap-0.5 rounded-full bg-black/50 p-1 backdrop-blur"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={btn} onClick={() => zoomTo(view.scale / STEP)} disabled={!zoomed} aria-label={t("detail.zoomOut")} title={t("detail.zoomOut")}>
          <Minus className="size-4" />
        </button>
        <span className="w-11 text-center text-[11px] tabular-nums text-white/80">{Math.round(view.scale * 100)}%</span>
        <button type="button" className={btn} onClick={() => zoomTo(view.scale * STEP)} disabled={view.scale >= MAX} aria-label={t("detail.zoomIn")} title={t("detail.zoomIn")}>
          <Plus className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => zoomTo(1)} disabled={!zoomed} aria-label={t("detail.zoomReset")} title={t("detail.zoomReset")}>
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {!zoomed && (
        <p className="pointer-events-none absolute left-3 top-3 hidden rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/70 backdrop-blur md:block">
          {t("detail.zoomHint")}
        </p>
      )}
    </div>
  );
}
