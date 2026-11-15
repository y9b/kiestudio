import { KeyRound } from "lucide-react";
import { Button } from "@/components/motion/button";
import { useT } from "@/i18n";
import { useAppState } from "@/state/app-state";
import { useSettings } from "@/state/queries";

/** Friendly nudge shown until a KIE API key is configured. */
export function ApiKeyBanner() {
  const { data, isError } = useSettings();
  const { view, setView } = useAppState();
  const t = useT();

  if (isError) {
    return (
      <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-3 text-sm text-destructive">
        {t("banner.serverDown", { cmd: "npm run dev" })}
      </div>
    );
  }
  if (!data || data.hasKey || view === "settings") return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm">
      <KeyRound className="size-4 text-amber-500" />
      <span className="flex-1">{t("banner.noKey")}</span>
      <Button size="sm" onClick={() => setView("settings")}>
        {t("banner.configure")}
      </Button>
    </div>
  );
}
