import { cn } from "@/lib/utils";

/**
 * The brand mark: a looping animated Renaissance painting (public/logo.gif),
 * framed like a tiny gilded canvas.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-xl ring-1 ring-amber-500/40 shadow-[0_0_0_3px_rgba(180,140,60,0.15)]",
        className,
      )}
    >
      <img src="/logo.gif" alt="" className="size-full object-cover" draggable={false} />
    </span>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-10" />
      <span className="text-[17px] font-semibold tracking-tight">
        kie<span className="bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">Studio</span>
      </span>
    </div>
  );
}
