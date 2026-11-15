import { cn } from "@/lib/utils";

/** The brand mark: a looping animated Renaissance painting (public/logo.gif). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative block shrink-0 overflow-hidden rounded-xl", className)}>
      <img src="/logo.gif" alt="" className="size-full object-cover" draggable={false} />
    </span>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark className="size-10" />
      <span className="text-[17px] font-semibold tracking-tight text-foreground">kieStudio</span>
    </div>
  );
}
