import { Coins, Images, Settings } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { Tooltip } from "@/components/motion/tooltip";
import { isPending } from "@/lib/api";
import { MODES } from "@/lib/modes";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { useAppState } from "@/state/app-state";
import { useCredits, useGenerations, useSettings } from "@/state/queries";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Logo } from "./Logo";

function NavItem({
  active,
  onClick,
  icon,
  label,
  badge,
  layoutId,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: ReactNode;
  layoutId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-primary/60",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-xl border border-border bg-card shadow-sm"
          transition={{ type: "spring", stiffness: 500, damping: 38 }}
        />
      )}
      <span className="relative z-10 flex size-5 items-center justify-center">{icon}</span>
      <span className="relative z-10 flex-1 truncate text-left">{label}</span>
      {badge && <span className="relative z-10">{badge}</span>}
    </button>
  );
}

function CreditsPill() {
  const t = useT();
  const settings = useSettings();
  const credits = useCredits(Boolean(settings.data?.hasKey));
  if (!settings.data?.hasKey) return null;
  const value = credits.data?.credits;
  return (
    <Tooltip content={t("nav.creditsHint")} side="top">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2 text-xs">
        <Coins className="size-4 text-amber-500" />
        <span className="text-muted-foreground">{t("nav.credits")}</span>
        <span className="ml-auto font-semibold tabular-nums">
          {value === undefined ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
        </span>
      </div>
    </Tooltip>
  );
}

export function Sidebar() {
  const t = useT();
  const { view, setView, mode, setMode } = useAppState();
  const { data: gens } = useGenerations();
  const running = gens?.filter((g) => isPending(g.status)).length ?? 0;

  const runningBadge =
    running > 0 ? (
      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
        {running}
      </span>
    ) : null;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-background/80 p-4 backdrop-blur md:flex">
        <div className="mb-6 flex items-center justify-between px-1">
          <Logo />
          <ThemeToggle variant="circle-blur" className="size-9 rounded-xl" />
        </div>

        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{t("nav.create")}</p>
        <nav className="flex flex-col gap-1">
          {MODES.map((m) => (
            <NavItem
              key={m.id}
              layoutId="sidebar-active"
              active={view === "studio" && mode === m.id}
              onClick={() => {
                setMode(m.id);
                setView("studio");
              }}
              icon={<m.icon className="size-[18px]" />}
              label={t(m.key("label"))}
            />
          ))}
        </nav>

        <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {t("nav.library")}
        </p>
        <nav className="flex flex-col gap-1">
          <NavItem
            layoutId="sidebar-active"
            active={view === "gallery"}
            onClick={() => setView("gallery")}
            icon={<Images className="size-[18px]" />}
            label={t("nav.gallery")}
            badge={runningBadge}
          />
          <NavItem
            layoutId="sidebar-active"
            active={view === "settings"}
            onClick={() => setView("settings")}
            icon={<Settings className="size-[18px]" />}
            label={t("nav.settings")}
          />
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <LanguageSwitcher />
          <CreditsPill />
          <p className="px-1 text-[11px] text-muted-foreground/70">
            {t("nav.shortcut", { enter: "Enter", shiftEnter: "Shift+Enter" })}
          </p>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-background/90 px-2 py-2 backdrop-blur md:hidden">
        {MODES.map((m) => {
          const active = view === "studio" && mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setView("studio");
              }}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <m.icon className="size-5" />
              {t(m.key("short"))}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setView("gallery")}
          className={cn(
            "relative flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]",
            view === "gallery" ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Images className="size-5" />
          {t("nav.gallery")}
          {running > 0 && <span className="absolute right-1 top-0 size-2 rounded-full bg-primary" />}
        </button>
        <button
          type="button"
          onClick={() => setView("settings")}
          className={cn(
            "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]",
            view === "settings" ? "text-primary" : "text-muted-foreground",
          )}
        >
          <Settings className="size-5" />
          {t("nav.settingsShort")}
        </button>
      </nav>
    </>
  );
}
