import { Languages } from "lucide-react";
import { motion } from "motion/react";
import { useId } from "react";
import { LANGUAGES, useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

/** Segmented PT / EN / 中 switch. */
export function LanguageSwitcher({ className, showIcon = true }: { className?: string; showIcon?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={t("nav.language")}
      className={cn("flex items-center gap-1 rounded-xl border border-border bg-card/60 p-1", className)}
    >
      {showIcon && <Languages className="mx-1 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
      {LANGUAGES.map((l) => {
        const active = l.id === lang;
        return (
          <button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={l.label}
            onClick={() => setLang(l.id)}
            className={cn(
              "relative flex-1 rounded-lg px-2 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={`lang-pill-${id}`}
                className="absolute inset-0 rounded-lg bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{l.short}</span>
          </button>
        );
      })}
    </div>
  );
}
